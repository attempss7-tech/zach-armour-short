# Could ancient armour stop a bullet?

A Zach-d-films style 3D cartoon "what if" short (9:16), built entirely in
code with three.js. 9 shots, 24.8 seconds, 745 frames at 30 fps.

- `src/shots.js` is the edit: captions, fades, duration and one function per shot.
- `audio/vo.wav` is the voiceover (Warm Pebble voice). Captions in `shots.js`
  are timed to it via `audio/vo.words.json`.
- `render.mjs` renders stills or a full video locally (SwiftShader software
  WebGL: `GL=swiftshader node render.mjs stills 1.0,5.3,12.0,21.5 stills`).
- `render_shard.mjs` renders one frame-range shard and encodes it to a
  segment mp4; the GitHub Actions workflows use it to render in parallel.

## Render on GitHub Actions

1. Trigger the `stills` workflow and check the four stills look right.
2. Trigger the `render` workflow: 10 matrix shards render the 745 frames in
   parallel, then the `combine` job concats the segments, scales to
   1080x1920, muxes the voiceover (loudnorm -14 LUFS) and uploads
   `zach-armour-short.mp4` as an artifact.
