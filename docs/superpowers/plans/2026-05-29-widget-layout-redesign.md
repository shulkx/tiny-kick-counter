# Widget Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the widget to have per-family layouts (systemSmall/Medium/Large) and responsive sizing via `rpt()` so it works across all iPhone models.

**Architecture:** Add a `rpt()` responsive scaling utility (ported from Epical), then split `widget.tsx` into per-family view components (SmallView, MediumView, LargeView) with a top-level dispatcher. The `selectWidgetRows` function gets a `maxRows` parameter to support the Large layout's cycle list.

**Tech Stack:** TypeScript, JSX (scripting framework — SwiftUI-like components: VStack, HStack, Text, Button, Widget, etc.)

**Spec:** `docs/superpowers/specs/2026-05-28-widget-layout-redesign.md`

**Bundler constraint:** Entry files (`widget.tsx`) must import `common/` modules ONLY through `./common/model`. Imports from `./utils` are fine. See `.cursor/rules/bundler-imports.md`.

---

### Task 1: Add responsive scaling utility

**Files:**
- Create: `utils/responsive.ts`
- Modify: `utils/index.ts`

- [ ] **Step 1: Create `utils/responsive.ts`**

```typescript
// utils/responsive.ts
import { Widget } from "scripting"

const vmin = (n: number) => {
  const { width, height } = Widget.displaySize
  return (n * Math.min(width, height)) / 100
}

export const rpt = (n: number) => vmin((n * 100) / 155)
```

- [ ] **Step 2: Add re-export in `utils/index.ts`**

Add this line to `utils/index.ts`:

```typescript
export * from "./responsive"
```

The file should become:

```typescript
export * from "./date"
export * from "./command"
export * from "./responsive"
```

- [ ] **Step 3: Commit**

```bash
git add utils/responsive.ts utils/index.ts
git commit -m "feat(widget): add rpt() responsive scaling utility"
```

---

### Task 2: Add `maxRows` parameter to `selectWidgetRows`

**Files:**
- Modify: `common/stats.ts:54-66`

- [ ] **Step 1: Update `selectWidgetRows` signature and implementation**

Replace the current `selectWidgetRows` function in `common/stats.ts` with:

```typescript
export function selectWidgetRows(card: DayCard | null, maxRows = 2): { rows: WidgetCycleRow[]; hiddenCount: number } {
  if (!card) return { rows: [], hiddenCount: 0 }
  const active = card.cycles.find(cycle => !cycle.close_reason)
  const completed = card.cycles.filter(cycle => cycle.close_reason === "expired")
  const rows: WidgetCycleRow[] = []
  if (active) rows.push({ cycle: active, label: "当前", isActive: true })
  for (const cycle of completed) {
    if (rows.length >= maxRows) break
    rows.push({ cycle, label: "上轮", isActive: false })
  }
  const hiddenCount = Math.max(0, card.cycles.length - rows.length)
  return { rows, hiddenCount }
}
```

The only change is `selectWidgetRows(card: DayCard | null)` → `selectWidgetRows(card: DayCard | null, maxRows = 2)` and `rows.length >= 2` → `rows.length >= maxRows`. Default value preserves existing behavior for all current callers.

- [ ] **Step 2: Commit**

```bash
git add common/stats.ts
git commit -m "feat(widget): add maxRows parameter to selectWidgetRows"
```

---

### Task 3: Rewrite `widget.tsx` with per-family layouts

**Files:**
- Modify: `widget.tsx` (full rewrite)

This is the main task. The new `widget.tsx` has four components:
- `SmallView` — systemSmall layout
- `MediumView` — systemMedium layout (refactored from current WidgetView)
- `LargeView` — systemLarge/ExtraLarge layout
- `WidgetView` — dispatcher that picks the right view by `Widget.family`

Plus shared sub-components extracted for reuse:
- `StatusCardSmall` — the compact status card for systemSmall
- `StatusCard` — the standard status card for medium/large
- `ActionButton` — the "记录胎动" button
- `Summary` — the daily summary header (medium/large only)
- `CycleRow` — a single completed cycle row (large only)

- [ ] **Step 1: Replace `widget.tsx` with the new implementation**

Replace the entire contents of `widget.tsx` with:

