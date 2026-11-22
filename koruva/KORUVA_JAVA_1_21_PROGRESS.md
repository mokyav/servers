# Java Edition 1.21.0 parity work — progress

This ZIP is an incremental work-in-progress, not a complete Java Edition implementation.

## Implemented in this revision
- Chunk cell IDs and generated chunk buffers now use unsigned 16-bit storage, so IDs above 255 are not truncated.
- Online Durable Object chunk edits use a 16-bit no-edit sentinel (65535).
- Existing 8-bit saved chunk-edit records migrate on load: legacy sentinel 255 becomes 65535 and existing IDs are preserved.
- Regression tests cover high IDs, persistence ordering, and legacy migration.

## Still missing or unverified
- Runtime behavior remains partial. Identifier-only reference catalogs are available for 1288 client blockstate paths and 1658 item identifiers from the attached 26.3 client data; this is not a complete block/item/entity registry or gameplay implementation. Textures, recipes, drops, state properties, and entity behaviors remain incomplete.
- Complete Overworld/Nether/End behavior and other Java dimensions.
- Vanilla structures and structure generation (villages, mineshafts, strongholds, temples, trial chambers, etc.).
- TypeScript/Vite build, browser, Cloudflare, and actual multiplayer runtime unless separately verified.
