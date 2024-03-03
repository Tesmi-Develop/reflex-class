import { BroadcastAction, BroadcastReceiverOptions, Producer, ProducerMiddleware } from "@rbxts/reflex";
import { restoreNotChangedProperties } from "../../utilities/restoreNotChangedProperties";
import { IsHydrate } from "./hydrate";
import { IsPatch } from "./patch";
import { patchDifferences } from "../../utilities/patch-utilities";

interface PatchBroadcastReceiverOptions extends BroadcastReceiverOptions {
	readonly OnPatch?: (patch: object) => void;
	readonly OnHydration?: (state: object) => void;
}

export const createPatchBroadcastReceiver = (options: PatchBroadcastReceiverOptions) => {
	let producer: Producer<object>;

	const hydrateState = (serverState: object) => {
		assert(producer, "Cannot use broadcast receiver before the middleware is applied.");

		const oldState = producer.getState();
		let nextState = table.clone(oldState);

		for (const [key, value] of pairs(serverState)) {
			nextState[key as never] = value as never;
		}

		nextState = restoreNotChangedProperties(nextState, oldState);
		options.OnHydration?.(nextState);
		producer.setState(nextState);
	};

	const receiver = {
		dispatch: (actions: BroadcastAction[]) => {
			assert(producer, "Cannot use broadcast receiver before the middleware is applied.");

			actions.forEach((action) => {
				if (IsHydrate(action)) {
					hydrateState(action.arguments[0] as object);
				}

				if (IsPatch(action)) {
					const patch = action.arguments[0] as object;
					if (next(patch) !== undefined) {
						producer.setState(patchDifferences(producer.getState(), patch));
						options.OnPatch?.(table.clone(patch));
					}
				}
			});
		},

		hydrate: (state: object) => {
			hydrateState(state);
		},

		middleware: ((newProducer: Producer<object>) => {
			producer = newProducer;
			options.start();

			return (dispatch) => dispatch;
		}) as ProducerMiddleware,
	};

	return receiver;
};
