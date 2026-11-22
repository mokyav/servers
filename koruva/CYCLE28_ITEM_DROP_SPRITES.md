# Cycle28 — Item drop sprites

- Reused the project's item texture map for item-only drops and potion variants. These render as two crossed, nearest-filtered textured planes while block drops remain atlas-mapped cubes.
- Texture loads upgrade the temporary cube after loading; failed or missing images retain the existing cube. UI icons and drops share one safe texture-path resolver, independent of TypeScript-only block definitions.
- Added a declaration file plus tests for mapped asset existence, path safety, potion/block behavior, and client wiring.
- Validation: Node `.test.mjs` suite and ZIP CRC; browser/WebGL visual behavior and TypeScript build remain unverified.
