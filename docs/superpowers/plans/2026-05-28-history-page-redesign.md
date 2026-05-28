# History Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the history page to fix three bugs: missing daily stats, delete crash, and double-scroll conflict.

**Architecture:** Replace the `ScrollView > VStack > List(plain)` structure with a single `List(insetGrouped)` as the sole scroll container. Each day becomes a `Section` with a summary row and per-cycle swipe-to-delete rows. Navigation props go directly on the List.

**Tech Stack:** TypeScript, scripting framework (SwiftUI-like: List, Section, trailingSwipeActions, Dialog.confirm)

**Spec:** `docs/superpowers/specs/2026-05-27-history-tab-and-cycle-deletion-design.md` (section 2b)

---

## File Structure

| File | Role | Action |
|---|---|---|
| `pages/history.tsx` | History page component | Rewrite: insetGrouped List with DaySummaryRow + CycleRow |
| `index.tsx` | App entry, tab wiring | Modify: remove ScrollView wrapper from History tab |

---

## Task 1: Rewrite `pages/history.tsx`

**Files:**
- Rewrite: `pages/history.tsx`

- [ ] **Step 1: Replace entire file with new implementation**

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
import { themeColors } from "../common/theme"
import { Cycle, DayCard } from "../common/types"
import { formatChineseDateFromDayKey, formatTime } from "../utils"

function DaySummaryRow({ card }: { card: DayCard }) {
  return <VStack alignment="leading" spacing={6} listRowSeparator="hidden">
    <HStack>
      <HStack spacing={6}>
        <Text font="headline" fontWeight="medium" foregroundStyle={themeColors.label}>
          {formatChineseDateFromDayKey(card.day_key)}
        </Text>
        {card.has_active_cycle
          ? <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text>
          : null}
      </HStack>
      <Spacer />
      <VStack alignment="trailing" spacing={1}>
        <Text font="title2" fontWeight="semibold" foregroundStyle={themeColors.systemRed}>
          {card.estimated_count}
        </Text>
        <Text font="caption2" foregroundStyle={themeColors.secondaryLabel}>推算次数</Text>
      </VStack>
    </HStack>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>
      {card.counted_hours}小时计数 · {card.effective_total}次有效胎动
    </Text>
  </VStack>
}

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
        tint={themeColors.systemRed}
        action={() => onDelete(cycle.cycle_id)}
      >
        <Label title="删除" systemImage="trash" />
      </Button>,
    ],
  } : undefined

  return <HStack trailingSwipeActions={swipe}>
    <HStack spacing={6}>
      <Text font="subheadline" foregroundStyle={themeColors.label}>
        {formatTime(cycle.started_ts)}-{formatTime(cycle.scheduled_end_ts)}
      </Text>
      {isActive ? <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text> : null}
    </HStack>
    <Spacer />
    <HStack spacing={10}>
      <Text font="subheadline" foregroundStyle={themeColors.label}>有效 {cycle.effective_count}</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>点击 {cycle.total_count}</Text>
    </HStack>
  </HStack>
}

function HistoryEmpty() {
  return <VStack alignment="center" spacing={8} padding={28}>
    <Text font="title3" fontWeight="semibold" foregroundStyle={themeColors.label}>暂无历史记录</Text>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>
      完成一个计数周期后，记录会出现在这里。
    </Text>
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
    return <List listStyle="insetGrouped">
      <HistoryEmpty />
    </List>
  }

  return <List listStyle="insetGrouped">
    {cards.map(card =>
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
  </List>
}
```

Key design notes:
- `List listStyle="insetGrouped"` — each Section auto-renders as a rounded card, List owns all scrolling
- `DaySummaryRow` — uses `listRowSeparator="hidden"` to avoid a line between the summary and first cycle row
- `HistoryCycleRow` — swipe Button uses `tint={themeColors.systemRed}` instead of `role="destructive"` to prevent auto-row-removal animation before Dialog.confirm
- `onDelete` is `undefined` for active cycles (no swipe action)
- No `frame({ height })`, no `listRowInsets`, no `listRowBackground` hacks needed with `insetGrouped`

- [ ] **Step 2: Commit**

```bash
git add pages/history.tsx
git commit -m "feat: rewrite history page with insetGrouped List and day stats"
```

---

## Task 2: Remove ScrollView wrapper from History tab in `index.tsx`

**Files:**
- Modify: `index.tsx:189-213` (History tab)

- [ ] **Step 1: Replace the History tab block**

Replace the current History tab (lines 189-213):

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

With this (navigation props move directly onto HistoryPage's root List):

```tsx
    <Tab title="历史" systemImage="clock.arrow.circlepath">
      <NavigationStack>
        <VStack
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
        </VStack>
      </NavigationStack>
    </Tab>
```

Architecture: The outer `VStack` is a non-scrolling container that holds navigation modifiers (title, toolbar, toast). The `HistoryPage` renders a `List(insetGrouped)` which handles all scrolling. No ScrollView = no double-scroll conflict.

- [ ] **Step 2: Remove unused `ScrollView` import if no longer needed**

Check if `ScrollView` is still used by other tabs (Records tab, Settings tab). It is — so keep the import.

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "fix: remove ScrollView wrapper from history tab to eliminate double scroll"
```

---

## Task 3: Verify on device

- [ ] **Step 1: Run linter on both files**

No linter errors expected.

- [ ] **Step 2: Manual verification checklist**

After deployment to device, verify:
1. History tab shows day cards with rounded corners (insetGrouped style)
2. Each day card has: date, ● for active, estimated count badge, summary subtitle
3. Cycle rows show time range + effective/click counts
4. Left-swipe on completed cycle reveals red "删除" button
5. Tapping "删除" shows Dialog.confirm BEFORE row is removed
6. Confirming delete removes cycle, stats recalculate, no crash
7. Scrolling is smooth with no gesture conflicts
8. No duplicate toolbar buttons (关闭/刷新 appear exactly once)
9. Toast messages work after deletion
10. Empty state shows correctly when all cycles are deleted
