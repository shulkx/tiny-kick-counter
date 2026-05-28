# History Tab & Cycle Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a History tab with swipe-to-delete, narrow the main page to today-only, and make manual cycle closure discard data instead of archiving it.

**Architecture:** Two sequential phases. Phase 1 changes the data model (closeCycle discards, migration cleans invalid cycles). Phase 2 adds the History tab UI and narrows the main page. Each phase has its own commit(s).

**Tech Stack:** TypeScript, scripting framework (SwiftUI-like components: List, Section, trailingSwipeActions, Dialog.confirm)

**Spec:** `docs/superpowers/specs/2026-05-27-history-tab-and-cycle-deletion-design.md`

---

## File Structure

| File | Role | Action |
|---|---|---|
| `common/model.ts` | Business logic | Modify: rewrite `closeCycle`, add `deleteCycle` |
| `common/storage.ts` | Persistence & migration | Modify: add invalid cycle cleanup in `migrateStateIfNeeded` |
| `common/types.ts` | Type definitions | No changes (optional fields kept for backward compat) |
| `common/stats.ts` | Statistics helpers | No changes needed |
| `utils/date.ts` | Date formatting | Modify: add `formatChineseDate` |
| `index.tsx` | App entry, tabs | Modify: add close-cycle confirmation, filter today cards, add History tab |
| `pages/records.tsx` | Main page content | Modify: section title, today card title format |
| `pages/history.tsx` | History page | Create: new file |
| `widget.tsx` | Widget UI | Modify: remove "结束" button |
| `tests/model_test.ts` | Model unit tests | Modify: update closeCycle assertions, add deleteCycle test |

---

## Phase 1: Manual Closure Discards Data

### Task 1: Rewrite `closeCycle` + Data Migration (combined — tightly coupled)

**Files:**
- Modify: `common/model.ts:174-208` (`closeCycle`)
- Modify: `common/storage.ts:40-49` (`migrateStateIfNeeded`)
- Modify: `tests/model_test.ts`

These changes must be done together: the migration filter and the closeCycle rewrite both affect how `is_valid === false` cycles are handled. Splitting them would break the test suite mid-way.

- [ ] **Step 1: Rewrite `closeCycle` to discard active cycle**

In `common/model.ts`, replace the `closeCycle` function:

```ts
export async function closeCycle(eventTs: number, source: Source): Promise<CommandResult> {
  const nowTs = Date.now()
  const { state, warning } = readState()

  if (isFutureRejected(eventTs, nowTs)) {
    return result("close_cycle", source, eventTs, "future_time_rejected", "结束胎动周期", "结束时间异常，晚于当前时间过多，已取消。", { warning })
  }

  archiveExpiredCycleIfNeeded(state, eventTs)

  if (!state.active_cycle) {
    saveState(state)
    return result("close_cycle", source, eventTs, "no_active_cycle", "结束胎动周期", "当前没有正在进行的胎动周期。", { warning })
  }

  const cycle = state.active_cycle
  state.active_cycle = null
  saveState(state)
  await cancelPendingCycleEndNotifications()
  return result("close_cycle", source, eventTs, "discarded", "停止本次记录", "已停止本次记录，数据未保存。", {
    cycle_id: cycle.cycle_id,
    day_key: cycle.day_key,
    effective_count: cycle.effective_count,
    total_count: cycle.total_count,
    warning,
  })
}
```

Key changes: no call to `archiveActiveCycle`, status changed from `"closed"` to `"discarded"`, message updated.

- [ ] **Step 2: Update `migrateStateIfNeeded` to filter out invalid cycles**

In `common/storage.ts`, update the function to also reject `is_valid === false` cycles (cleans existing data from before this change):

```ts
export function migrateStateIfNeeded(value: unknown): FetalMovementState {
  if (!value || typeof value !== "object") return defaultState()
  const state = value as Partial<FetalMovementState>
  if (state.schema_version !== 1) return defaultState()
  const validCycles = Array.isArray(state.completed_cycles)
    ? state.completed_cycles.filter(c => isValidCycle(c) && c.is_valid !== false)
    : []
  return {
    schema_version: 1,
    active_cycle: isValidCycle(state.active_cycle) ? state.active_cycle : null,
    completed_cycles: validCycles,
  }
}
```

- [ ] **Step 3: Update `tests/model_test.ts` — closeCycle assertions**

Replace the closeCycle test block. The old test expected `status === "closed"` and the cycle archived. New expectations:

