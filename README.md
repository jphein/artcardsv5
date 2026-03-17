# Creative Sight Art Cards

A magical 3D image carousel showcasing artwork from Cloudinary, with an ornate gold-themed UI inspired by fantasy card games.

**Live:** [jphein.github.io/artcardsv5](https://jphein.github.io/artcardsv5)

## Features

- **3D Carousel** — Browse artwork in a spring-physics 3D carousel. Images are shuffled on each page load.
- **Multiple Navigation Methods** — Scroll wheel, keyboard arrows, touch swipe, click on side cards, or use the ornate gold navigation buttons.
- **Card Dock** — Drag any card from the carousel onto the bottom panel to save it. Click a saved card to spin back to it in the carousel. Drag over the tab to auto-open the dock.
- **Fullscreen Mode** — Toggle fullscreen with the top-left button. Starry background persists in fullscreen.
- **Gold Filigree Aesthetic** — Navigation buttons, dock panel, and logo all share an ornate dark/gold theme with shimmer animations and sparkle particle effects across the canvas.

## Getting Started

```bash
npm install
npm start
```

Opens at [localhost:3000](http://localhost:3000).

## Build & Deploy

```bash
npm run build       # Production build
npm run deploy      # Manual deploy to GitHub Pages
```

Pushing to `main` automatically deploys via GitHub Actions.

## Architecture

```
index.js → PhoneDetector (mobile.js)
              └→ FullScreenButton (fs.js)
                    ├→ FireApp (logo.js)          — Logo with golden aura + sparkles
                    ├→ Example (example.js)       — 3D carousel + ornate nav buttons
                    │     └→ RandomImage (random.js) — Draggable Cloudinary image
                    └→ CardPanel (panel.js)        — Slide-up dock for saved cards
```

**Data flow:** `Example` fetches the Cloudinary image list once on mount, shuffles it, and passes `public_id` to each `RandomImage`. Cards dragged to the dock carry their `public_id`, `cloud_name`, and `slideIndex` via HTML5 drag-and-drop `dataTransfer`. Clicking a docked card sends `slideIndex` back to `Example` via a ref, with a fast spring config and golden flash overlay to mask the transition.

## Tech Stack

- **React 16.8** (Create React App)
- **Cloudinary** (`@cloudinary/react`, `@cloudinary/url-gen`) — image hosting and delivery
- **react-spring-3d-carousel** — 3D carousel with spring physics
- **GitHub Pages** — hosting via Actions workflow
