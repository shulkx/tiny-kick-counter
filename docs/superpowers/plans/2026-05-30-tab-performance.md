# Tab Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate tab-switch lag caused by synchronous disk I/O and full-dataset aggregation when 美柚 data is large.

**Architecture:** Introduce `buildTodayCard` for O(n) today-only computation; split `refresh()` into three tiers (`refreshView`/`invalidateData`/`invalidateSeeyouData`); lazy-compute history and settings cards with version-based staleness; paginate history list.

**Tech Stack:** TypeScript, Scripting framework (React-like hooks + SwiftUI components)

**Validation command:** `scripting-ts project "Tiny Kick Counter" --check`

**Note on `autoSyncIfDue`:** Both scenePhase active and Records `onAppear` may call it. This is safe because `pendingAutoSync` prevents concurrent execution and `shouldAutoSync` (in `seeyou/cache.ts`) gates on a minimum interval — no additional throttle logic is needed.

---

## Task 1: Add `buildTodayCard` to `common/stats.ts`

**Files:**
- Modify: `common/stats.ts`
- Modify: `common/model.ts`
- Test: `tests/stats_test.ts`

- [ ] **Step 1: Write failing tests for `buildTodayCard`**

First, update the import at the top of `tests/stats_test.ts` (will cause compile error until implementation exists):

```ts
import { buildDayCards, buildTodayCard, getTodayCard, selectWidgetRows, summarizeDayCards } from "../common/stats"
import { formatDayKey } from "../utils/date"
```

Then append the following test body after the existing `console.log("stats_test passed")` line:

```ts
// --- buildTodayCard tests ---

// Construct local-timezone timestamps to avoid UTC offset issues
const TEST_TODAY_TS = new Date(2026, 4, 26, 8, 0, 0).getTime()
const TEST_TODAY_KEY = formatDayKey(TEST_TODAY_TS)
assert(TEST_TODAY_KEY === "2026-05-26", `TEST_TODAY_KEY should be 2026-05-26 but got ${TEST_TODAY_KEY}`)

const TEST_TODAY_TS_MINUS_1H = new Date(2026, 4, 26, 7, 0, 0).getTime()
const TEST_TODAY_TS_MINUS_2H = new Date(2026, 4, 26, 6, 0, 0).getTime()
const TEST_YESTERDAY_TS = new Date(2026, 4, 25, 8, 0, 0).getTime()

// Rebuild test state with local-timezone timestamps for 2026-05-26
const perfState: FetalMovementState = {
  schema_version: 1,
  active_cycle: cycle("active", "2026-05-26", TEST_TODAY_TS, 1, 2),
  completed_cycles: [
    cycle("valid", "2026-05-26", TEST_TODAY_TS_MINUS_1H, 2, 3, "expired", true),
    cycle("manual", "2026-05-26", TEST_TODAY_TS_MINUS_2H, 9, 9, "manual", false),
    cycle("old", "2026-05-25", TEST_YESTERDAY_TS, 1, 1, "expired", true),
  ],
}

// Test 1: equivalence with buildDayCards for today
const todayCard = buildTodayCard(perfState, TEST_TODAY_TS)
const todayFromFull = buildDayCards(perfState, Infinity).find(c => c.day_key === "2026-05-26")
assert(todayCard !== null, "buildTodayCard returns today card")
assert(todayCard!.day_key === todayFromFull!.day_key, "day_key matches")
assert(todayCard!.effective_total === todayFromFull!.effective_total, "effective_total matches")
assert(todayCard!.counted_hours === todayFromFull!.counted_hours, "counted_hours matches")
assert(todayCard!.estimated_count === todayFromFull!.estimated_count, "estimated_count matches")
assert(todayCard!.cycles.length === todayFromFull!.cycles.length, "cycles count matches")

// Test 2: returns null when no cycles match
const noMatchCard = buildTodayCard(perfState, 99999999999999)
assert(noMatchCard === null, "buildTodayCard returns null for day with no cycles")

// Test 3: key fallback — cycle without day_key uses formatDayKey(started_ts)
const noDayKeyState: FetalMovementState = {
  schema_version: 1,
  active_cycle: null,
  completed_cycles: [
    { ...cycle("nodaykey", "", TEST_TODAY_TS, 3, 5, "expired", true), day_key: "" },
  ],
}
const fallbackCard = buildTodayCard(noDayKeyState, TEST_TODAY_TS)
assert(fallbackCard !== null, "buildTodayCard handles missing day_key via fallback")
assert(fallbackCard!.effective_total === 3, "fallback card has correct effective_total")

// Test 4: seeyou cycles included
const seeyouCycle = cycle("seeyou:123", "2026-05-26", TEST_TODAY_TS_MINUS_1H + 1800000, 4, 8, "expired", true)
seeyouCycle.source = "seeyou"
const withSeeyou = buildTodayCard(perfState, TEST_TODAY_TS, [seeyouCycle])
assert(withSeeyou !== null, "buildTodayCard includes seeyou cycles")
assert(withSeeyou!.effective_total === todayCard!.effective_total + 4, "seeyou effective added")

// Test 5: getTodayCard delegates to buildTodayCard (equivalence with unlimited buildDayCards)
const getTodayResult = getTodayCard(perfState, TEST_TODAY_TS)
assert(getTodayResult !== null, "getTodayCard returns card")
assert(getTodayResult!.effective_total === todayCard!.effective_total, "getTodayCard delegates to buildTodayCard")

console.log("buildTodayCard tests passed")
```

