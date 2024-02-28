import { BroadcastAction } from "@rbxts/reflex";

const HYDRATE = "__hydrate__";

export const CreateHydrateAction = (state: object) => ({
	name: HYDRATE,
	arguments: [state],
});

export const IsHydrate = (action: BroadcastAction) => action.name === HYDRATE;
