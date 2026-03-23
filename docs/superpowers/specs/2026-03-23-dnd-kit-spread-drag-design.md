# @dnd-kit Spread Drag Integration

**Date**: 2026-03-23
**Status**: Implemented (Phase 1-2)

## Problem

Dragging cards in spread mode is clunky. The current implementation uses ~80 lines of raw pointer events for free-drag, HTML5 drag/drop for dock-to-spread, and has no reorder capability for positioned spreads.

## Solution

Replace spread drag interactions with `@dnd-kit/core` for accessible, touch-friendly drag-and-drop with swap-based reorder for positioned spreads.

## Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | ^6.3.1 | DndContext, useDraggable, useDroppable, DragOverlay, sensors |
| `@dnd-kit/sortable` | ^10.0.0 | arraySwap utility (SortableContext not used — see design rationale) |
| `@dnd-kit/utilities` | ^3.2.2 | CSS.Transform helper |

## Design Rationale

**Why not SortableContext for positioned spreads?** The positioned spread layouts (3-card, 4-element, 5-card cross) use complex CSS transforms with percentage-based offsets and rotations — not a standard list/grid layout. SortableContext's sorting strategies (vertical, horizontal, rect) assume reflow-based positioning. Instead, we use:
- `useDraggable` per card + `useDroppable` per position slot
- `DragOverlay` for visual drag feedback
- Manual swap logic in `onDragEnd` based on collision detection

**Why swap instead of shift?** In tarot spreads, each position has semantic meaning (e.g., "Past", "Present", "Future"). Drag card A onto position B → they swap. This preserves spread semantics. Shift-based reorder (where intermediate cards move) would be confusing.

**Why no Shift+drag mode switch?** Removed per spec review. `onDragEnd` doesn't carry keyboard modifier state, and tracking Shift via refs adds fragile complexity. Instead: positioned spreads = reorder by swap, freeform = free-position. Clean separation.

## Architecture

### DndContext Placement

```
SpreadView (owns DndContext)
  ├── DndContext (sensors, collision detection, handlers)
  │   ├── cardsContainer
  │   │   ├── DroppableSlot[slot-0] → DraggableCard[card.public_id]
  │   │   ├── DroppableSlot[slot-1] → DraggableCard[card.public_id]
  │   │   └── DroppableSlot[slot-N] (empty slots)
  │   └── DragOverlay → card clone
  ├── DeckManager
  └── Collection cards (HTML5 drag, separate from DndContext)
```

DndContext is scoped to spread-view.js only. Collection-to-spread and dock-to-spread still use HTML5 drag/drop — these are Phase 3.

### Sensor Configuration

```js
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  useSensor(KeyboardSensor),
);
```

## Interaction Model

| Interaction | Spread Type | Mechanism |
|---|---|---|
| Drag to swap positions | Positioned (3/4/5-card) | `useDraggable` + `useDroppable` → swap in onDragEnd |
| Drag to free-position | Freeform | `useDraggable` → delta applied to position state |
| Dock-to-spread drop | All | HTML5 drag/drop (existing, Phase 3 for @dnd-kit) |
| Collection-to-spread | All | HTML5 drag/drop (existing, Phase 3 for @dnd-kit) |

## Component Changes

### spread-view.js (rewritten)

- **Added**: `DraggableCard` inline component wrapping `useDraggable`
- **Added**: `DroppableSlot` inline component wrapping `useDroppable`
- **Added**: `DndContext` with sensors, `DragOverlay` with card clone
- **Removed**: Raw pointer event handlers (~80 lines: handlePointerDown, onMove, onUp)
- **Removed**: `dragRef`, `draggingIdRef` refs
- **Kept**: Wheel scale/rotate, 3D tilt hover, double-click flip, dealing animation

### spread-view.css

- **Added**: `.spread-view__card-wrapper--overlay` — DragOverlay styling
- **Added**: `.spread-view__slot--over` — droppable slot hover indicator
- **Added**: `.spread-view__card-draggable` — grab cursor
- **Kept**: All existing styles (drag, dealing, flip, etc.)

### src/sortable-card.js (new, ~30 lines)

SortableCard wrapper using `useSortable` hook — available for Phase 3 when panel.js integration needs sortable dock cards.

### No changes to

card-table.js, panel.js, card-back.js, lightbox.js, deck-manager.js, spread-layouts.js

## Data Flow

```
Positioned spread — drag card A onto slot B:
  → PointerSensor activates after 8px move
  → DndContext tracks drag, renders DragOverlay clone
  → onDragEnd: active.id = card A's public_id, over.id = "slot-B"
  → Find indices: draggedIndex, targetIndex via findIndex
  → Swap: newCards[draggedIndex] ↔ newCards[targetIndex]
  → Call onReorder(newCards) → parent persists to InstantDB

Freeform — drag card anywhere:
  → Same sensor activation
  → onDragEnd: delta.x, delta.y from event
  → positionOverrides[cardId] += delta
  → Local state only (not persisted — Phase 4)

Collection/dock → spread:
  → HTML5 drag/drop (unchanged from current implementation)
  → onDrop parses application/json, calls onAddCard
```

## Spread Layout Compatibility

| Layout | Cards | Reorder (swap) | Free-position |
|--------|-------|----------------|---------------|
| Single (1) | 1 | N/A (only 1 card) | No |
| Three Card (3) | 3 | Yes | No |
| Four Elements (4) | 4 | Yes | No |
| Five Card Cross (5) | 5 | Yes | No |
| Freeform (unlimited) | Any | No | Yes (drag delta) |

## Preserved Interactions

These existing interactions are NOT replaced by @dnd-kit:
- **Wheel scroll**: Scale (default) / Rotate (shift+wheel) — raw DOM event, `{ passive: false }`
- **3D tilt**: Mousemove-based CSS custom properties — raw DOM event
- **Double-click**: Flip card — React event handler
- **Dealing animation**: Timer-based CSS class toggling

Confirmed compatible with @dnd-kit's pointer event model — @dnd-kit only captures pointer events during an active drag, and the 8px activation distance prevents interference with clicks/wheel.

## Future Phases

- **Phase 3**: Dock-to-spread via shared DndContext (lift DndContext to CardPanel or fs.js)
- **Phase 4**: Persist freeform positions to InstantDB deck metadata (schema extension needed: add `positions: { [cardId]: { x, y } }` field to decks)
- **Phase 5**: Polish — touch tuning, accessibility testing, bundle size review (~30KB gzipped added)

## Error Handling

- Sensor activation distance: 8px prevents accidental drags from clicks
- Cancel on Escape key (built into @dnd-kit)
- If `onReorder` callback fails, the swap is not applied (parent owns card array state)
- Touch: 200ms delay + 5px tolerance to distinguish scroll from drag

## Accessibility

@dnd-kit provides built-in:
- Keyboard drag (Space to pick up, Arrow keys to move, Space to drop)
- ARIA live region announcements
- Focus management during drag operations
