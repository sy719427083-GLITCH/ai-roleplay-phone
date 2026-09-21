# Complete office scene implementation plan

User approved restoring the full scene and extending only the surrounding wall/floor background. Keep the existing atlas, scene coordinates, people, persistence and controls unchanged.

- [x] Replace cover max() dimensions with contain min() dimensions in src/workOffice.css, retaining exact 853:1606 scene ratio.
- [x] Fill .ow-floor with pale wall/floor gradients and soft daylight; the centered scene remains opaque and completely visible. Decorative background has no interaction or extra assets.
- [x] Verify browser screenshots at 390×844, 430×932 and 390×700; all four stage edges must fit inside the floor, with no distortion.
- [x] Record design constraint in AGENTS.md, bump patch version, run tests/build, publish through existing GitHub Pages workflow and verify live.