- [ ] **Step 2: Run validation to verify tests fail**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: Failure — `buildTodayCard` is not exported from `common/stats.ts`.

- [ ] **Step 3: Implement `buildTodayCard` in `common/stats.ts`**

Add before `getTodayCard`:

```ts
export function buildTodayCard(
  state: FetalMovementState,
  nowTs: number,
  seeyouCycles: Cycle[] = [],
): DayCard | null {
  const todayKey = formatDayKey(nowTs)
  const allCycles = [...getVisibleCycles(state), ...seeyouCycles]
  const todayCycles = allCycles.filter(cycle => {
    const key = cycle.day_key || formatDayKey(cycle.started_ts)
    return key === todayKey
  })
  if (todayCycles.length === 0) return null
  const sorted = todayCycles.slice().sort((a, b) => b.started_ts - a.started_ts)
  const counted_hours = sorted.length
  const effective_total = sorted.reduce((sum, c) => sum + c.effective_count, 0)
  const total_clicks = sorted.reduce((sum, c) => sum + c.total_count, 0)
  const estimated_count = counted_hours > 0 ? Math.round((effective_total / counted_hours) * ESTIMATE_HOURS) : 0
  return {
    day_key: todayKey,
    cycles: sorted,
    counted_hours,
    effective_total,
    total_clicks,
    estimated_count,
    has_active_cycle: sorted.some(isLocalActive),
  }
}
```

- [ ] **Step 4: Rewrite `getTodayCard` to delegate**

Replace the existing `getTodayCard` body:

```ts
export function getTodayCard(state: FetalMovementState, nowTs = Date.now(), seeyouCycles: Cycle[] = []): DayCard | null {
  return buildTodayCard(state, nowTs, seeyouCycles)
}
```

- [ ] **Step 5: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 6: Add re-exports in `common/model.ts`**

Replace the existing stats export line with:

```ts
export { buildDayCards, buildTodayCard, getTodayCard, selectWidgetRows, summarizeDayCards } from "./stats"
```

Also add type re-export for `DayCard`:

```ts
export type { FetalMovementState, Cycle, DayCard } from "./types"
```

(Replace the existing `export type { FetalMovementState, Cycle } from "./types"` line.)

- [ ] **Step 7: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add common/stats.ts common/model.ts tests/stats_test.ts
git commit -m "feat: add buildTodayCard for O(n) today-only computation

