# Koruva Stage 7 — Existing room world re-entry fix

Date: 2026-11-22
Base: Stage 6 / current main

## Root cause

The Room Worker restores a reconnecting player's saved dimension and position from the versioned player save, and sends that dimension's edits. The initial `init` packet did not include the restored dimension or transform, however. The client consequently reset its local World using the default Overworld dimension and could then apply a browser-local saved position from an older session. This made the client load/render a different dimension or spawn location from the state the server had selected.

## Fix

- Added optional `dimensionId`, `p`, and `r` fields to the `init` server message (optional for compatibility with older workers).
- Room Worker now includes its authoritative restored dimension, position, and rotation in `init`.
- Client initializes `World` with the server-provided dimension, falling back to Overworld for older servers.
- After local inventory/profile restoration, client reapplies the server entry position/rotation so stale browser-local coordinates cannot override the room's saved location.
- Added `test/room-entry-world-state.test.mjs` to guard the protocol, server payload, client dimension initialization, and restoration order.

## Validation

- Direct source-level regression assertions: 6/6 passed.
- Full `node --test test/*.test.mjs`, TypeScript typecheck, Vite build, Workers deploy, and browser/WebGL multiplayer verification were not run in this editing session.
