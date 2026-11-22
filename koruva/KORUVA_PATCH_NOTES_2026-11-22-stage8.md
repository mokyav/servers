# Koruva Stage 8 — Camera-aligned targeting and bounded chunk remeshing

Date: 2026-11-22
Base: main

## Fixes

- Block targeting now starts at the rendered camera position and uses the camera's world-space forward direction. First-person behavior remains aligned with the view, while third-person targeting no longer traces from the player's body eye position and selects a different block from the crosshair due to camera parallax.
- Urgent chunk remeshing now shares the configured per-frame mesh budget with ordinary nearby chunk meshing. Previously every urgent chunk could be rebuilt in one frame regardless of the budget, causing frame spikes during chunk arrival or bursts of block edits and delaying visible world updates/input responsiveness.
- Added source-level regression tests for camera-aligned targeting and bounded urgent remeshing.

## Validation

- GitHub branch comparison confirms three commits ahead of main and no divergence.
- Regression tests were added but were not executed in this editing session.
- TypeScript typecheck, Vite build, full Node test suite, Workers deploy, and real-browser/WebGL verification remain unverified.
