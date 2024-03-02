import { BroadcastAction, Producer, ProducerMiddleware } from "@rbxts/reflex";
import { Players } from "@rbxts/services";
import { setInterval } from "@rbxts/set-timeout";
import { CreatePatchAction } from "./patch";
import { CreateHydrateAction } from "./hydrate";

interface PatchBroadcasterOptions<S extends object> {
	/**
	 * The map of producers to broadcast.
	 */
	readonly producer: Producer<S>;

	/**
	 * The rate at which the server should hydrate the clients
	 * with the latest state. If this is set to `-1`, the server
	 * will not hydrate the clients.
	 * @default 60
	 */
	readonly hydrateRate?: number;

	/**
	 * The rate at which the server should broadcast actions to
	 * the clients. If this is set to `0`, actions are broadcast
	 * with the next server heartbeat.
	 * @default 0
	 */
	readonly dispatchRate?: number;

	/**
	 * Runs before actions are dispatched to a player. Can be used to
	 * filter actions or manipulate them before sending.
	 *
	 * Return `undefined` to not share the action with this player.
	 */
	readonly beforeDispatch?: (player: Player, action: BroadcastAction) => BroadcastAction | undefined;

	/**
	 * Runs before the client is hydrated with the latest state. Can be
	 * used to filter the state or hide certain values from the client.
	 *
	 * **Note:** Do not mutate the state in this function! Treat it as a
	 * read-only object, and return a new object if you need to change it.
	 */
	readonly beforeHydrate?: (player: Player, state: S) => Partial<S> | undefined;

	/**
	 * A function that broadcasts actions to the given player.
	 * @param player The player to broadcast to.
	 * @param actions The actions to broadcast.
	 */
	readonly dispatch: (player: Player, actions: BroadcastAction[]) => void;

	/**
	 * An optional custom hydration function. If provided, this function
	 * will be called instead of being implicitly handled in 'dispatch'.
	 * Useful for reducing load on a single remote if your state is large.
	 *
	 * **Note:** If defined, the client should call `receiver.hydrate` to
	 * hydrate the state.
	 *
	 * @param player The player to hydrate.
	 * @param state The state to hydrate the player with.
	 */
	readonly hydrate?: (player: Player, state: S) => void;
}

export const CreatePatchBroadcaster = <S extends object>(options: PatchBroadcasterOptions<S>) => {
	const pendingActionsByPlayer = new Map<Player, BroadcastAction[]>();
	const actionFilter = new Set<string>();
	let pendingDispatch = false;
	let producer: Producer<object>;

	for (const [name] of pairs(options.producer.getDispatchers())) {
		actionFilter.add(name as string);
	}

	const hydratePlayer = (player: Player) => {
		let state = producer.getState();

		if (options.beforeHydrate) {
			const result = options.beforeHydrate(player, state as never);

			if (!result) return;
			state = result;
		}

		options.hydrate
			? options.hydrate(player, state as never)
			: options.dispatch(player, [CreateHydrateAction(state)]);
	};

	const hydrateInterval = setInterval(() => {
		pendingActionsByPlayer.forEach((_, player) => hydratePlayer(player));
	}, options.hydrateRate ?? 60);

	const dispatchInterval = setInterval(() => {
		broadcaster.flush();
	}, options.dispatchRate ?? 0);

	const playerRemoving = Players.PlayerRemoving.Connect((player) => {
		pendingActionsByPlayer.delete(player);
	});

	const broadcaster = {
		flush: () => {
			if (!pendingDispatch) return;

			pendingDispatch = false;

			pendingActionsByPlayer.forEach((actions, player) => {
				options.dispatch(player, actions);
				pendingActionsByPlayer.set(player, []);
			});
		},

		start: (player: Player) => {
			if (pendingActionsByPlayer.has(player)) return;
			pendingActionsByPlayer.set(player, []);
			hydratePlayer(player);
		},

		destroy: () => {
			hydrateInterval();
			dispatchInterval();
			playerRemoving.Disconnect();
		},

		middleware: ((newProducer: Producer) => {
			producer = newProducer;

			return (dispatch, name) => {
				if (!actionFilter.has(name)) return dispatch;

				return (...args) => {
					const currentState = producer.getState();
					const nextState = dispatch(...args) as object;
					pendingActionsByPlayer.forEach((actions, player) => {
						let action = CreatePatchAction(currentState, nextState) as BroadcastAction;

						if (options.beforeDispatch) {
							const result = options.beforeDispatch(player, action);
							if (result === undefined) return;
							action = result;
						}

						actions.push(action);
					});

					pendingDispatch = true;
					return nextState;
				};
			};
		}) as ProducerMiddleware,
	};

	return broadcaster;
};
