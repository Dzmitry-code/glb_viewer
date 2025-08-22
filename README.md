# Three.js GLB Viewer (GitHub Pages Ready)

A zero-build Three.js starter that **just works on GitHub Pages**. It loads a `.glb` placed in `assets/model.glb`, supports **drag & drop**, `?model=...` URL param, DRACO-compressed meshes, and KTX2 textures.

## Quick start

1. **Put your model** at `assets/model.glb` (or keep any path you like).
2. Commit & push this folder to a GitHub repo.
3. In **Settings → Pages**, set the branch to `main` (or whichever) and the root to `/`.
4. Open your site. It will auto-try `assets/model.glb`.  
   You can also use a query parameter: `?model=assets/yourModel.glb`.

> 💡 No bundler, no `npm run dev`. We use an **import map** pinned to a Three.js version so the browser can load modules directly from a CDN.

## Features

- ES modules via Import Map (no build step)
- Orbit controls, shadows, simple lighting
- Progress bar + load status
- Drag & drop `.glb/.gltf` files
- URL param: `?model=...`
- **DRACO** + **KTX2** support via CDN decoders/transcoders

## Common pitfalls

- **404**: Check the path/casing of your GLB. On GitHub Pages, file names are case-sensitive.
- **Textures missing** in `.gltf`: Ensure the `.bin` and texture files sit next to the `.gltf` with correct relative paths.
- If you used **Draco compression**, it's supported (we load the decoder from Google CDN). If you used **KTX2/Basis**, the transcoder is also wired.
- If you previously saw `Failed to resolve module specifier "three"` on GitHub Pages, this starter avoids that by mapping `"three"` and `"three/addons/"` to CDN URLs.

## Customize

- Change the pinned Three.js version in the import map inside `index.html`.
- Tweak lights and tone mapping in `js/main.js`.
