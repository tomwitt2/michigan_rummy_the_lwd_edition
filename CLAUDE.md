# Project: Family-Deck Multiplayer Engine

Status: Scaffolding Phase

## Technical Stack
- Engine: boardgame.io
- Frontend: React 18 / Tailwind
- Build: Vite
- Infrastructure: Docker / AWS
- ES Modules (`"type": "module"` in package.json)

## Commands
- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm test` — Run Jest tests (uses `--experimental-vm-modules` for ESM support)

## Project Structure
- `src/` — Application source (React + boardgame.io)
  - `src/game/` — Game logic
  - `src/App.jsx` — Root React component
  - `src/main.jsx` — Entry point
- `dist/` — Build output
- `vite.config.js` — Vite configuration

## Browser Testing
Chrome integration is available for interactive testing. Install the
[Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn),
then ask Claude to open the dev server and interact with the game UI.
- CLI: launch with `claude --chrome` or type `/chrome` mid-session
- VSCode extension: available automatically once the Chrome extension is installed
