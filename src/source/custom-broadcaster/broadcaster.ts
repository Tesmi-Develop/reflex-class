import { BroadcastAction, BroadcasterOptions, Producer, ProducerMap, ProducerMiddleware } from "@rbxts/reflex";
import { Players } from "@rbxts/services";
import { setInterval } from "@rbxts/set-timeout";
import { CreatePatchAction } from "./patch";

export const CreatePatchBroadcaster = <P extends ProducerMap>(options: BroadcasterOptions<P>) => {
	const pendingActionsByPlayer = new Map<Player, BroadcastAction[]>();
	const actionFilter = new Set<string>();
	let pendingDispatch = false;
	let producer: Producer<object>;

	for (const [_, slice] of pairs(options.producers)) {
		const typedSlice = slice as Producer<{}>;
		for (const [name] of pairs(typedSlice.getDispatchers())) {
			actionFilter.add(name as string);
		}
	}

	const getSharedState = () => {
		assert(producer, "Cannot use broadcaster before the middleware is applied.");
		const sharedState = {};
		const serverState = producer.getState();

		for (const [name] of pairs(options.producers)) {
			sharedState[name as never] = serverState[name as never] as never;
		}

		return sharedState;
	};

	const hydratePlayer = (player: Player) => {
		let state = getSharedState();
		state = options.beforeHydrate?.(player, state as never) ?? state;

		options.hydrate ? options.hydrate(player, state as never) : options.dispatch(player, []);
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
						action = (options.beforeDispatch?.(player, action) as BroadcastAction) ?? action;
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
