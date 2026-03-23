# The Dreambook — Art Card Creation Page

**Date**: 2026-03-23
**Status**: Approved
**Author**: JP + Claude

## Summary

Add an art card creation page to artcardsv5 themed as a mystical "Dreambook" — a dreaming-magic interface where users write dream visions and watch cards crystallize from AI-generated imagery. Uses Flux-1.1-pro and gpt-image-1.5 via Azure OpenAI, with Claude generating poetic card metadata. All generation settings live in the Dreambook's pages, themed as dream magic.

## Architecture

```
Browser (GitHub Pages)              Vercel Serverless
┌──────────────────────┐           ┌─────────────────────────┐
│  CardCreator.js      │──POST────▶│ api/generate/cast.js    │
│  (Dreambook UI)      │           │  → Azure OpenAI API     │
│                      │◀──b64─────│  (FLUX / gpt-image-1.5) │
│                      │           └─────────────────────────┘
│  Upload to InstantDB │           ┌─────────────────────────┐
│  $files + creations  │──POST────▶│ api/generate/divine.js  │
│                      │           │  → Anthropic Claude API  │
│                      │◀──meta────│  (name, desc, keywords)  │
└──────────────────────┘           └─────────────────────────┘
```

## Dreambook UI — Four Pages

### Page 1: Dream Vision (Prompt)
- Large glowing textarea with dreamy border (indigo/violet glow)
- **Dream type selector**: "Dreamscape Background", "Dream Element", "Freeform", "Custom"
- Each type applies a prompt prefix modeled after Dreamspace:
  - Background: therapeutic atmospheric prefix (from Dreamspace config)
  - Element: clean cutout prefix with transparent background
  - Freeform: no prefix
  - Custom: user-editable prefix
- Character counter styled with moon-phase numerals
- Placeholder text: "Describe your dream..."

### Page 2: Dream Depths (Generation Settings)
- **Model**: Flux-1.1-pro (lush backgrounds) / gpt-image-1.5 (elements, native transparency)
- **Aspect Ratio**: Square 1024x1024 (card default), Landscape 1536x1024, Portrait 1024x1536
  - Flux: auto-clamped to 1440px max dimension (per Dreamspace pattern)
- **Quality**: Standard / HD
- **Transparency**: Toggle (auto-on for element type, uses gpt-image background:transparent)
- Controls styled as dream-depth sliders with star/moon decorations

### Page 3: Dream Essences (Style Presets)
- 7 essence medallions (from Dreamspace style transfer presets):
  - Fairy Tale, Oil Painting, Anime, Watercolor, Dark Fantasy, Ethereal, Mythological
- Each medallion: circular with dream-catcher border, icon, name
- Clicking activates (glows) — appends style suffix to prompt
- Multiple essences can combine
- Visual: medallions float like dream fragments

### Page 4: Dream Journal (Creation History)
- Grid of past creations from `creations` InstantDB entity
- Each card shows: thumbnail, dream name, date, model used
- Actions: view full-size (lightbox), re-dream (populate settings), promote to card collection
- Filter by date, essence, model
- Requires auth — shows only user's own creations

## Casting (Generation) Flow

1. User writes dream vision + selects settings in Dreambook pages
2. Presses **"Dream"** button (crescent moon sigil)
3. **Dreaming animation**:
   - Screen softens with a sleep veil (backdrop blur + indigo overlay)
   - Stars drift across the veil
   - A mandala coalesces from mist at center
   - Pulsing glow indicates generation in progress
4. `POST api/generate/cast.js` → Azure OpenAI with model + prompt + size
5. Image returns as base64
6. Card **crystallizes** from the dream — edges form from stardust, image fades in
7. `POST api/generate/divine.js` → Claude generates card metadata:
   - `name`: 2-4 word poetic dream name
   - `description`: 2-3 sentence symbolic interpretation
   - `keywords`: 3-5 archetypal dream themes
8. Card appears with moonlight wash, name and description overlay
9. Image uploaded to InstantDB `$files` at `dreambook/cards/{uuid}.png`
10. Record written to `creations` entity
11. User can: **Collect** (add to hand), **Save to Deck**, or **Dream Again**

## File Manifest

