# Repository guidance

## Run and verify
- Open `src/index.html` directly in a browser; this is a static app with no package manifest, dependency install, or build step.
- Run regression tests with `node --test tests/power-pellets.test.cjs`; no dependency install is needed. Tests run the classic scripts in a VM with a simulated DOM/canvas, not a real browser.
- No lint, typecheck, or CI configuration exists. Verify visuals in the browser: pellets, vulnerable ghosts, flashing, returning eyes, overlays, and restart. Check the browser console for errors.

## Runtime constraints
- `src/index.html` loads classic scripts in dependency order: `maze.js` → `game.js` → `render.js` → `main.js`. They share global bindings; do not introduce module imports/exports or reorder scripts without updating the loading model.
- `main.js` owns DOM events, overlays, and the animation loop; `game.js` owns state/rules; `render.js` draws the canvas. `update(game)` is called only while playing, but drawing continues in all states.
- Movement speeds are cells per animation frame, not per second. Turns and wall checks happen at integer-cell alignment; speed changes must preserve that alignment or movement can pass through walls.
- `MAZE` is the pristine template; mutate only the per-game `game.grid` copy. Rendering and dot counts use that copy. Losing a life resets positions but preserves eaten dots and score; restarting creates a fresh game.
- Tile values are `0` empty, `1` wall, `2` dot, `3` ghost-house door, `4` power pellet. `dotsRemaining` counts both dots and pellets. Doors block Pac-Man but not ghosts; horizontal wrapping is restricted to `TUNNEL_ROW`.
- Board sizing is coupled: the maze is 28×31, `render.js` uses `TILE = 20`, and both the canvas attributes in `src/index.html` and `#game-wrap` in `src/css/style.css` are 560×620. Coordinate geometry changes across these files together.

## Spec workflow
- For the user-invoked spec workflows, read `.agents/skills/spec/SKILL.md` or `.agents/skills/spec-impl/SKILL.md` rather than inventing the process. The spec template is `.agents/skills/spec/template.md`.
- Specs use `specs/NN-slug.md`. `/spec` creates drafts, and `/spec-impl` requires human approval before implementation and pauses for review between steps. Branch behavior is controlled by `specs/.spec-config.yml` (`AutoCreateBranch` defaults to `true`).
