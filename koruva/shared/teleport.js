const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
function parseCoordinate(token, origin) {
  if (typeof token !== "string") return NaN;
  if (token === "~") return origin;
  if (token.startsWith("~")) {
    const offset = token.slice(1);
    if (!NUMBER.test(offset)) return NaN;
    return origin + Number(offset);
  }
  if (!NUMBER.test(token)) return NaN;
  return Number(token);
}
/** Parse three absolute or executor-relative coordinates; null means invalid/out of world bounds. */
export function parseTeleportPosition(args, origin) {
  if (!Array.isArray(args) || args.length !== 3 || !Array.isArray(origin) || origin.length < 3 || !origin.slice(0, 3).every(Number.isFinite)) return null;
  const position = args.map((value, i) => parseCoordinate(value, origin[i]));
  if (!position.every(Number.isFinite) || Math.abs(position[0]) > 100000 || Math.abs(position[2]) > 100000 || position[1] < 1 || position[1] >= 128) return null;
  return position;
}
