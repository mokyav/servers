/** Returns true only for structurally safe v1 solo saves; does not mutate the input. */
export function isValidSoloSave(value: unknown): value is Record<string, unknown>;
