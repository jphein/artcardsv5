# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server (Create React App)
npm run build      # Production build
npm test           # Run tests (jest with jsdom) — no test files exist yet
npm run deploy     # Manual deploy to GitHub Pages (auto-deploy on push to main via Actions)
```

No linter or formatter is configured.

## Architecture

React 16.8 app (Create React App) displaying a 3D art card carousel powered by Cloudinary. Hosted on GitHub Pages at `https://jphein.github.io/artcardsv5`.

### Component Flow

```
index.js → PhoneDetector (mobile.js)
              └→ FullScreenButton (fs.js)
                    ├→ FireApp (logo.js)          — Logo with golden aura + sparkle effects
                    ├→ Example (example.js)       — 3D carousel, fetches images, custom nav buttons
                    │     └→ RandomImage (random.js) — Pure display component, draggable
                    └→ CardPanel (panel.js)        — Slide-up dock for collecting cards
```

### Key Patterns

- **Single fetch, stable images** — `Example` fetches the Cloudinary image list once in `componentDidMount`, Fisher-Yates shuffles it, stores in state. Images only re-randomize on page refresh. `RandomImage` is a stateless display component that receives `public_id` as a prop.
- **Drag-and-drop** — Uses HTML5 `dataTransfer` API. `RandomImage` serializes `{ public_id, cloud_name, slideIndex }` as JSON. `CardPanel` deserializes on drop. No shared state or prop drilling needed between carousel and dock.
- **Navigate-back** — `fs.js` holds a ref to the `Example` class component. Clicking a docked card calls `setState({ goToSlide, config, flash })` directly on Example, using a fast spring config (`tension: 1000, friction: 35`) with a golden flash overlay that fades out to mask the transition.
- **Mixed component styles** — `Example` is a class component (carousel state, lifecycle methods). Everything else uses hooks. This is intentional given the ref-based communication pattern.

### Visual Theme

Ornate dark/gold filigree aesthetic throughout:
- **nav.css** — Gold gradient nav buttons with corner filigree, shimmer animation, golden glow on hover
- **panel.css** — Semi-opaque dock with gold borders and gradient border-image
- **logo.css** — Golden aura (`::before`), sparkle particles (`::after`), multi-layer drop-shadows
- **styles.css** — Two layers of canvas-wide sparkle particles on `.App::before` and `::after`

### External Dependencies

- **Cloudinary** (`@cloudinary/react`, `@cloudinary/url-gen`) — cloud name `dqm00mcjs`, tag `carousel`. Public read-only endpoint, no API keys.
- **react-spring-3d-carousel** — 3D carousel widget (uses react-spring internally for spring physics)

### Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) auto-deploys to GitHub Pages on every push to `main`. Manual deploy available via `npm run deploy` (gh-pages package).

### Workflow Preferences

- When walking the user through steps that involve copying text (URLs, IDs, config values, commands, etc.), always copy the value to the clipboard using `xclip` or `xsel` so the user can just paste it.

### File Layout

All source files are flat in `src/` with no subdirectories. CSS is split by component: `styles.css` (global/body), `logo.css`, `nav.css`, `panel.css`. Static assets: `bg.jpg` (starry background), `logo.png`. `src/src.js` is unused.
