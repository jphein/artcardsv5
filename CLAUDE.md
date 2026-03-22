# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Creative Sight Art Cards** — an interactive art card experience with a mystical/tarot aesthetic. Users explore AI-generated art cards on a virtual table, collect them into a hand, arrange them in tarot-style spreads, save/load named decks, and optionally publish physical card decks via The Game Crafter.

Live at `https://jphein.github.io/artcardsv5`.

## Commands

```bash
npm start          # Dev server (Create React App, port 3000)
npm run build      # Production build to build/
npm test           # Run tests (jest + jsdom) — no test files exist yet
npm run deploy     # Manual deploy to GitHub Pages (builds first via predeploy)
```

## Tech Stack

| Dependency | Version | Purpose |
|------------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering (createRoot API) |
| react-scripts | 5.0.1 | CRA build tooling |
| @instantdb/react | ^0.22.164 | Real-time database: auth, decks, cards, preferences, file storage |
| @cloudinary/react | ^1.9.0 | Image rendering (`AdvancedImage`) |
| @cloudinary/url-gen | ^1.8.7 | Cloudinary URL construction |
| react-spring-3d-carousel | ^1.3.4 | 3D carousel widget |
| uuid | ^13.0.0 | UUID generation |
| gh-pages | ^6.3.0 | (dev) GitHub Pages deployment |

## Architecture

### Component Tree

```
index.js → App → PhoneDetector (mobile.js)
                    └→ FullScreenButton (fs.js)
                          ├→ FireApp (logo.js)
                          ├→ CardTable (card-table.js)        — DEFAULT VIEW
                          │     └→ CardBack (card-back.js)
                          ├→ Example (example.js)             — ALTERNATE: 3D carousel
                          │     ├→ RandomImage (random.js)
                          │     └→ CarouselHints (inline)
                          ├→ CardPanel (panel.js)             — Bottom dock: Hand / Decks / Spread
                          │     ├→ SpreadView (spread-view.js)
                          │     │     ├→ DeckManager (deck-manager.js)
                          │     │     └→ CardBack
                          │     ├→ Lightbox (lightbox.js)
                          │     └→ SPREAD_LAYOUTS (spread-layouts.js)
                          ├→ PhysicalCardsSeal (physical-cards.js)
                          ├→ SettingsMenu (settings-menu.js)
                          ├→ HelpOverlay (help-overlay.js)
                          └→ AuthButton (auth-button.js)
```

### View Modes

- **Table** (default) — Chaos scatter, Vortex golden spiral, Oracle arc layouts. Drag, scale, rotate, flip, 3D tilt.
- **Carousel** — 3D spring-physics carousel. Arrows/swipe/scroll nav. Drag to dock.

### Data Flow

- **Images**: Cloudinary + InstantDB Dreamscape cards, Fisher-Yates shuffled.
- **Card collection**: Drag to dock. Tabs: Hand, Decks, Spread.
- **Navigate-back**: Docked card click → `CardTable.focusCard()` via ref.
- **Preferences**: `usePreferences` hook → InstantDB (logged in) or localStorage (logged out), 300ms debounce.

### Backend: InstantDB

| Entity | Purpose |
|--------|---------|
| `decks` | Named card collections with spread type, per-user |
| `cards` | Dreamscape card metadata |
| `creations` | AI-generated card records |
| `preferences` | User settings as key/value |
| `$files` | File storage with signed URLs |

Auth: Google OAuth + magic code email. Permissions: decks owner-only, others public-read.

### Serverless API: Vercel + The Game Crafter

| Endpoint | Purpose |
|----------|---------|
| `POST /api/gamecrafter/publish` | Create TGC game, upload cards, publish |
| `POST /api/gamecrafter/status` | Check publication status |
| `POST /api/gamecrafter/price` | Estimate deck price |

Vercel env vars: `TGC_API_KEY`, `TGC_USERNAME`, `TGC_PASSWORD`.

### Key Patterns

