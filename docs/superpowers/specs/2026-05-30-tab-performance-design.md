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

The seeyou cache is re-read from disk only in these scenarios:
- **Mount** (initial `useState`)
- **Scene phase → active** (app returning from background)
- **Manual refresh button**
- **After sync/toggle/clear seeyou operations** (via `invalidateSeeyouData`)

Tab `onAppear` does NOT re-read the seeyou cache — it only refreshes local state and `nowTs`. The cached `seeyouCache` state is already up-to-date for tab switches because no operation between tabs can change the on-disk seeyou file.

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
- Filter `getVisibleCycles(state)` + `seeyouCycles` using `(cycle.day_key || formatDayKey(cycle.started_ts)) === todayKey` (same fallback logic as `buildDayCards`)
- If none found, return `null`
- Sort, aggregate, return single `DayCard`

Cost: O(n) filter pass, no grouping/sorting of the full dataset. For 926 seeyou cycles, most will be skipped by a simple string comparison.

### 3. Migrate `getTodayCard` to delegate to `buildTodayCard`

Current `getTodayCard` calls `buildDayCards(...).find(today)` — still a full scan. Replace its body:

```ts
export function getTodayCard(state: FetalMovementState, nowTs = Date.now(), seeyouCycles: Cycle[] = []): DayCard | null {
  return buildTodayCard(state, nowTs, seeyouCycles)
}
```

This gives `widget.tsx` the same performance benefit with no interface change.

### 4. Split refresh: `refreshView()` / `invalidateData()` / `invalidateSeeyouData()`

Three concerns are currently conflated in `refresh()`:

- **`refreshView(message?)`** — re-reads local state from disk + updates `nowTs`. Lightweight: does NOT read seeyou cache, does NOT bump version. Called by tab `onAppear`.
- **`invalidateData(message?)`** — calls `refreshView()` then increments `dataVersion`. Called after local-only mutations: `record`, `closeCycle`, `deleteCycle`, `resetState`, `restoreBackup`. Does NOT re-read seeyou cache (these operations don't touch it).
- **`invalidateSeeyouData(message?)`** — calls `refreshView()`, re-reads seeyou cache, then increments `dataVersion`. Called only after operations that change the seeyou cache file: sync success, toggle, clear, manual refresh, scene active.

```ts
const [dataVersion, setDataVersion] = useState(0)

function refreshView(message?: string) {
  setNowTs(Date.now())
  setState(loadStateWithLazyArchive())
  if (message) { setToastMessage(message); setShowToast(true) }
}

function invalidateData(message?: string) {
  refreshView(message)
  setDataVersion(v => v + 1)
}

function invalidateSeeyouData(message?: string) {
  refreshView(message)
  setSeeyouCache(readSeeyouCache())
  setDataVersion(v => v + 1)
}
```

Tab `onAppear` calls `refreshView()` (no disk read, no version bump). Local mutation handlers (`handleRecord`, `handleDeleteCycle`, etc.) call `invalidateData()`. Seeyou-related operations (sync/toggle/clear) and scene active / manual refresh call `invalidateSeeyouData()`.

### 5. Records tab uses `buildTodayCard` only

Replace in `MainPage` render:
```ts
// Before:
const cards = buildDayCards(state, undefined, seeyouCycles)
const allCards = buildDayCards(state, Infinity, seeyouCycles)
const todayCards = cards.filter(card => card.day_key === todayKey)

// After:
const todayCard = buildTodayCard(state, nowTs, seeyouCycles)
const todayCards = todayCard ? [todayCard] : []
```

The 30-day and unlimited `cards` computations are removed from the main render path entirely.

### 6. History cards as lazy state with `dataVersion`

```ts
const [historyCards, setHistoryCards] = useState<DayCard[]>([])
const [historyVersion, setHistoryVersion] = useState(-1)
```

History tab `onAppear` recomputes only when stale:
```ts
onAppear={() => {
  refreshView()
  if (historyVersion !== dataVersion) {
    // Fresh-read local state to avoid stale closure; use seeyouCache from state
    // (it's already current — only invalidateSeeyouData updates it)
    const freshState = loadStateWithLazyArchive()
    const seeyouCycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setHistoryCards(buildDayCards(freshState, Infinity, seeyouCycles))
    setHistoryVersion(dataVersion)
  }
}}
```

**In-page mutation handling**: if the user deletes a cycle while on the history tab, `invalidateData()` bumps `dataVersion` but `onAppear` won't re-fire. To handle this, after `handleDeleteCycle` completes, immediately recompute `historyCards` inline using the same pattern (fresh local state + current `seeyouCache` state). Use a shared `nextVersion` value for both `setDataVersion` and `setHistoryVersion` to avoid version drift from async state updates:

```ts
const nextVersion = dataVersion + 1
setDataVersion(nextVersion)
const freshState = loadStateWithLazyArchive()
const seeyouCycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
setHistoryCards(buildDayCards(freshState, Infinity, seeyouCycles))
setHistoryVersion(nextVersion)
```

### 7. History list pagination

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

### 8. Settings tab

Settings currently receives `cards` (30-day) as a prop for summary stats. Change to MainPage-owned lazy state, preserving 30-day semantics:

MainPage holds `settingsCards` / `settingsVersion` (same pattern as history). Settings tab `onAppear` recomputes when `settingsVersion !== dataVersion`. `SettingsPage` receives `settingsCards` as a prop and an `onSeeyouDataChanged()` callback. After sync/toggle/clear operations complete within settings, the handler calls `onSeeyouDataChanged()` which triggers `invalidateSeeyouData()` in MainPage — this updates `seeyouCache` state, bumps `dataVersion`, and since MainPage re-renders, passes fresh `settingsCards` down to the still-visible settings page.

## Files Changed

| File | Change |
|------|--------|
| `common/stats.ts` | Add `buildTodayCard`; rewrite `getTodayCard` to delegate |
| `common/model.ts` | Re-export `buildTodayCard` (entry files import from `common/model`) |
| `index.tsx` | Lift seeyouCache to state; split `refreshView`/`invalidateData`/`invalidateSeeyouData`; replace eager cards with `buildTodayCard`; add `dataVersion` + lazy `historyCards`/`settingsCards`; inline recompute on delete with shared nextVersion; pass `settingsCards` + `onSeeyouDataChanged` to settings |
| `pages/history.tsx` | Add pagination (PAGE_SIZE = 20, "加载更多" button) |
| `pages/settings.tsx` | Accept `settingsCards` prop + `onSeeyouDataChanged` callback; remove internal cards computation |

## What Stays Unchanged

- `buildDayCards` — used by history tab and settings (no modification needed)
- `seeyou/cache.ts` — read/write logic unchanged
- Domain rules — no behavioral changes
- `widget.tsx` — calls `getTodayCard` as before (now faster internally)

## Testing

Three categories of tests to add in `tests/stats_test.ts`:

1. **Equivalence**: `buildTodayCard(state, nowTs, seeyouCycles)` returns the same result as `buildDayCards(state, Infinity, seeyouCycles).find(c => c.day_key === formatDayKey(nowTs))` for various inputs.
2. **Key fallback**: cycles missing `day_key` (relying on `formatDayKey(started_ts)` fallback) are correctly included/excluded by `buildTodayCard`.
3. **`getTodayCard` delegation**: after rewrite, `getTodayCard` returns identical results to `buildDayCards(state, Infinity, seeyouCycles).find(c => c.day_key === formatDayKey(nowTs))` across edge cases (no cycles, mixed sources, active cycle, future/abnormal day_key).

## Expected Impact

- **Records tab switch**: only reads lightweight local state (no seeyou disk I/O), computes today card only → near-instant
- **Settings tab switch**: no computation until opened, then only 30-day scan
- **History tab switch**: still does full scan, but only when data actually changed; pagination caps render cost to ~20 sections
- **Widget**: `getTodayCard` now O(n) filter instead of full grouping → faster widget refresh
- **Initial load**: same or faster (only today card computed eagerly)
