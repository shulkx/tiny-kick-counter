# Tab Performance Optimization Design

## Problem

When 美柚 sync is enabled with substantial data (~926 records / 147 days / ~340KB cache file), switching tabs feels sluggish. Root causes:

1. **Synchronous disk I/O on every render** — `readSeeyouCache()` reads + JSON.parses the full cache file in the render path.
2. **Full-scan aggregation for all tabs** — `buildDayCards` groups/sorts ALL cycles (local + seeyou) then slices. Even the "记录" tab pays full cost.
3. **Redundant double computation** — `cards` (30-day) and `allCards` (unlimited) have nearly identical cost since slicing happens post-aggregation.
4. **History list renders 900+ rows at once** — no pagination, causing frame drops on mount.

## Design

### 1. Lift `seeyouCache` into MainPage state

Currently `readSeeyouCache()` is called in the render body. Move it to state:

```ts
const [seeyouCache, setSeeyouCache] = useState(() => readSeeyouCache())
```

Update it inside `refresh()` alongside `setState(loadStateWithLazyArchive())`. This eliminates per-render disk I/O.

### 2. New `buildTodayCard` function in `common/stats.ts`

A dedicated function that only processes cycles matching today's `day_key`:

```ts
export function buildTodayCard(
  state: FetalMovementState,
  nowTs: number,
  seeyouCycles: Cycle[] = [],
): DayCard | null
```

Implementation:
- Compute `todayKey = formatDayKey(nowTs)`
- Filter `getVisibleCycles(state)` + `seeyouCycles` to only those with `day_key === todayKey`
- If none found, return `null`
- Sort, aggregate, return single `DayCard`

Cost: O(n) filter pass, no grouping/sorting of the full dataset. For 926 seeyou cycles, most will be skipped by a simple string comparison.

The existing `buildDayCards` remains unchanged — it's still used by `widget.tsx` (which limits to recent days) and by the history tab.

### 3. Records tab uses `buildTodayCard` only

Replace in `MainPage` render:
```ts
// Before:
const cards = buildDayCards(state, undefined, seeyouCycles)
const todayCards = cards.filter(card => card.day_key === todayKey)

// After:
const todayCard = buildTodayCard(state, nowTs, seeyouCycles)
const todayCards = todayCard ? [todayCard] : []
```

The 30-day `cards` computation is removed from the main render path entirely.

### 4. History cards as lazy state with `dataVersion`

Add a version counter that increments on any data mutation:

```ts
const [dataVersion, setDataVersion] = useState(0)
const [historyCards, setHistoryCards] = useState<DayCard[]>([])
const [historyVersion, setHistoryVersion] = useState(-1)
```

In `refresh()`:
```ts
setDataVersion(v => v + 1)
```

History tab `onAppear`:
```ts
if (historyVersion !== dataVersion) {
  setHistoryCards(buildDayCards(state, Infinity, seeyouCycles))
  setHistoryVersion(dataVersion)
}
```

This ensures history cards are only computed when the user opens the history tab AND data has changed since last computation.

### 5. History list pagination

Add incremental loading to `HistoryPage`:

```ts
const PAGE_SIZE = 20

export function HistoryPage({ cards, onDeleteCycle }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const visibleCards = cards.slice(0, visibleCount)
  const hasMore = visibleCount < cards.length

  return <List listStyle="insetGroup">
    {visibleCards.map(card => <Section>...</Section>)}
    {hasMore
      ? <Button
          title={`加载更多（剩余 ${cards.length - visibleCount} 天）`}
          action={() => setVisibleCount(v => v + PAGE_SIZE)}
        />
      : null}
  </List>
}
```

This caps initial render to ~20 day sections. User taps "加载更多" to see older history.

### 6. Settings tab `cards` prop

Settings currently receives `cards` (30-day) for the summary stats display. Replace with a lightweight summary computed from state + seeyouCycles count, or pass `buildDayCards(state, RECENT_DAY_LIMIT, seeyouCycles)` only on settings `onAppear`. Since settings is visited infrequently, computing on appear is acceptable.

Approach: compute inside settings `onAppear` callback and store in local state within `SettingsPage`, similar to the history pattern.

## Files Changed

| File | Change |
|------|--------|
| `common/stats.ts` | Add `buildTodayCard` |
| `index.tsx` | Lift seeyouCache to state; replace eager cards with `buildTodayCard`; add `dataVersion` + lazy `historyCards`; pass seeyouCycles to settings |
| `pages/history.tsx` | Add pagination (PAGE_SIZE = 20, "加载更多" button) |
| `pages/settings.tsx` | Compute cards internally on appear instead of receiving as prop |

## What Stays Unchanged

- `buildDayCards` — used by widget.tsx and history (no modification needed)
- `widget.tsx` — already limits to today card only via `getTodayCard`
- `seeyou/cache.ts` — read/write logic unchanged
- Domain rules — no behavioral changes

## Expected Impact

- **Records tab switch**: eliminates full-scan aggregation + disk read → near-instant
- **Settings tab switch**: no computation until opened, then only 30-day scan
- **History tab switch**: still does full scan, but only when data changed; pagination caps render cost to ~20 sections
- **Initial load**: same or faster (only today card computed eagerly)
