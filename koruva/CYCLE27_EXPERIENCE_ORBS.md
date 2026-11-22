# Cycle27 — Multiplayer experience orbs on death

- Player death now drops the Minecraft-style survival loss (7 XP per current level, capped at 100) as a persisted, dimension-scoped orb alongside inventory/armor stacks; remaining XP is lost as in the existing death reset. Creation shares the death-drop storage transaction and rollback path.
- Drop normalization rejects malformed XP records. Init, dimension changes and live updates carry the XP subtype.
- Survival pickup awards only the amount that fits under the global XP cap; the orb retains any remainder. Creative pickup does not consume XP orbs.
- The client renders XP drops as a bright green sphere. Mob XP rewards are unchanged.
- Multiplayer rooms only: solo death drops, orb sound/animation, browser/Workers build QA and physical mobile QA remain open.
