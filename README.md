# FRC 2026 Local Multiplayer

A static browser game for GitHub Pages. The project uses plain HTML, CSS, and ES modules so it can be hosted without a build step.

## Project layout

```text
.
├── index.html
├── src
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

## Notes

The original single-file version embedded very large base64 audio data directly in JavaScript. This refactor replaces that with small generated Web Audio cues. That keeps the repo readable and prevents audio assets from dominating the source files.
