local DELETE_MARKER = { __delete__ = "__delete__" }

local function isDeleteMarker(value)
    return type(value) == "table" and value.__delete__ == "__delete__"
end

local function getDifferencesProposed(previousState, nextState)
    local patch = table.clone(nextState)

    for key, previous in previousState do
        local nextValue = nextState[key]

        if previous == nextValue then
            patch[key] = nil
        elseif nextValue == nil then
            patch[key] = DELETE_MARKER
        elseif type(previous) == "table" and type(nextValue) == "table" then
            local result = getDifferencesProposed(previous, nextValue)
        end
    end

    return patch
end

local function patchDifferences(currentState, patchState)
    local nextState = table.clone(currentState)

    for key, patch in patchState do
        local current = nextState[key]

        if isDeleteMarker(patch) then
            nextState[key] = nil
        elseif type(patch) == "table" and type(current) == "table" then
            nextState[key] = patchDifferences(current, patch)
        else
            nextState[key] = patch
        end
    end

    return nextState
end

return {
	getDifferencesProposed = getDifferencesProposed,
	patchDifferences = patchDifferences,
}