### New Files

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/card-creator.js` | Dreambook component — all 4 pages, casting flow, card display | 500-600 |
| `src/card-creator.css` | Dreambook styles — book UI, pages, animations, dreaming veil | 700-900 |
| `src/generate-api.js` | API wrapper for cast + divine endpoints | 60-80 |
| `api/generate/cast.js` | Vercel: proxies to Azure OpenAI for image generation | 80-100 |
| `api/generate/divine.js` | Vercel: proxies to Anthropic Claude for card metadata | 60-80 |

### Modified Files

| File | Change |
|------|--------|
| `src/fs.js` | Add `viewMode === "create"` branch, navigation button, pass refs |
| `instant.perms.ts` | Add `create` permission for `creations` (auth.id == data.userId) |
| `src/db.js` | Verify creations entity schema matches needs (may need model/style fields) |
| `.env.example` | Add `REACT_APP_GENERATE_API_URL` |

### Schema Updates

**`creations` entity** (extend existing):
```
imagePath: string    — InstantDB $files path (existing)
type: string         — "background" | "element" | "freeform" (existing)
prompt: string       — user's dream vision (existing)
userId: string       — creator (existing)
createdAt: number    — timestamp (existing)
model: string        — "flux-1.1-pro" | "gpt-image-1.5" (NEW)
style: string        — comma-separated essences (NEW)
cardName: string     — Claude-generated name (NEW)
cardDescription: string — Claude-generated description (NEW)
cardKeywords: json   — Claude-generated keywords array (NEW)
aspectRatio: string  — "1:1" | "3:2" | "2:3" (NEW)
```

**Permissions** (`instant.perms.ts`):
```
creations: {
  allow: {
    view: "true",                    // public read (existing)
    create: "auth.id == data.userId", // authenticated create (NEW)
    delete: "auth.id == data.userId"  // owner delete (NEW)
  }
}
```

## Environment Variables (Vercel)

```
AZURE_OPENAI_ENDPOINT    — Azure OpenAI API base URL (for FLUX + gpt-image)
AZURE_OPENAI_API_KEY     — Azure API key
ANTHROPIC_API_KEY        — For Claude card divination
```

## Visual Theme

- **Color palette**: Indigo (#2d1b69), violet (#7c3aed), midnight blue (#1e1b4b), gold accents (#d4a574)
- **Book texture**: CSS gradient dark leather with subtle grain
- **Decorations**: Crescent moons, closed-eye motifs, star particles, dream-catcher geometry
- **Typography**: Cinzel for page titles and card names, Inter for body text
- **Animations**: CSS keyframes for star drift, mandala spin, crystallize, moonlight wash
- **Theme support**: Both dark and light via `prefers-color-scheme`
- **Card back**: Reuses existing sacred-geometry card-back pattern as mandala base

## Prompt Engineering (from Dreamspace)

### Background Prefix
```
immersive atmospheric background for a therapeutic art collage, edge-to-edge composition
with no central focal object, rich layered depth and luminous soft lighting, painterly
textures blending watercolor washes with subtle grain, dreamlike and emotionally evocative,
soft color transitions, gentle gradients of light and shadow that invite projection and
contemplation —
```

### Element Prefix
```
clean digital illustration for collage cutout, complete subject fully visible, centered
with generous empty space on all sides, plain solid white background, no shadows, no
ground, sharp edges —
```

### Card Divination Prompt (Claude)
```
You are a dream oracle. Given this AI-generated artwork born from a dream vision,
divine its true name and meaning.

Return JSON:
{
  "name": "2-4 word poetic dream name",
  "description": "2-3 sentence symbolic interpretation connecting the imagery to
                  dream archetypes and emotional resonance",
  "keywords": ["3-5 archetypal dream themes"]
}
```

## Integration with Existing App

- Created cards appear in the Dreamscape collection on the card table (same `cards` entity path)
- Promoting a creation to a card: copies from `creations` → `cards` entity with full metadata
- Collected cards work with existing Hand/Decks/Spread system
- Dream Journal entries link back to the card table via `focusCard()` ref

## Auth Requirement

- Dreambook requires sign-in (Google OAuth or magic code)
- Unauthenticated users see a dreamy "Sign in to enter the Dreambook" prompt
- All creations bound to `userId` from InstantDB auth

## Rate Limiting

- Client-side: disable Dream button for 10 seconds after each cast
- Server-side: consider Vercel rate limiting middleware (future enhancement)

## Error States

- **Generation failed**: "The dream faded..." message with retry option
- **Not authenticated**: Dreamy sign-in prompt
- **Network error**: "The dream realm is unreachable..." with retry
- **Rate limited**: "Rest your mind... try again in a moment"
