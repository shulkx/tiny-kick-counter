# Tab Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate tab-switch lag caused by synchronous disk I/O and full-dataset aggregation when 美柚 data is large.

**Architecture:** Introduce `buildTodayCard` for O(n) today-only computation; split `refresh()` into three tiers (`refreshView`/`invalidateData`/`invalidateSeeyouData`); lazy-compute history and settings cards with version-based staleness; paginate history list.

**Tech Stack:** TypeScript, Scripting framework (React-like hooks + SwiftUI components)

**Validation command:** `scripting-ts project "Tiny Kick Counter" --check`

---

## Task 1: Add `buildTodayCard` to `common/stats.ts`

**Files:**
- Modify: `common/stats.ts`
- Test: `tests/stats_test.ts`

- [ ] **Step 1: Write failing tests for `buildTodayCard`**

Append to `tests/stats_test.ts`:

```ts
import { buildTodayCard } from "../common/stats"
import { formatDayKey } from "../utils/date"

// --- buildTodayCard tests ---

// Test 1: equivalence with buildDayCards for today
const todayTs = 3000 // matches "2026-05-26" in test state
const todayKey = "2026-05-26"
const todayCard = buildTodayCard(state, todayTs)
const todayFromFull = buildDayCards(state, Infinity).find(c => c.day_key === todayKey)
assert(todayCard !== null, "buildTodayCard returns today card")
assert(todayCard!.day_key === todayFromFull!.day_key, "day_key matches")
assert(todayCard!.effective_total === todayFromFull!.effective_total, "effective_total matches")
assert(todayCard!.counted_hours === todayFromFull!.counted_hours, "counted_hours matches")
assert(todayCard!.estimated_count === todayFromFull!.estimated_count, "estimated_count matches")
assert(todayCard!.cycles.length === todayFromFull!.cycles.length, "cycles count matches")

// Test 2: returns null when no cycles match
const noMatchCard = buildTodayCard(state, 99999999999999)
assert(noMatchCard === null, "buildTodayCard returns null for day with no cycles")

// Test 3: key fallback — cycle without day_key uses formatDayKey(started_ts)
const noDayKeyState: FetalMovementState = {
  schema_version: 1,
  active_cycle: null,
  completed_cycles: [
    { ...cycle("nodaykey", "", 2000, 3, 5, "expired", true), day_key: "" },
  ],
}
const fallbackTs = 2000
const fallbackCard = buildTodayCard(noDayKeyState, fallbackTs)
assert(fallbackCard !== null, "buildTodayCard handles missing day_key via fallback")
assert(fallbackCard!.effective_total === 3, "fallback card has correct effective_total")

// Test 4: seeyou cycles included
const seeyouCycle = cycle("seeyou:123", "2026-05-26", 2500, 4, 8, "expired", true)
seeyouCycle.source = "seeyou"
const withSeeyou = buildTodayCard(state, todayTs, [seeyouCycle])
assert(withSeeyou !== null, "buildTodayCard includes seeyou cycles")
assert(withSeeyou!.effective_total === todayCard!.effective_total + 4, "seeyou effective added")

// Test 5: equivalence of getTodayCard delegation
const getTodayResult = getTodayCard(state, todayTs)
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

- [ ] **Step 5: Update import in test file**

Update the import at the top of `tests/stats_test.ts`:

```ts
import { buildDayCards, buildTodayCard, getTodayCard, selectWidgetRows, summarizeDayCards } from "../common/stats"
```

- [ ] **Step 6: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 7: Add re-export in `common/model.ts`**

Add to the re-exports in `common/model.ts`:

```ts
export { buildDayCards, buildTodayCard, getTodayCard, selectWidgetRows, summarizeDayCards } from "./stats"
```

(Replace the existing `buildDayCards, getTodayCard, selectWidgetRows, summarizeDayCards` export line.)

- [ ] **Step 8: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 9: Commit**

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

- [ ] **Step 2: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add common/model.ts
git commit -m "feat: add loadStateWithLazyArchiveDetailed

Returns { state, archived } so callers can detect lazy archival
and invalidate derived data accordingly."
```

---

## Task 3: Refactor `index.tsx` — lift state, split refresh, wire today card

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Update imports**

