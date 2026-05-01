# `block-scroll-pickers.ts` — commentray

Pure geometry for **which commentray block** should track the **source** viewport top (and the Schmitt-style twins for **commentray→source**). Used by [`scroll-sync.ts`](../scroll-sync.ts/main.md) after `buildBlockScrollLinks` supplies `BlockScrollLink[]`.

## `BlockScrollLink`

Each link carries:

- **`commentrayLine`** — 0-based line of `<!-- commentray:block id=… -->` in the companion Markdown.
- **`markerViewportHalfOpen1Based`** — `{ lo, hiExclusive }` in **1-based source lines**: viewport top belongs to this block when `lo <= top < hiExclusive`. Built from `marker:` anchors via [`markerViewportHalfOpen1Based`](../source-markers.ts/main.md) in `source-markers.ts`, or from `lines:` anchors as `[range.start, range.end + 1)`.

## Naive source pick (`pickBlockScrollLinkForSourceViewportTop`)

```mermaid
flowchart TD
  T["topSourceLine1Based"] --> S["sort blocks by lo"]
  S --> I{"inside any span lo ≤ top < hi?"}
  I -->|yes| W["winner = that block"]
  I -->|no| A{"top < first.lo?"}
  A -->|yes| F["winner = first by lo"]
  A -->|no| G["winner = block with greatest lo where lo ≤ top"]
```

`blockStrictlyContainingSourceViewportLine` is the strict variant (true gaps return `null`). `sourceTopLineStrictlyBeforeFirstIndexLine` is the “prelude above every span” predicate. `commentrayProbeInStrictInterMarkerGap` is the markdown-line analogue for **inter-marker prose** between two block markers.

## Hysteresis (`pickBlockScrollLinkForSourceViewportWithHysteresis`)

Schmitt-style lock so edge noise does not flip the active block. After a **naive** pick, `resolveStickyHysteresisLock` clears the lock when naive is null, bootstraps `lockedId`, or compares **naive** vs **locked** spans:

```mermaid
stateDiagram-v2
  [*] --> NoLock
  NoLock --> Locked: naive wins, set lockedId
  Locked --> Locked: naive.id === lockedId
  Locked --> Stale: locked block missing from list
  Stale --> Locked: refresh lockedId to naive
  Locked --> Compare: naive differs from locked
  Compare --> Locked: spans overlap vertically
  Compare --> MaybeSwitch: spans separated below or above
  MaybeSwitch --> Locked: top not far enough past boundary minus HYST
  MaybeSwitch --> Locked2: top crossed threshold
  Locked2 --> [*]
```

Default thresholds: **`DEFAULT_SOURCE_VIEWPORT_HYSTERESIS_LINES`** (source lines) and **`DEFAULT_COMMENTRAY_VIEWPORT_HYSTERESIS_LINES`** (markdown lines) for the commentray-direction twin.

**Related:** [`source-markers.ts`](../source-markers.ts/main.md) · [`scroll-sync.ts`](../scroll-sync.ts/main.md)
