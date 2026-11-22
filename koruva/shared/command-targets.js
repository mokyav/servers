/** Resolve a player selector against the connected players in the current room. */
export function resolveCommandTargets(who, candidates, issuerSocket, random = Math.random) {
  if (!Array.isArray(candidates)) return [];
  const all = candidates.filter(entry => entry && entry.ws !== undefined && entry.st && entry.st.joined !== false);
  const issuer = all.find(entry => entry.ws === issuerSocket);
  const target = typeof who === "string" && who.trim() ? who.trim() : "@s";
  if (target === "@s") return issuer ? [issuer] : [];
  if (target === "@a") return all;
  if (target === "@p") {
    if (!issuer) return [];
    const origin = issuer.st.p;
    if (!Array.isArray(origin) || origin.length < 3 || !origin.slice(0, 3).every(Number.isFinite)) return [issuer];
    let nearest = null, nearestDistance = Infinity;
    for (const entry of all) {
      const p = entry.st.p;
      if (!Array.isArray(p) || p.length < 3 || !p.slice(0, 3).every(Number.isFinite)) continue;
      const dx = p[0] - origin[0], dy = p[1] - origin[1], dz = p[2] - origin[2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < nearestDistance) { nearest = entry; nearestDistance = distance; }
    }
    return nearest ? [nearest] : [issuer];
  }
  if (target === "@r") {
    if (!all.length) return [];
    const value = Number(random());
    const unit = Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
    return [all[Math.floor(unit * all.length)]];
  }
  const name = target.startsWith(":") ? target.slice(1) : target;
  if (!name) return [];
  const key = name.toLowerCase();
  return all.filter(entry => typeof entry.st.name === "string" && entry.st.name.toLowerCase() === key);
}
