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
- The neutral zone has 24 additional fuel compared with the previous layout.
- Each outpost has a 24 fuel stack in front of it.
- Red outpost fuel is placed on the lower red wall side.
- Blue outpost fuel is mirrored on the upper blue wall side.

## Audio notes

Audio cues now live in `src/assets/audio/` and are loaded by `src/scripts/audio.js`. The exact original embedded base64 audio blobs were not present in the refactored repo, so this update includes source-managed cue files plus a generated fallback. To restore the original sounds byte-for-byte, replace the WAV files in `src/assets/audio/` with the original cue files and keep the same filenames, or update `AUDIO_SOURCES` in `audio.js`.
