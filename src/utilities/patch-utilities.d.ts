interface PatchUtilities {
	getDifferencesProposed: <T extends object>(state: T, nextState: T) => object;
	patchDifferences: (currentState: object, patch: object) => object;
}

declare const PatchUtilities: PatchUtilities;
export = PatchUtilities;