Delegates getTodayCard to the new function. Widget and entry files
benefit without interface changes."
```

---

## Task 2: Add `loadStateWithLazyArchiveDetailed` to `common/model.ts`

**Files:**
- Modify: `common/model.ts`

- [ ] **Step 1: Add the detailed variant**

Add after `loadStateWithLazyArchive`:

```ts
export function loadStateWithLazyArchiveDetailed(nowTs = Date.now()): { state: FetalMovementState; archived: boolean } {
  const { state } = readState()
  const archived = archiveExpiredCycleIfNeeded(state, nowTs)
  if (archived) saveState(state)
  return { state, archived: archived !== null }
}
```

- [ ] **Step 2: Also re-export `RECENT_DAY_LIMIT` from `common/model.ts`**

Add:

```ts
export { RECENT_DAY_LIMIT } from "./types"
```

- [ ] **Step 3: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add common/model.ts
git commit -m "feat: add loadStateWithLazyArchiveDetailed + re-export RECENT_DAY_LIMIT

Returns { state, archived } so callers can detect lazy archival
and invalidate derived data accordingly."
```

---

## Task 3: Refactor `index.tsx` and `pages/settings.tsx` together

This task modifies both files atomically so that every commit passes validation.

**Files:**
- Modify: `index.tsx`
- Modify: `pages/settings.tsx`

- [ ] **Step 1: Update `pages/settings.tsx` props interface**

Replace `onRefresh?: () => void` with `onSeeyouDataChanged?: (message?: string) => void` in `SettingsPage`:

```ts
export function SettingsPage({
  cards,
  onExport,
  onRestore,
  onReset,
  onSeeyouDataChanged,
}: {
  cards: DayCard[]
  onExport: () => void
  onRestore: () => void
  onReset: () => void
  onSeeyouDataChanged?: (message?: string) => void
}) {
```

Update `SeeyouSyncSection`:

```ts
function SeeyouSyncSection({ onSeeyouDataChanged }: { onSeeyouDataChanged?: (message?: string) => void }) {
```

Replace all `onRefresh?.()` with `onSeeyouDataChanged?.()` in `handleToggle`, `handleSync`, `handleClear`.

Update usage:

```tsx
<SeeyouSyncSection onSeeyouDataChanged={onSeeyouDataChanged} />
```

- [ ] **Step 2: Update `index.tsx` imports**

Replace the import block from `./common/model`:

```ts
import {
  autoSyncIfDue,
  buildDayCards,
  buildTodayCard,
  closeCycle,
  createBackupFile,
  deleteCycle,
  loadStateWithLazyArchive,
  loadStateWithLazyArchiveDetailed,
  readSeeyouCache,
  RECENT_DAY_LIMIT,
  recordMovement,
  resetState,
  restoreBackupFromFile,
  themeColors,
} from "./common/model"
import type { FetalMovementState, DayCard } from "./common/model"
```

- [ ] **Step 3: Add new state variables in `MainPage`**

After the existing state declarations:

```ts
const [seeyouCache, setSeeyouCache] = useState(() => readSeeyouCache())
const [dataVersionRef] = useState(() => ({ current: 0 }))
const [dataVersion, setDataVersion] = useState(0)
const [historyCards, setHistoryCards] = useState<DayCard[]>([])
const [historyVersion, setHistoryVersion] = useState(-1)
const [settingsCards, setSettingsCards] = useState<DayCard[]>([])
const [settingsVersion, setSettingsVersion] = useState(-1)
```

`dataVersionRef` is a stable object (created once via `useState` initializer) that tracks the latest version synchronously. Derived versions are set to `dataVersionRef.current` after recomputation, ensuring they align even if `dataVersion` was bumped multiple times between renders.

- [ ] **Step 4: Implement three-tier refresh**

`refreshView` returns `{ archived }` — it does NOT bump version itself. Callers decide.

Replace the existing `refresh` function with:

```ts
function bumpVersion() {
  dataVersionRef.current += 1
  setDataVersion(dataVersionRef.current)
}

function refreshView(message?: string): { archived: boolean } {
  const now = Date.now()
  setNowTs(now)
  const result = loadStateWithLazyArchiveDetailed(now)
  setState(result.state)
  if (message) {
    setToastMessage(message)
    setShowToast(true)
  }
  return { archived: result.archived }
}

function invalidateData(message?: string) {
  refreshView(message)
  bumpVersion()
}

function invalidateSeeyouData(message?: string) {
  refreshView(message)
  setSeeyouCache(readSeeyouCache())
  bumpVersion()
}
```

- [ ] **Step 5: Update `handleManualRefresh`**

```ts
function handleManualRefresh() {
  invalidateSeeyouData("已刷新页面并请求更新小组件。")
  Widget.reloadAll()
}
```

- [ ] **Step 6: Update action handlers**

For `handleRecord`, `handleConfirmedCloseCycle`, `handleReset`, `handleRestore`: replace `refresh(...)` calls with `invalidateData(...)`.

For `handleDeleteCycle`:

```ts
async function handleDeleteCycle(cycleId: string) {
  if (cycleId.startsWith("seeyou:")) return
  const ok = await Dialog.confirm({
    title: "确认删除此周期？",
    message: "删除后不可恢复。",
    cancelLabel: "取消",
    confirmLabel: "删除",
  })
  if (ok) {
    deleteCycle(cycleId)
    invalidateData("已删除该周期。")
    // Immediately recompute history for in-page update
    const freshState = loadStateWithLazyArchive()
    const cycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setHistoryCards(buildDayCards(freshState, Infinity, cycles))
    setHistoryVersion(dataVersionRef.current)
    Widget.reloadAll()
  }
}
```

Note: `setHistoryVersion(dataVersionRef.current)` aligns the derived version with the actual current data version, regardless of how many times it was bumped since last recomputation.

- [ ] **Step 7: Update `useEffect` for scenePhase**

```ts
useEffect(() => {
  const handleScenePhase = (phase: "active" | "inactive" | "background") => {
    if (phase === "active") {
      invalidateSeeyouData()
      void autoSyncIfDue().then(result => {
        if (result?.kind === "ok") { invalidateSeeyouData(); Widget.reloadAll() }
      })
    }
  }
  AppEvents.scenePhase.addListener(handleScenePhase)
  return () => AppEvents.scenePhase.removeListener(handleScenePhase)
}, [])
```

- [ ] **Step 8: Replace render-path computations**

Remove the old lines (149-154 area). Replace with:

```ts
const seeyouCycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
const todayCard = buildTodayCard(state, nowTs, seeyouCycles)
const todayCards = todayCard ? [todayCard] : []
```

- [ ] **Step 9: Update Records tab `onAppear`**

```ts
onAppear={() => {
  const { archived } = refreshView()
  if (archived) bumpVersion()
  void autoSyncIfDue().then(result => {
    if (result?.kind === "ok") { invalidateSeeyouData(); Widget.reloadAll() }
  })
}}
```

- [ ] **Step 10: Update History tab `onAppear`**

```ts
onAppear={() => {
  const { archived } = refreshView()
  if (archived) bumpVersion()
  if (historyVersion !== dataVersionRef.current) {
    const freshState = loadStateWithLazyArchive()
    const cycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setHistoryCards(buildDayCards(freshState, Infinity, cycles))
    setHistoryVersion(dataVersionRef.current)
  }
}}
```

- [ ] **Step 11: Update History tab to pass `historyCards`**

Change `<HistoryPage cards={allCards} ...>` to `<HistoryPage cards={historyCards} ...>`.

- [ ] **Step 12: Update Settings tab `onAppear`**

```ts
onAppear={() => {
  const { archived } = refreshView()
  if (archived) bumpVersion()
  if (settingsVersion !== dataVersionRef.current) {
    const freshState = loadStateWithLazyArchive()
    const cycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setSettingsCards(buildDayCards(freshState, RECENT_DAY_LIMIT, cycles))
    setSettingsVersion(dataVersionRef.current)
  }
}}
```

