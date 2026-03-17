# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server (Create React App)
npm run build      # Production build
npm test           # Run tests (jest with jsdom)
```

No linter or formatter is configured.

## Architecture

This is a React 16.8 app (Create React App) that displays a 3D image carousel powered by Cloudinary. Originally built in CodeSandbox.

### Component Flow

```
index.js → PhoneDetector (mobile.js)
              └→ FullScreenButton (fs.js)
                    ├→ FireApp (logo.js)       — logo with hover brightness animation
                    └→ Example (example.js)    — 3D carousel (react-spring-3d-carousel)
                          └→ RandomImage (random.js) × 8 slides
```

- **PhoneDetector** detects mobile via user agent but currently renders the same layout for both paths
- **FullScreenButton** wraps the app content and provides a fullscreen toggle button (top-left, cross-browser)
- **Example** is a class component managing carousel state, touch swipe, and keyboard arrow navigation. Debug controls (slide position, animation config) are commented out in the render
- **RandomImage** fetches the image list from `https://res.cloudinary.com/{cloud_name}/image/list/{tag}.json`, picks a random image avoiding repeats via a module-level `usedIndexes` array, and renders it with `@cloudinary/react` `AdvancedImage`
- **src.js** (`RandomImageWithSrc`) extracts `src` from an HTML image tag string — not used in the main component tree

### Key External Dependencies

- **Cloudinary** (`@cloudinary/react`, `@cloudinary/url-gen`) — cloud name `dqm00mcjs`, tag `carousel`
- **react-spring-3d-carousel** — the carousel widget (uses react-spring internally)

### File Layout

All source files are flat in `src/` with no subdirectories. Styles are in `src/styles.css` (global/body) and `src/logo.css` (logo animation). Background image is `src/bg.jpg`.