```tsx
import { Button, HStack, Script, Spacer, Text, VStack, Widget } from "scripting"
import { RecordMovementIntent } from "./app_intents"
import {
  getTodayCard,
  loadStateWithLazyArchive,
  roundedBackground,
  selectWidgetRows,
  themeColors,
  widgetCardRadius,
} from "./common/model"
import type { FetalMovementState } from "./common/model"
import { formatMinuteRemaining, formatTime, rpt } from "./utils"

type WidgetRow = ReturnType<typeof selectWidgetRows>["rows"][number]
type Card = ReturnType<typeof getTodayCard>

function Summary({ card }: { card: Card }) {
  const estimated = card?.estimated_count ?? 0

  return <VStack alignment="leading" spacing={rpt(2)} frame={{ maxWidth: "infinity" }}>
    <HStack alignment="top">
      <VStack alignment="leading" spacing={rpt(3)}>
        <Text font={rpt(13)} fontWeight="bold" foregroundStyle={themeColors.label}>今日胎动</Text>
        <Text font={rpt(10)} foregroundStyle={themeColors.secondaryLabel}>
          {card ? `已计${card.counted_hours}小时 · 有效${card.effective_total}次` : "还没有记录"}
        </Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={0}>
        <Text font={rpt(9)} foregroundStyle={themeColors.secondaryLabel}>推算</Text>
        <Text font={rpt(20)} fontWeight="bold" foregroundStyle={themeColors.label}>{estimated}</Text>
      </VStack>
    </HStack>
  </VStack>
}

function StatusCard({ row, nowTs }: { row?: WidgetRow; nowTs: number }) {
  if (!row) {
    return <VStack
      alignment="leading"
      spacing={rpt(4)}
      padding={{ horizontal: rpt(10), vertical: rpt(7) }}
      background={roundedBackground(themeColors.widgetNeutralCardBackground, rpt(widgetCardRadius))}
      frame={{ maxWidth: "infinity" }}
    >
      <Text font={rpt(10)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>准备开始</Text>
      <Text font={rpt(10)} foregroundStyle={themeColors.secondaryLabel}>点击下方按钮开始 1 小时计数</Text>
    </VStack>
  }

  const cycle = row.cycle
  const time = `${formatTime(cycle.started_ts)}–${formatTime(cycle.scheduled_end_ts)}`
  const title = row.isActive ? "进行中" : "最近一轮"
  const trailing = row.isActive ? `剩${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)}分` : "已完成"

  return <VStack
    alignment="leading"
    spacing={rpt(4)}
    padding={{ horizontal: rpt(10), vertical: rpt(7) }}
    background={roundedBackground(row.isActive ? themeColors.widgetActiveCardBackground : themeColors.widgetNeutralCardBackground, rpt(widgetCardRadius))}
    frame={{ maxWidth: "infinity" }}
  >
    <HStack>
      <Text font={rpt(10)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{title}</Text>
      <Spacer />
      <Text font={rpt(10)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{trailing}</Text>
    </HStack>
    <Text font={rpt(10)} foregroundStyle={themeColors.label}>{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
  </VStack>
}

function StatusCardSmall({ row, nowTs }: { row?: WidgetRow; nowTs: number }) {
  if (!row) {
    return <VStack
      alignment="center"
      spacing={rpt(4)}
      padding={{ horizontal: rpt(10), vertical: rpt(8) }}
      background={roundedBackground(themeColors.widgetNeutralCardBackground, rpt(10))}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <Text font={rpt(9)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>准备开始</Text>
      <Text font={rpt(8)} foregroundStyle={themeColors.secondaryLabel} multilineTextAlignment="center">
        {"点击下方按钮\n开始 1 小时计数"}
      </Text>
    </VStack>
  }

  const cycle = row.cycle
  const time = `${formatTime(cycle.started_ts)}–${formatTime(cycle.scheduled_end_ts)}`
  const title = row.isActive ? "进行中" : "最近一轮"
  const trailing = row.isActive ? `剩${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)}分` : "已完成"

  return <VStack
    alignment="center"
    spacing={0}
    padding={{ horizontal: rpt(10), vertical: rpt(8) }}
    background={roundedBackground(row.isActive ? themeColors.widgetActiveCardBackground : themeColors.widgetNeutralCardBackground, rpt(10))}
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <HStack frame={{ maxWidth: "infinity" }}>
      <Text font={rpt(9)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{title}</Text>
      <Spacer />
      <Text font={rpt(9)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{trailing}</Text>
    </HStack>
    <HStack alignment="lastTextBaseline" spacing={rpt(2)} padding={{ top: rpt(4) }}>
      <Text font={rpt(22)} fontWeight="bold" foregroundStyle={themeColors.label}>{cycle.effective_count}</Text>
      <Text font={rpt(10)} foregroundStyle={themeColors.secondaryLabel}>次有效</Text>
    </HStack>
    <Text font={rpt(8)} foregroundStyle={themeColors.secondaryLabel} padding={{ top: rpt(2) }}>
      {time} · 点击{cycle.total_count}次
    </Text>
  </VStack>
}

function ActionButton({ fontSize, height, width }: { fontSize: number; height: number; width?: number }) {
  return <HStack buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
    <Spacer />
    <Button intent={RecordMovementIntent({})}>
      <Text
        font={fontSize}
        fontWeight="semibold"
        foregroundStyle={themeColors.systemBlue}
        frame={{ width: width, height: height }}
        background={roundedBackground(themeColors.primaryButtonBackground, height / 2)}
      >记录胎动</Text>
    </Button>
    <Spacer />
  </HStack>
}

function CycleRow({ cycle, index }: { cycle: WidgetRow["cycle"]; index: number }) {
  const time = `${formatTime(cycle.started_ts)}–${formatTime(cycle.scheduled_end_ts)}`
  return <VStack
    alignment="leading"
    spacing={rpt(2)}
    padding={{ horizontal: rpt(10), vertical: rpt(6) }}
    background={roundedBackground(themeColors.widgetNeutralCardBackground, rpt(10))}
    frame={{ maxWidth: "infinity" }}
  >
    <HStack>
      <Text font={rpt(9)} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>第 {index} 轮</Text>
      <Spacer />
      <Text font={rpt(9)} foregroundStyle={themeColors.secondaryLabel}>已完成</Text>
    </HStack>
    <Text font={rpt(9)} foregroundStyle={themeColors.label}>{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
  </VStack>
}

function SmallView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card)
  const primaryRow = rows[0]

  return <VStack
    alignment="leading"
    spacing={0}
    padding={{ top: rpt(14), bottom: rpt(12), leading: rpt(14), trailing: rpt(14) }}
    foregroundStyle={themeColors.label}
  >
    <Text font={rpt(10)} fontWeight="bold" foregroundStyle={themeColors.label}>胎动记录</Text>
    <VStack padding={{ top: rpt(8) }} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <StatusCardSmall row={primaryRow} nowTs={nowTs} />
    </VStack>
    <VStack padding={{ top: rpt(8) }}>
      <ActionButton fontSize={rpt(12)} height={rpt(28)} />
    </VStack>
  </VStack>
}

function MediumView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card)
  const primaryRow = rows[0]

  return <VStack
    alignment="leading"
    spacing={rpt(8)}
    padding={{ horizontal: rpt(16), vertical: rpt(12) }}
    foregroundStyle={themeColors.label}
  >
    <Summary card={card} />
    <StatusCard row={primaryRow} nowTs={nowTs} />
    <ActionButton fontSize={rpt(14)} height={rpt(28)} width={rpt(120)} />
  </VStack>
}

function LargeView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card, 6)
  const primaryRow = rows[0]
  const completedRows = rows.filter(r => !r.isActive)

  return <VStack
    alignment="leading"
    spacing={rpt(8)}
    padding={{ horizontal: rpt(18), vertical: rpt(16) }}
    foregroundStyle={themeColors.label}
  >
    <Summary card={card} />
    <StatusCard row={primaryRow} nowTs={nowTs} />
    <ActionButton fontSize={rpt(14)} height={rpt(32)} width={rpt(140)} />
    {completedRows.length > 0 ? <VStack alignment="leading" spacing={rpt(6)} frame={{ maxWidth: "infinity" }}>
      <VStack frame={{ maxWidth: "infinity", height: 1 }} background={themeColors.tertiaryLabel} padding={{ horizontal: rpt(4) }} />
      <Text font={rpt(9)} fontWeight="semibold" foregroundStyle={themeColors.secondaryLabel}>今日周期记录</Text>
      {completedRows.map((row, i) =>
        <CycleRow key={row.cycle.cycle_id} cycle={row.cycle} index={completedRows.length - i} />
      )}
    </VStack> : null}
    <Spacer />
  </VStack>
}

function WidgetView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const family = Widget.family
  if (family === "systemSmall") {
    return <SmallView state={state} nowTs={nowTs} />
  }
  if (family === "systemLarge" || family === "systemExtraLarge") {
    return <LargeView state={state} nowTs={nowTs} />
  }
  return <MediumView state={state} nowTs={nowTs} />
}

const nowTs = Date.now()
const state = loadStateWithLazyArchive(nowTs)

const nextReload = state.active_cycle
  ? new Date(Math.min(nowTs + 5 * 60 * 1000, state.active_cycle.scheduled_end_ts + 1000))
  : undefined

Widget.present(<WidgetView state={state} nowTs={nowTs} />, nextReload ? { policy: "after", date: nextReload } : undefined)
Script.exit()
```

- [ ] **Step 2: Verify the widget previews correctly**

Use the `scripting_project` tool to preview the widget at each size:

```
scripting_project action: "widget" family: "systemSmall"
scripting_project action: "widget" family: "systemMedium"
scripting_project action: "widget" family: "systemLarge"
```

Check that:
- systemSmall shows title + status card + button, no summary
- systemMedium shows summary + status card + button
- systemLarge shows summary + status card + button + cycle list

- [ ] **Step 3: Commit**

```bash
git add widget.tsx
git commit -m "feat(widget): per-family layouts with responsive rpt() scaling"
```

---

### Task 4: Visual review and fine-tuning

- [ ] **Step 1: Preview all three sizes and adjust spacing if needed**

Preview each widget family again and check:
1. systemSmall: text is readable, status card fills available space, button is touchable
2. systemMedium: spacing looks balanced, no text truncation
3. systemLarge: cycle list rows are visible, divider looks clean

If any spacing values need adjustment, tweak the `rpt()` arguments in the relevant component.

- [ ] **Step 2: Final commit (if any adjustments were made)**

```bash
git add widget.tsx
git commit -m "fix(widget): adjust spacing after visual review"
```