- [ ] **Step 13: Add `handleSeeyouDataChanged` and update Settings props**

```ts
function handleSeeyouDataChanged(message?: string) {
  invalidateSeeyouData(message)
  // Immediately recompute settings cards for in-page update
  const freshState = loadStateWithLazyArchive()
  const freshCache = readSeeyouCache()
  const cycles = freshCache.sync_enabled ? freshCache.cycles : []
  setSettingsCards(buildDayCards(freshState, RECENT_DAY_LIMIT, cycles))
  setSettingsVersion(dataVersionRef.current)
}
```

Update `<SettingsPage>` props:

```tsx
<SettingsPage
  cards={settingsCards}
  onExport={() => { void handleExport() }}
  onRestore={() => setConfirmAction("restore")}
  onReset={() => setConfirmAction("reset")}
  onSeeyouDataChanged={handleSeeyouDataChanged}
/>
```

- [ ] **Step 14: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 15: Commit**

```bash
git add index.tsx pages/settings.tsx common/model.ts
git commit -m "refactor: split refresh into three tiers, lazy history/settings cards

- refreshView: returns { archived }, no version bump, no seeyou read
- invalidateData: local mutations only
- invalidateSeeyouData: seeyou mutations + manual refresh
- Records tab uses buildTodayCard only
- History/settings cards computed lazily via dataVersion
- Settings accepts onSeeyouDataChanged callback"
```

---

## Task 4: Add pagination to `pages/history.tsx`

**Files:**
- Modify: `pages/history.tsx`

- [ ] **Step 1: Add `useState` to imports**

```ts
import {
  Button,
  HStack,
  Label,
  List,
  Section,
  Spacer,
  Text,
  VStack,
  useState,
} from "scripting"
```

- [ ] **Step 2: Add pagination state and render logic**

Update `HistoryPage`:

```ts
const PAGE_SIZE = 20

export function HistoryPage({
  cards,
  onDeleteCycle,
}: {
  cards: DayCard[]
  onDeleteCycle: (cycleId: string) => void
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const visibleCards = cards.slice(0, visibleCount)
  const hasMore = visibleCount < cards.length

  if (cards.length === 0) {
    return <List listStyle="insetGroup">
      <HistoryEmpty />
    </List>
  }

  return <List listStyle="insetGroup">
    {visibleCards.map(card =>
      <Section>
        <DaySummaryRow card={card} />
        {card.cycles.map(cycle =>
          <HistoryCycleRow
            cycle={cycle}
            onDelete={cycle.close_reason ? onDeleteCycle : undefined}
          />
        )}
      </Section>
    )}
    {hasMore
      ? <Section>
          <Button
            action={() => setVisibleCount(v => v + PAGE_SIZE)}
            buttonStyle="plain"
          >
            <HStack frame={{ maxWidth: "infinity" }} padding={12}>
              <Text font="subheadline" foregroundStyle={themeColors.systemBlue}>
                加载更多（剩余 {cards.length - visibleCount} 天）
              </Text>
            </HStack>
          </Button>
        </Section>
      : null}
  </List>
}
```

- [ ] **Step 3: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pages/history.tsx
git commit -m "feat: paginate history list (20 days per page)

Caps initial render to 20 sections. User taps 'load more' to
see older history, avoiding 900+ row render on mount."
```

---

## Task 5: Final validation and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full project validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS with no errors.

- [ ] **Step 2: Verify no unused imports in `index.tsx`**

Check that `buildDayCards` is still needed (used in history/settings recomputation). Check that `loadStateWithLazyArchive` is still needed (used in `onAppear` fresh-read). Remove `formatDayKey` import from `index.tsx` if no longer used (today key computation moved into `buildTodayCard`).

- [ ] **Step 3: Verify `widget.tsx` still compiles**

`widget.tsx` uses `getTodayCard` which now delegates to `buildTodayCard`. No interface change — just confirm validation passes.

- [ ] **Step 4: Commit cleanup if any**

```bash
git add -A
git commit -m "chore: cleanup unused imports after performance refactor"
```