Replace the import block from `./common/model`:

```ts
import {
  autoSyncIfDue,
  buildTodayCard,
  closeCycle,
  createBackupFile,
  deleteCycle,
  loadStateWithLazyArchive,
  loadStateWithLazyArchiveDetailed,
  readSeeyouCache,
  recordMovement,
  resetState,
  restoreBackupFromFile,
  themeColors,
  buildDayCards,
  RECENT_DAY_LIMIT,
} from "./common/model"
import type { FetalMovementState, DayCard } from "./common/model"
```

Also add `RECENT_DAY_LIMIT` to the re-exports in `common/model.ts` if not already present (re-export from `./types`).

- [ ] **Step 2: Add new state variables**

After the existing state declarations in `MainPage`, add:

```ts
const [seeyouCache, setSeeyouCache] = useState(() => readSeeyouCache())
const [dataVersion, setDataVersion] = useState(0)
const [historyCards, setHistoryCards] = useState<DayCard[]>([])
const [historyVersion, setHistoryVersion] = useState(-1)
const [settingsCards, setSettingsCards] = useState<DayCard[]>([])
const [settingsVersion, setSettingsVersion] = useState(-1)
```

- [ ] **Step 3: Implement three-tier refresh**

Replace the existing `refresh` function with:

```ts
function refreshView(message?: string): { archived: boolean } {
  const now = Date.now()
  setNowTs(now)
  const result = loadStateWithLazyArchiveDetailed(now)
  setState(result.state)
  if (message) {
    setToastMessage(message)
    setShowToast(true)
  }
  if (result.archived) {
    setDataVersion(v => v + 1)
  }
  return { archived: result.archived }
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

- [ ] **Step 4: Update `handleManualRefresh`**

```ts
function handleManualRefresh() {
  invalidateSeeyouData("已刷新页面并请求更新小组件。")
  Widget.reloadAll()
}
```

- [ ] **Step 5: Update action handlers to use `invalidateData`**

For `handleRecord`, `handleConfirmedCloseCycle`, `handleReset`, `handleRestore`: replace `refresh(...)` calls with `invalidateData(...)`.

For `handleDeleteCycle`: replace `refresh(...)` with `invalidateData(...)`, then immediately recompute `historyCards`:

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
    // Immediately recompute history cards for in-page update
    const freshState = loadStateWithLazyArchive()
    const seeyouCycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setHistoryCards(buildDayCards(freshState, Infinity, seeyouCycles))
    setHistoryVersion(dataVersion + 1)
    Widget.reloadAll()
  }
}
```

- [ ] **Step 6: Update `useEffect` for scenePhase**

Replace `refresh()` with `invalidateSeeyouData()`:

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

- [ ] **Step 7: Replace render-path computations**

Remove the old `seeyouCache`, `seeyouCycles`, `cards`, `allCards`, `todayCards` lines (lines 149-154). Replace with:

```ts
const seeyouCycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
const todayCard = buildTodayCard(state, nowTs, seeyouCycles)
const todayCards = todayCard ? [todayCard] : []
```

- [ ] **Step 8: Update Records tab `onAppear`**

Replace `refresh()` with `refreshView()` in the ScrollView `onAppear`:

```ts
onAppear={() => {
  refreshView()
  void autoSyncIfDue().then(result => {
    if (result?.kind === "ok") { invalidateSeeyouData(); Widget.reloadAll() }
  })
}}
```

- [ ] **Step 9: Update History tab `onAppear`**

```ts
onAppear={() => {
  refreshView()
  if (historyVersion !== dataVersion) {
    const freshState = loadStateWithLazyArchive()
    const cycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setHistoryCards(buildDayCards(freshState, Infinity, cycles))
    setHistoryVersion(dataVersion)
  }
}}
```

- [ ] **Step 10: Update History tab to pass `historyCards`**

Change `<HistoryPage cards={allCards} ...>` to `<HistoryPage cards={historyCards} ...>`.

- [ ] **Step 11: Update Settings tab `onAppear`**

