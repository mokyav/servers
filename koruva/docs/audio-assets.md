# Koruva audio assets

Koruva's client audio engine loads OGG effects from
`src/client/public/assets/sounds/` and reads the generated `manifest.json`.

## Prepare the optional sound bundle

1. Extract the supplied Minecraft sound archive to a folder.
2. From the `koruva` project directory, run:

```sh
node scripts/copy-sounds.mjs "/path/to/extracted/MinecraftSounds"
```

The script accepts either the extracted asset root or the sound folder itself. It recognizes layouts containing
`assets/minecraft/sounds/`, `minecraft/sounds/`, or folders such as `dig/` and `step/`.

It copies only gameplay sound effects used by the client, excludes music, and prints the actual number and total size
of copied OGG files. The exact count depends on the Minecraft sound archive version and its contents.

## Build and deploy

Run the normal project commands after the script has completed:

```sh
npm run build
npm run deploy
```

The generated sound folder is ignored by Git to avoid accidentally committing or redistributing extracted game audio.
It must therefore exist in the environment that performs the production build/deploy. When the sound folder or manifest
is absent, Koruva remains playable and the audio engine simply stays silent.