- Mixed component styles (class for carousel, hooks everywhere else)
- Imperative refs for cross-component actions (`focusCard`, collect/uncollect)
- CloudinaryImage Map cache per component
- Pointer events for zero-lag drag (raw DOM → React state on release)
- Contextual hints with localStorage persistence
- Dual image sources (Cloudinary + InstantDB)

## Environment Variables

```
REACT_APP_INSTANTDB_ID=<instantdb-app-id>
REACT_APP_TGC_PROXY_URL=<vercel-api-url>     # Optional
```

## Source Files

### JavaScript (22 files, ~3,350 lines)

| File | Lines | Description |
|------|-------|-------------|
| `index.js` | 13 | Entry point |
| `mobile.js` | 10 | PhoneDetector wrapper |
| `fs.js` | 99 | Layout shell, view mode, refs |
| `logo.js` | 26 | Logo with hover animation |
| `card-table.js` | 806 | Table view: deal, layouts, drag, scale, rotate, flip, tilt |
| `card-back.js` | 34 | Sacred geometry card back (CSS-only) |
| `example.js` | 188 | 3D carousel (class component) |
| `random.js` | 29 | Draggable Cloudinary card |
| `panel.js` | 602 | Dock: Hand/Decks/Spread, drag-drop, deck CRUD, TGC publish |
| `spread-view.js` | 508 | Spread overlay: positioned cards, dealing animation |
| `spread-layouts.js` | 148 | 5 spread layout definitions |
| `deck-manager.js` | 171 | Deck save/load/delete |
| `lightbox.js` | 35 | Full-screen card viewer |
| `auth-button.js` | 168 | Google OAuth + magic code |
| `db.js` | 46 | InstantDB client init |
| `use-preferences.js` | 119 | Preferences hook |
| `hints.js` | 136 | Contextual hint system |
| `help-overlay.js` | 217 | Help panel |
| `settings-menu.js` | 113 | Settings: animation speed, auto-deal, spread type |
| `physical-cards.js` | 53 | Physical cards seal |
| `welcome.js` | 162 | Onboarding overlay |
| `gamecrafter.js` | 50 | TGC API wrapper |

### CSS (15 files, ~6,680 lines)

| File | Lines | Description |
|------|-------|-------------|
| `styles.css` | 214 | Global styles, sparkle animations |
| `card-table.css` | 820 | Table view styles |
| `panel.css` | 1,466 | Dock panel styles |
| `spread-view.css` | 745 | Spread overlay styles |
| `deck-manager.css` | 490 | Deck manager styles |
| `card-back.css` | 368 | Card back ornamental styles |
| `welcome.css` | 346 | Welcome overlay |
| `auth-button.css` | 341 | Auth forms |
| `settings-menu.css` | 332 | Settings panel |
| `nav.css` | 328 | Carousel nav buttons |
| `help-overlay.css` | 299 | Help panel |
| `logo.css` | 137 | Logo with golden aura |
| `physical-cards.css` | 171 | Physical cards seal |
| `lightbox.css` | 146 | Lightbox overlay |
| `hints.css` | 121 | Hint tooltips |

### Serverless API (`api/gamecrafter/`)

`publish.js` (271L), `status.js` (94L), `price.js` (59L)

## Spread Layouts

Single (1), Three Card (3), Four Elements (4), Five Card Cross (5), Freeform (unlimited)

## Deployment

1. **GitHub Pages** (frontend): Auto-deploy on push to main via GitHub Actions.
2. **Vercel** (API only): Hosts `api/gamecrafter/*` functions.

External services: Cloudinary (cloud `dqm00mcjs`), InstantDB, The Game Crafter.

## Visual Theme

Ornate dark/gold filigree: starry bg, golden aura logo, 3D tilt cards, sacred geometry card backs, gold gradient nav, semi-transparent dock.

## Workflow Preferences

- Copy values to clipboard with `xclip` when walking through steps.

## File Layout

All source flat in `src/`. CSS co-located with components. Serverless in `api/gamecrafter/`. InstantDB config at project root.
