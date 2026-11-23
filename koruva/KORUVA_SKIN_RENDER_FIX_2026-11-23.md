# Koruva skin rendering audit — 2026-11-23

## Fixed

- Applied Java skin-atlas orientation to all base and overlay cube faces. Every bottom face is rotated 180 degrees; front/back, top, and side UV regions remain in their own atlas locations.
- Kept the six face materials in Three.js BoxGeometry order: +X, -X, +Y, -Y, +Z, -Z.
- Normalized the Java base/inner layer to opaque pixels: alpha 0 becomes opaque black; alpha 1–254 retains RGB and becomes alpha 255. The outer/overlay layer keeps its original alpha, including partial transparency.
- Removed the overlay material's 0.01 alpha cutoff so low-alpha overlay pixels are not discarded.
- Matched Java model inflation: the head outer/hat is 1 skin pixel larger overall; body, arms and legs are 0.5 skin pixel larger overall.
- Raised the server-side encoded PNG data-URL limit to 32,128 characters so a 24,000-byte PNG plus its data-URL prefix is not rejected after the client accepts it.
- Kept Java format restrictions: 64x64 current skins and 64x32 legacy skins are accepted; unsupported dimensions such as 128x128 are rejected for this Java Edition client. Classic/Steve arms are 4 pixels wide; Slim/Alex arms are 3 pixels wide. Legacy 64x32 arm/leg mirroring remains covered by the existing test.

## Regression coverage added

- Exact back-face UV rectangles for head, body, right/left arms and right/left legs.
- Bottom-face horizontal and vertical flips for every part and both layers.
- Actual draw helper calls: bottom uses a 180-degree transform; back draws from its dedicated UV strip without a flip.
- Base-layer partial alpha is forced opaque while overlay partial alpha is retained.

## Verification status

- GitHub Actions runs the repository's full typecheck, Vite production build and automated test suite on pushes to `main`.
- This editing environment could not clone the repository for a local browser/WebGL run. A passing CI run and visual in-game confirmation are still required before claiming the rear skin has been verified on every GPU/browser.
