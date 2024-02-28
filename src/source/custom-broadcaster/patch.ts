import { BroadcastAction } from "@rbxts/reflex";
import { getDifferencesProposed } from "../../utilities/patch-utilities";

const PATCH = "__patch__";

export const CreatePatchAction = (state: object, nextState: object) => ({
	name: PATCH,
	arguments: [getDifferencesProposed(state, nextState)],
});

export const IsPatch = (action: BroadcastAction) => action.name === PATCH;
