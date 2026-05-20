# FRC 2026 Local Multiplayer

A static browser game for GitHub Pages. The project uses plain HTML, CSS, and ES modules so it can be hosted without a build step.

## Project layout

```text
.
├── index.html
├── src
│   ├── assets
│   │   └── audio
│   ├── scripts
│   │   ├── audio.js
│   │   ├── constants.js
│   │   ├── dom.js
│   │   ├── field.js
│   │   ├── game.js
│   │   ├── input.js
│   │   ├── main.js
│   │   ├── match.js
│   │   ├── math.js
│   │   ├── robot.js
│   │   ├── state.js
│   │   └── ui.js
│   └── styles
│       └── main.css
└── README.md
```

## Running locally

Because the JavaScript uses ES module imports, run it from a local server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

This repo is ready to deploy from the repository root. In GitHub, go to:

```text
Settings > Pages > Build and deployment > Deploy from a branch
```

Select the branch and `/root` as the publishing source.

## Current gameplay notes

- P1 starts on keyboard.
- P2 now starts on keyboard by default.
- Both robots start with 8 fuel.
- The neutral zone has 32 additional fuel compared with the previous layout.
- Outposts are outside the field boundary, with their inner edge aligned to the arena wall and a larger visual box for readable status text.
- Red outpost is on the lower red wall side.
- Blue outpost is mirrored on the upper blue wall side.
- Each outpost starts with 24 fuel in its feeder.
- Each outpost can hold 48 total fuel.
- Each outpost feeder holds up to 24 fuel, feeds robots at 18 fuel per second, and refills from reserve at 8 fuel per second.
- Three human players per active outpost throw fuel toward their hub at randomized 0.5 to 1.5 fuel per second each.
- Field fuel that reaches an outpost opening is stored in that outpost if space is available.

## Audio notes

Audio cues now live in `src/assets/audio/` and are loaded by `src/scripts/audio.js`. The exact original embedded base64 audio blobs were not present in the refactored repo, so this update includes source-managed cue files plus a generated fallback. To restore the original sounds byte-for-byte, replace the WAV files in `src/assets/audio/` with the original cue files and keep the same filenames, or update `AUDIO_SOURCES` in `audio.js`.

## Human player controls

Each alliance has an outpost toggle in the right control panel and a keyboard shortcut.

- `Q` toggles the red outpost.
- `Right Alt` toggles the blue outpost, or the red outpost in co-op mode.
- Controller `Y` toggles the controller player's alliance outpost.
- `OUTPOST: SHOOT` means human players shoot when their hub is active.
- `OUTPOST: FEED` means human players stop shooting so fuel stays available for robot loading.
- Robot loading is automatic when a robot contacts the outpost wall.
- Humans stop shooting 2 seconds before the current hub window closes.
- The outpost box shows only `SHOOT` or `FEED`, plus total fuel and loader fuel.