```ts
onAppear={() => {
  refreshView()
  if (settingsVersion !== dataVersion) {
    const freshState = loadStateWithLazyArchive()
    const cycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
    setSettingsCards(buildDayCards(freshState, RECENT_DAY_LIMIT, cycles))
    setSettingsVersion(dataVersion)
  }
}}
```

- [ ] **Step 12: Add `handleSeeyouDataChanged` and update Settings props**

```ts
function handleSeeyouDataChanged(message?: string) {
  invalidateSeeyouData(message)
  const freshState = loadStateWithLazyArchive()
  const freshCache = readSeeyouCache()
  const cycles = freshCache.sync_enabled ? freshCache.cycles : []
  setSettingsCards(buildDayCards(freshState, RECENT_DAY_LIMIT, cycles))
  setSettingsVersion(dataVersion + 1)
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

- [ ] **Step 13: Ensure `RECENT_DAY_LIMIT` is re-exported from `common/model.ts`**

Add to `common/model.ts`:

```ts
export { RECENT_DAY_LIMIT } from "./types"
```

- [ ] **Step 14: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: May fail due to `SettingsPage` interface mismatch (fixed in next task).

- [ ] **Step 15: Commit (WIP if settings not yet updated)**

```bash
git add index.tsx common/model.ts
git commit -m "refactor: split refresh into three tiers, lazy history/settings cards

- refreshView: lightweight, no seeyou disk read
- invalidateData: local mutations only
- invalidateSeeyouData: seeyou mutations + manual refresh
- Records tab uses buildTodayCard only
- History/settings cards computed lazily via dataVersion"
```

---

## Task 4: Update `pages/settings.tsx` — accept `onSeeyouDataChanged`

**Files:**
- Modify: `pages/settings.tsx`

- [ ] **Step 1: Update `SettingsPage` props interface**

Replace `onRefresh?: () => void` with `onSeeyouDataChanged?: (message?: string) => void`:

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

- [ ] **Step 2: Update `SeeyouSyncSection` prop**

Change `onRefresh` to `onSeeyouDataChanged` in `SeeyouSyncSection`:

```ts
function SeeyouSyncSection({ onSeeyouDataChanged }: { onSeeyouDataChanged?: (message?: string) => void }) {
```

- [ ] **Step 3: Replace `onRefresh?.()` calls with `onSeeyouDataChanged?.()`**

In `handleToggle`:
```ts
function handleToggle(enabled: boolean) {
  const next = setSyncEnabled(enabled)
  setCache(next)
  onSeeyouDataChanged?.()
  Widget.reloadAll()
}
```

In `handleSync` (after sync completes):
```ts
onSeeyouDataChanged?.()
Widget.reloadAll()
```

In `handleClear`:
```ts
if (ok) {
  const next = clearSeeyouData()
  setCache(next)
  onSeeyouDataChanged?.()
  Widget.reloadAll()
}
```

- [ ] **Step 4: Update `SeeyouSyncSection` usage in `SettingsPage`**

```tsx
<SeeyouSyncSection onSeeyouDataChanged={onSeeyouDataChanged} />
```

- [ ] **Step 5: Run validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add pages/settings.tsx
git commit -m "refactor: settings accepts onSeeyouDataChanged callback

Replaces onRefresh. Parent (MainPage) handles seeyou cache reload
and settingsCards recomputation."
```

---

## Task 5: Add pagination to `pages/history.tsx`

**Files:**
- Modify: `pages/history.tsx`

- [ ] **Step 1: Add pagination state and render logic**

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

- [ ] **Step 2: Add `useState` to imports**

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

## Task 6: Final validation and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full project validation**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS with no errors.

- [ ] **Step 2: Verify no unused imports in `index.tsx`**

Check that old imports like `buildDayCards` are still needed (used in history/settings recomputation within `index.tsx`). Remove any that are no longer used.

- [ ] **Step 3: Verify `widget.tsx` still compiles**

`widget.tsx` uses `getTodayCard` which now delegates to `buildTodayCard`. No interface change needed — just confirm it still passes validation.

- [ ] **Step 4: Commit cleanup if any**

```bash
git add -A
git commit -m "chore: cleanup unused imports after performance refactor"
```

- [ ] **Step 5: Tag completion**

No tag needed — this is an internal optimization, not a version bump.