```ts
const closed = await closeCycle(base + 10 * 60 * 1000, "app")
assert(closed.status === "discarded", "manual close discards cycle")
const stateAfterClose = readState().state
assert(stateAfterClose.active_cycle === null, "manual close clears active cycle")
assert(stateAfterClose.completed_cycles.length === 0, "manual close does not archive cycle")
```

Rename the variable from `state` to `stateAfterClose` to avoid shadowing.

- [ ] **Step 4: Update `tests/model_test.ts` — migration test**

Replace the migration test block. The old test reused the archived cycle; now construct a fake one inline:

```ts
const fakeCycle = {
  cycle_id: "fake",
  day_key: "2026-05-26",
  started_at: "2026-05-26 09:00:00",
  started_ts: base,
  scheduled_end_at: "2026-05-26 10:00:00",
  scheduled_end_ts: base + 3600000,
  effective_count: 1,
  total_count: 1,
  effective_movements: [],
  close_reason: "manual" as const,
  is_valid: false,
}
const migrated = migrateStateIfNeeded({
  schema_version: 1,
  active_cycle: null,
  completed_cycles: [
    { at: "2026-05-26 09:50:05", ts: base } as any,
    fakeCycle,
  ],
})
assert(migrated.completed_cycles.length === 0, "migration filters invalid and malformed cycles")
```

- [ ] **Step 5: Commit**

```bash
git add common/model.ts common/storage.ts tests/model_test.ts
git commit -m "feat: closeCycle discards data, migration cleans invalid cycles"
```

---

### Task 2: Close-Cycle Confirmation Dialog in App UI

**Files:**
- Modify: `index.tsx:36,73-83`

- [ ] **Step 1: Add "close_cycle" to confirmAction state and wire up dialog**

In `index.tsx`, the `confirmAction` state currently handles `"reset" | "restore" | null`. Expand it to include `"close_cycle"`:

```ts
const [confirmAction, setConfirmAction] = useState<"reset" | "restore" | "close_cycle" | null>(null)
```

- [ ] **Step 2: Change `handleCloseCycle` to set confirmAction instead of calling closeCycle directly**

Replace `onCloseCycle` callback passed to `RecordsPage`:

```ts
onCloseCycle={() => setConfirmAction("close_cycle")}
```

- [ ] **Step 3: Create the actual close handler that runs after confirmation**

Add the confirmed handler function:

```ts
async function handleConfirmedCloseCycle() {
  setConfirmAction(null)
  if (isRecording) return
  setIsRecording(true)
  try {
    const result = await closeCycle(Date.now(), "app")
    refresh(result.message)
    Widget.reloadAll()
  } finally {
    setIsRecording(false)
  }
}
```

Remove the old `handleCloseCycle` function.

- [ ] **Step 4: Update the confirmationDialog in the Settings tab to also handle close_cycle**

The existing `confirmationDialog` in the settings `<ScrollView>` handles "reset" and "restore". The records tab `<ScrollView>` does not have a `confirmationDialog`. Add one to the records tab's `<ScrollView>`:

```tsx
confirmationDialog={{
  title: confirmAction === "close_cycle" ? "停止本次记录？" : "",
  isPresented: confirmAction === "close_cycle",
  onChanged: isPresented => { if (!isPresented) setConfirmAction(null) },
  message: <Text>系统将不会保存这次的数据</Text>,
  actions: <VStack>
    <Button title="确认停止" role="destructive" action={() => { void handleConfirmedCloseCycle() }} />
    <Button title="取消" role="cancel" action={() => setConfirmAction(null)} />
  </VStack>,
}}
```

Also update the settings tab dialog title logic to exclude "close_cycle":

```ts
title: confirmAction === "restore" ? "从备份恢复？" : confirmAction === "reset" ? "重置胎动数据？" : "",
isPresented: confirmAction === "restore" || confirmAction === "reset",
```

- [ ] **Step 5: Commit**

```bash
git add index.tsx
git commit -m "feat: add confirmation dialog before discarding active cycle"
```

---

### Task 3: Remove "结束" Button from Widget

**Files:**
- Modify: `widget.tsx:69-93` (`ActionButtons`)

- [ ] **Step 1: Simplify `ActionButtons` to remove the close button**

In `widget.tsx`, replace the `ActionButtons` function:

```tsx
function ActionButtons({ family }: { family: WidgetFamily }) {
  const isLarge = family === "systemLarge" || family === "systemExtraLarge"
  const buttonHeight = isLarge ? 40 : 32
  const primaryWidth = isLarge ? 148 : 112

  return <HStack spacing={isLarge ? 10 : 8} buttonStyle="plain">
    <Button intent={RecordMovementIntent({})}>
      <Text
        font={isLarge ? 18 : 16}
        foregroundStyle={themeColors.systemBlue}
        frame={{ width: primaryWidth, height: buttonHeight }}
        background={roundedBackground(themeColors.primaryButtonBackground, buttonHeight / 2)}
      >记录胎动</Text>
    </Button>
  </HStack>
}
```

- [ ] **Step 2: Update the callsite to remove `hasActive` prop**

In the `WidgetView` function, change:

```tsx
<ActionButtons family={family} />
```

Remove the `const hasActive = Boolean(state.active_cycle)` line if no longer used elsewhere (it isn't).

- [ ] **Step 3: Remove unused `CloseCycleIntent` import from `widget.tsx`**

Remove from the import line:

```ts
import { RecordMovementIntent } from "./app_intents"
```

(`CloseCycleIntent` is no longer imported in widget.tsx. It remains exported from `app_intents.tsx` for shortcut use.)

- [ ] **Step 4: Commit**

```bash
git add widget.tsx
git commit -m "feat: remove close-cycle button from widget"
```

---

## Phase 2: UI Changes

### Task 4: Add `formatChineseDate` Helper

**Files:**
- Modify: `utils/date.ts`

- [ ] **Step 1: Add `formatChineseDateFromDayKey` for converting day_key strings**

The history page and today card need to format a `day_key` string (e.g. "2026-05-28") to Chinese date. Add in `utils/date.ts`:

```ts
export function formatChineseDateFromDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number)
  return `${year}年${month}月${day}日`
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/date.ts
git commit -m "feat: add Chinese date format helper"
```

---

### Task 5: Narrow Main Page to Today Only

**Files:**
- Modify: `index.tsx` (cards filtering)
- Modify: `pages/records.tsx` (section title, card title format)

- [ ] **Step 1: Filter cards to today-only in `index.tsx`**

In `index.tsx`, change what's passed to `RecordsPage`. Currently:

```tsx
<RecordsPage
  state={state}
  cards={cards}
  nowTs={nowTs}
  onRecord={() => { void handleRecord() }}
  onCloseCycle={() => setConfirmAction("close_cycle")}
/>
```

Change to pass only today's card:

```tsx
const todayKey = formatDayKey(nowTs)
const todayCards = cards.filter(card => card.day_key === todayKey)
```

Then pass `todayCards` instead of `cards`:

```tsx
<RecordsPage
  state={state}
  cards={todayCards}
  nowTs={nowTs}
  onRecord={() => { void handleRecord() }}
  onCloseCycle={() => setConfirmAction("close_cycle")}
/>
```

Add `formatDayKey` to the import from `"./utils"` if not already imported.

- [ ] **Step 2: Update section title and card title in `pages/records.tsx`**

Change the section title:

```tsx
<Text font="headline" fontWeight="medium">今日记录</Text>
```

In `DayCardView`, update the title line. Currently:

```tsx
<Text font="headline" fontWeight="medium">{isToday ? `今天 ${card.day_key.slice(5)}` : card.day_key}</Text>
```

Change to use Chinese date format:

```tsx
<Text font="headline" fontWeight="medium">{formatChineseDateFromDayKey(card.day_key)}</Text>
```

The `isToday` variable and its conditional subtitle are no longer needed since only today's cards are shown. Simplify:

```tsx
<Text font="caption" foregroundStyle={card.has_active_cycle ? themeColors.activeSubtitle : themeColors.secondaryLabel}>
  {card.has_active_cycle ? "● 含正在进行周期" : "已完成计数"}
</Text>
```

Update imports in `pages/records.tsx` — remove `formatDayKey` (no longer needed after removing `isToday` check), add `formatChineseDateFromDayKey`:

```ts
import { formatChineseDateFromDayKey, formatMinuteRemaining, formatTime } from "../utils"
```

- [ ] **Step 3: Commit**

```bash
git add index.tsx pages/records.tsx
git commit -m "feat: narrow main page to show today's records only"
```

---

### Task 6: Add `deleteCycle` to Model

**Files:**
- Modify: `common/model.ts`
- Modify: `tests/model_test.ts`

- [ ] **Step 1: Add `deleteCycle` function in `common/model.ts`**

Add after the `closeCycle` function:

```ts
export function deleteCycle(cycleId: string): CommandResult {
  const nowTs = Date.now()
  const { state } = readState()
  const before = state.completed_cycles.length
  state.completed_cycles = state.completed_cycles.filter(c => c.cycle_id !== cycleId)
  const removed = before - state.completed_cycles.length
  saveState(state)
  if (removed === 0) {
    return result("close_cycle", "app", nowTs, "not_found", "删除周期", "未找到该周期。")
  }
  return result("close_cycle", "app", nowTs, "deleted", "删除周期", "已删除该周期。")
}
```

- [ ] **Step 2: Add deleteCycle test in `tests/model_test.ts`**

Add before the migration test block, after a record+expire flow to create a completed cycle:

```ts
// Test deleteCycle
saveState(defaultState())
const delBase = Date.now() - 2 * 60 * 60 * 1000
await recordMovement(delBase, "app")
// Wait for cycle to expire by reading state with a future timestamp
const expiredState = loadStateWithLazyArchive(delBase + 61 * 60 * 1000)
assert(expiredState.completed_cycles.length === 1, "expired cycle archived for delete test")
const cycleToDelete = expiredState.completed_cycles[0].cycle_id

const deleteResult = deleteCycle(cycleToDelete)
assert(deleteResult.status === "deleted", "deleteCycle returns deleted status")
const afterDelete = readState().state
assert(afterDelete.completed_cycles.length === 0, "cycle removed after delete")

const notFound = deleteCycle("nonexistent-id")
assert(notFound.status === "not_found", "deleteCycle returns not_found for missing cycle")
```

Add `deleteCycle` and `loadStateWithLazyArchive` to the import:

```ts
import { recordMovement, closeCycle, resetState, deleteCycle, loadStateWithLazyArchive } from "../common/model"
```

- [ ] **Step 3: Commit**

```bash
git add common/model.ts tests/model_test.ts
git commit -m "feat: add deleteCycle function for removing completed cycles"
```

---

### Task 7: Create History Page

**Files:**
- Create: `pages/history.tsx`

- [ ] **Step 1: Create `pages/history.tsx`**

```tsx
import {
  Button,
  HStack,
  Label,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { roundedBackground, smallCardRadius, themeColors } from "../common/theme"
import { Cycle, DayCard } from "../common/types"
import { formatChineseDateFromDayKey, formatTime } from "../utils"

function HistoryCycleRow({
  cycle,
  onDelete,
}: {
  cycle: Cycle
  onDelete?: (cycleId: string) => void
}) {
  const isActive = !cycle.close_reason
  const swipe = onDelete ? {
    allowsFullSwipe: false,
    actions: [
      <Button
        role="destructive"
        action={() => onDelete(cycle.cycle_id)}
      >
        <Label title="删除" systemImage="trash" />
      </Button>,
    ],
  } : undefined

  return <HStack
    spacing={12}
    padding={13}
    background={roundedBackground(isActive ? themeColors.activeCycleBackground : themeColors.pillBackground, smallCardRadius)}
    listRowInsets={0}
    listRowSeparator="hidden"
    listRowBackground={<VStack />}
    trailingSwipeActions={swipe}
  >
    <VStack alignment="leading" spacing={4}>
      <HStack spacing={6}>
        <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>
          {formatTime(cycle.started_ts)}-{formatTime(cycle.scheduled_end_ts)}
        </Text>
        {isActive ? <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text> : null}
      </HStack>
      <HStack spacing={10}>
        <Text font="caption" foregroundStyle={themeColors.label}>有效 {cycle.effective_count}</Text>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>点击 {cycle.total_count}</Text>
      </HStack>
    </VStack>
    <Spacer />
  </HStack>
}

function HistoryEmpty() {
  return <VStack
    alignment="center"
    spacing={8}
    padding={28}
    background={roundedBackground(themeColors.emptyStateBackground)}
    foregroundStyle={themeColors.label}
  >
    <Text font="title3" fontWeight="semibold">暂无历史记录</Text>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>完成一个计数周期后，记录会出现在这里。</Text>
  </VStack>
}

export function HistoryPage({
  cards,
  onDeleteCycle,
}: {
  cards: DayCard[]
  onDeleteCycle: (cycleId: string) => void
}) {
  if (cards.length === 0) {
    return <VStack alignment="leading" spacing={14} padding={12}>
      <HistoryEmpty />
    </VStack>
  }

  const allCycles = cards.flatMap(card => card.cycles)
  const listHeight = Math.max(200, allCycles.length * 70 + cards.length * 40 + 20)

  return <VStack alignment="leading" spacing={0} padding={{ horizontal: 12 }}>
    <List
      listStyle="plain"
      listRowSpacing={8}
      frame={{ height: listHeight }}
    >
      {cards.map(card =>
        <Section header={
          <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.secondaryLabel}>
            {formatChineseDateFromDayKey(card.day_key)}
          </Text>
        }>
          {card.cycles.map(cycle =>
            <HistoryCycleRow
              cycle={cycle}
              onDelete={cycle.close_reason ? onDeleteCycle : undefined}
            />
          )}
        </Section>
      )}
    </List>
  </VStack>
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/history.tsx
git commit -m "feat: create history page with swipe-to-delete"
```

---

### Task 8: Wire Up History Tab in `index.tsx`

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Add imports**

Add to the imports at the top of `index.tsx`:

```ts
import { HistoryPage } from "./pages/history"
import { deleteCycle } from "./common/model"
```

(`Dialog` is a global in the scripting framework — no import needed, confirmed working in prototype.)

- [ ] **Step 2: Add delete handler function**

Inside `MainPage`, add:

```ts
async function handleDeleteCycle(cycleId: string) {
  const ok = await Dialog.confirm({
    title: "确认删除此周期？",
    message: "删除后不可恢复。",
    cancelLabel: "取消",
    confirmLabel: "删除",
  })
  if (ok) {
    deleteCycle(cycleId)
    refresh("已删除该周期。")
    Widget.reloadAll()
  }
}
```

- [ ] **Step 3: Add the History tab between 记录 and 设置**

Insert a new `<Tab>` block after the 记录 tab closing `</Tab>` and before the 设置 tab:

```tsx
<Tab title="历史" systemImage="clock.arrow.circlepath">
  <NavigationStack>
    <ScrollView
      onAppear={() => refresh()}
      navigationTitle="历史记录"
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        cancellationAction: <Button title="关闭" action={dismiss} />,
        primaryAction: <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
      }}
      toast={{
        message: toastMessage,
        isPresented: showToast,
        onChanged: setShowToast,
        duration: 2,
        position: "bottom",
      }}
    >
      <HistoryPage
        cards={allCards}
        onDeleteCycle={(cycleId) => { void handleDeleteCycle(cycleId) }}
      />
    </ScrollView>
  </NavigationStack>
</Tab>
```

**Important:** `cards` from `buildDayCards(state)` is limited to 30 days by `RECENT_DAY_LIMIT`. For the history page, we need all records. Add a separate call in `MainPage`:

```ts
const allCards = buildDayCards(state, Infinity)
```

Pass `allCards` to `HistoryPage` and keep `cards` (30-day limit) for the settings page data overview. Pass `todayCards` (filtered from `cards`) to `RecordsPage`.

- [ ] **Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat: add History tab with swipe-to-delete cycle management"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Read all modified files and check for consistency**

Verify imports, function signatures, and prop names match across all files.

- [ ] **Step 2: Check linter errors**

Run linter on all modified files: `index.tsx`, `pages/records.tsx`, `pages/history.tsx`, `common/model.ts`, `common/storage.ts`, `utils/date.ts`, `widget.tsx`.

- [ ] **Step 3: Run tests**

Run model test and stats test to verify no regressions. Note: stats_test.ts has a test with `is_valid: false` cycle — after Phase 1 migration, `buildDayCards` uses `getVisibleCycles` which already filtered those. The test creates state directly without going through `readState`/`migrateStateIfNeeded`, so it still works. Verify this.

- [ ] **Step 4: Manual smoke test checklist**

1. Open app → main page shows only today's data with Chinese date format
2. Record a movement → cycle appears on main page and in History tab
3. Tap "结束当前周期" → confirmation dialog appears with "系统将不会保存这次的数据"
4. Confirm → cycle disappears (not in history either)
5. History tab → shows all past days grouped by date
6. Swipe left on a completed cycle → red "删除" button appears
7. Tap "删除" → confirmation dialog → cycle removed
8. Widget → only shows "记录胎动" button, no "结束" button
9. Empty state → no records shows "还没有胎动记录" on main page, "暂无历史记录" on history tab

- [ ] **Step 5: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address review feedback from final verification"
```
