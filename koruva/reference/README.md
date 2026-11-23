# Minecraft Java 26.3 reference assets

This directory contains source/reference files extracted from the supplied official Minecraft Java 26.3 client archive.

- `minecraft-data/` is the vanilla data-pack tree (loot tables, recipes, world-generation data, tags, and related JSON/NBT assets). It is retained for future implementation/reference work, but the current Koruva runtime does not load it from the web root.
- `minecraft-texture-archives/` contains the original packed texture archives. The unpacked PNG files used by the game remain under `src/client/public/assets/minecraft/textures/`.

These files are intentionally outside Vite's `public/` directory so they are not copied into the downloadable/deployed client bundle. Do not delete them without checking for new runtime references first.
