/** Flight controls for Minecraft game modes. */
export function canToggleFlight(mode) {
  return mode === "creative";
}

export function isSpectatorFlightLocked(mode) {
  return mode === "spectator";
}
