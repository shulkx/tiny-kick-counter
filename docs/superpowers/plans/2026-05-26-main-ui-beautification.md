# Main UI Beautification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beautify Tiny Kick Counter's Scripting main UI with a warm dashboard-style records page, a settings page, and a bottom Liquid Glass segmented switcher.

**Architecture:** Keep the work focused in `index.tsx`, splitting the existing single-page UI into small view components: records page, settings page, daily cards, summary/stat rows, and bottom tabs. Existing model/stat functions remain unchanged; UI state adds only `selectedTab` for switching between records and settings.

**Tech Stack:** Scripting TSX components (`NavigationStack`, `ScrollView`, `VStack`, `HStack`, `Button`, `Text`, `Divider`, `Spacer`, optional `glassEffect`/`UIGlass`), existing TypeScript model/stat helpers, project verification via `scripting-ts project "Tiny Kick Counter" --check`.

---

## Confirmed Design Decisions

- Visual direction: warm maternity style with restrained iOS system clarity.
- Main page pattern: warm dashboard.
- Bottom switcher: floating two-tab capsule, `记录 | 设置`.
- Records page: top primary action card remains the place for `记录胎动` and `结束当前周期`.
- Daily cards: highlight `推算 XX 次 / 12小时` as the primary visual metric.
- Cycle details: today expands cycle rows; historical days show a compact summary.
- Toolbar: keep `关闭 + 刷新`; move `导出`、`恢复`、`重置` to settings.
- Settings page: include data overview, data management actions, and counting rules.
- Destructive/restore actions still require confirmation dialogs.

## Files

- Modify: `index.tsx`
  - Add `Menu` only if later needed; current plan uses settings page buttons instead.
  - Add `selectedTab` state.
  - Replace old `Header`, `DayCardView`, `CycleRow`, `SummaryPill`, `EmptyState` visuals with richer components.
  - Add `RecordsPage`, `SettingsPage`, `BottomGlassTabs`, and helper summary/stat components.
- Modify: `plan.md`
  - Keep this brainstorming/implementation summary for the current editor workflow.
- No model changes planned:
  - `common/model.ts` remains unchanged.
  - `common/stats.ts` remains unchanged unless implementation discovers a missing summary value that cannot be derived in UI.

---

### Task 1: Add tab state and page split

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Add a tab type near the imports/model helpers**

```tsx
type MainTab = "records" | "settings"
```

- [ ] **Step 2: Add selected tab state in `MainPage`**

Inside `MainPage`, near existing state declarations:

```tsx
const [selectedTab, setSelectedTab] = useState<MainTab>("records")
```

- [ ] **Step 3: Replace direct content rendering with page-level branching**

The content area should eventually follow this shape:

```tsx
<VStack alignment="leading" spacing={14} padding={12}>
  {selectedTab === "records"
    ? <RecordsPage
        state={state}
        cards={cards}
        nowTs={nowTs}
        onRecord={() => { void handleRecord() }}
        onCloseCycle={() => { void handleCloseCycle() }}
      />
    : <SettingsPage
        state={state}
        cards={cards}
        onExport={() => { void handleExport() }}
        onRestore={() => setConfirmAction("restore")}
        onReset={() => setConfirmAction("reset")}
      />}
  <BottomGlassTabs selectedTab={selectedTab} onChange={setSelectedTab} />
</VStack>
```

If fixed bottom overlays are unavailable or awkward in Scripting, keep the capsule at the bottom of the scroll content with extra bottom padding. Preserve usability over perfect floating behavior.

- [ ] **Step 4: Verify types**

Run:

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: no TypeScript diagnostics introduced by the split.

---

### Task 2: Build the warm records page

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Replace `Header` with a primary action card**

Create a component with this interface:

```tsx
function RecordsHeroCard({
  state,
  nowTs,
  onRecord,
  onCloseCycle,
}: {
  state: FetalMovementState
  nowTs: number
  onRecord: () => void
  onCloseCycle: () => void
}) {
  const activeCycle = state.active_cycle
  return <VStack alignment="leading" spacing={12} padding={16} background="rgba(255,244,238,0.92)">
    <VStack alignment="leading" spacing={4}>
      <Text font="title2">温柔记录每一次胎动</Text>
      <Text foregroundStyle="gray">
        {activeCycle
          ? `当前周期剩约 ${formatMinuteRemaining(nowTs, activeCycle.scheduled_end_ts)} 分钟`
          : "点击记录胎动开始 1 小时计数周期"}
      </Text>
    </VStack>
    <HStack spacing={10}>
      <Button title="记录胎动" systemImage="plus.circle.fill" action={onRecord} />
      {activeCycle ? <Button title="结束当前周期" systemImage="xmark.circle" role="destructive" action={onCloseCycle} /> : null}
    </HStack>
  </VStack>
}
```

Implementation may tune colors and spacing, but must keep the primary action at the top and avoid moving data-management actions back into the toolbar.

- [ ] **Step 2: Add `RecordsPage` wrapper**

```tsx
function RecordsPage({
  state,
  cards,
  nowTs,
  onRecord,
  onCloseCycle,
}: {
  state: FetalMovementState
  cards: DayCard[]
  nowTs: number
  onRecord: () => void
  onCloseCycle: () => void
}) {
  return <VStack alignment="leading" spacing={14}>
    <RecordsHeroCard state={state} nowTs={nowTs} onRecord={onRecord} onCloseCycle={onCloseCycle} />
    <Text font="headline">每日记录</Text>
    {cards.length === 0 ? <EmptyState /> : cards.map(card => <DayCardView card={card} nowTs={nowTs} />)}
  </VStack>
}
```

- [ ] **Step 3: Improve `EmptyState`**

Use a card-like warm background and keep the current message:

```tsx
function EmptyState() {
  return <VStack alignment="center" spacing={8} padding={28} background="rgba(255,244,238,0.78)">
    <Text font="title3">还没有胎动记录</Text>
    <Text foregroundStyle="gray">点击“记录胎动”开始第一个 1 小时计数周期。</Text>
  </VStack>
}
```

- [ ] **Step 4: Verify records page compiles**

Run:

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: no missing props, imports, or type errors.

---

### Task 3: Beautify daily cards and cycle summaries

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Replace `SummaryPill` with warmer stat blocks**

```tsx
function SummaryPill({ title, value }: { title: string; value: string | number }) {
  return <VStack alignment="leading" spacing={2} padding={10} background="rgba(255,255,255,0.56)">
    <Text font="caption" foregroundStyle="gray">{title}</Text>
    <Text font="headline">{value}</Text>
  </VStack>
}
```

- [ ] **Step 2: Keep `CycleRow` compact but improve status language**

The row must still show:

```tsx
const isActive = !cycle.close_reason
const timeRange = `${formatTime(cycle.started_ts)}-${formatTime(cycle.scheduled_end_ts)}`
const status = isActive
  ? `进行中 · 剩约 ${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)} 分钟`
  : "已完成"
```

Use warm/green subtle backgrounds for active cycles and gray subtle backgrounds for completed cycles.

- [ ] **Step 3: Update `DayCardView` to emphasize estimated 12-hour count**

Keep the component signature:

```tsx
function DayCardView({ card, nowTs }: { card: DayCard; nowTs: number })
```

Required visual hierarchy:

```tsx
<Text font="caption" foregroundStyle="gray">推算</Text>
<Text font="largeTitle">{card.estimated_count} 次</Text>
<Text font="caption" foregroundStyle="gray">/ 12小时</Text>
```

Required metrics:

```tsx
<SummaryPill title="计数小时" value={card.counted_hours} />
<SummaryPill title="有效胎动" value={card.effective_total} />
<SummaryPill title="总点击" value={card.total_clicks} />
```

- [ ] **Step 4: Implement today-expanded/history-summary behavior**

Determine today by local date key from the current time. Use the existing `card.day_key` format. If `card.day_key` equals today's day key, render all cycles:

```tsx
{card.cycles.map(cycle => <CycleRow cycle={cycle} nowTs={nowTs} />)}
```

For historical cards, render one summary line instead of all rows:

```tsx
<Text foregroundStyle="gray">
  {card.cycles.length} 个周期 · {card.has_active_cycle ? "含进行中周期" : "已完成计数"}
</Text>
```

If an existing date utility provides a safer day key formatter, use it. Otherwise derive with `new Date().toISOString().slice(0, 10)` only if it matches existing `day_key`; verify visually with existing data.

- [ ] **Step 5: Verify daily cards compile**

Run:

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: no type errors.

---

### Task 4: Add settings page with overview, management, and rules

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Add settings summary helpers**

Add helper functions near UI components:

```tsx
function getSettingsSummary(cards: DayCard[]) {
  const recordDays = cards.length
  const cycleCount = cards.reduce((sum, card) => sum + card.cycles.length, 0)
  const effectiveTotal = cards.reduce((sum, card) => sum + card.effective_total, 0)
  return { recordDays, cycleCount, effectiveTotal }
}
```

- [ ] **Step 2: Add a reusable settings row**

```tsx
function SettingsActionRow({
  title,
  subtitle,
  destructive,
  action,
}: {
  title: string
  subtitle: string
  destructive?: boolean
  action: () => void
}) {
  return <Button action={action}>
    <HStack spacing={10} padding={12} background={destructive ? "rgba(255,59,48,0.10)" : "rgba(255,255,255,0.56)"}>
      <VStack alignment="leading" spacing={3}>
        <Text font="headline" foregroundStyle={destructive ? "red" : "label"}>{title}</Text>
        <Text font="caption" foregroundStyle="gray">{subtitle}</Text>
      </VStack>
      <Spacer />
      <Text foregroundStyle={destructive ? "red" : "gray"}>{destructive ? "!" : ">"}</Text>
    </HStack>
  </Button>
}
```

- [ ] **Step 3: Add `SettingsPage`**

```tsx
function SettingsPage({
  state,
  cards,
  onExport,
  onRestore,
  onReset,
}: {
  state: FetalMovementState
  cards: DayCard[]
  onExport: () => void
  onRestore: () => void
  onReset: () => void
}) {
  const summary = getSettingsSummary(cards)
  return <VStack alignment="leading" spacing={14}>
    <VStack alignment="leading" spacing={4} padding={16} background="rgba(255,244,238,0.92)">
      <Text font="title2">设置</Text>
      <Text foregroundStyle="gray">管理数据、备份与计数规则</Text>
    </VStack>

    <VStack alignment="leading" spacing={10} padding={16} background="rgba(255,255,255,0.42)">
      <Text font="headline">数据概览</Text>
      <HStack spacing={8}>
        <SummaryPill title="记录天数" value={summary.recordDays} />
        <SummaryPill title="计数周期" value={summary.cycleCount} />
        <SummaryPill title="有效胎动" value={summary.effectiveTotal} />
      </HStack>
    </VStack>

    <VStack alignment="leading" spacing={10} padding={16} background="rgba(255,255,255,0.42)">
      <Text font="headline">数据管理</Text>
      <SettingsActionRow title="导出备份" subtitle="保存当前胎动数据 JSON" action={onExport} />
      <SettingsActionRow title="从备份恢复" subtitle="恢复前会自动生成安全备份" action={onRestore} />
      <SettingsActionRow title="重置全部数据" subtitle="清空当前周期和全部历史记录" destructive action={onReset} />
    </VStack>

    <VStack alignment="leading" spacing={8} padding={16} background="rgba(255,255,255,0.42)">
      <Text font="headline">计数规则</Text>
      <Text foregroundStyle="gray">• 1 小时为一个计数周期</Text>
      <Text foregroundStyle="gray">• 5 分钟内连续点击计为子胎动</Text>
      <Text foregroundStyle="gray">• 推算 = 有效胎动 / 计数小时 × 12</Text>
      <Text foregroundStyle="gray">• 手动提前结束的周期不参与普通统计</Text>
    </VStack>
  </VStack>
}
```

Keep `state` in the props even if not used initially so the settings page can later display active-cycle status without changing the interface. If the compiler rejects unused variables in this environment, remove `state` from props and call sites.

- [ ] **Step 4: Verify settings page compiles**

Run:

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: no type errors.

---

### Task 5: Move export/restore/reset from toolbar to settings and keep confirmation behavior

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Simplify toolbar**

Change toolbar primary actions from:

```tsx
primaryAction: [
  <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
  <Button title="导出" action={() => { void handleExport() }} />,
  <Button title="恢复" action={() => setConfirmAction("restore")} />,
],
destructiveAction: <Button title="重置" role="destructive" action={() => setConfirmAction("reset")} />,
```

to:

```tsx
primaryAction: <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
```

Keep:

```tsx
cancellationAction: <Button title="关闭" action={dismiss} />,
```

- [ ] **Step 2: Ensure settings actions call existing handlers**

Settings page call site must pass:

```tsx
onExport={() => { void handleExport() }}
onRestore={() => setConfirmAction("restore")}
onReset={() => setConfirmAction("reset")}
```

- [ ] **Step 3: Preserve existing confirmation dialog**

Do not remove or weaken:

```tsx
confirmationDialog={{
  title: confirmAction === "restore" ? "从备份恢复？" : "重置胎动数据？",
  isPresented: confirmAction !== null,
  ...
}}
```

- [ ] **Step 4: Verify toolbar behavior compiles**

Run:

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: toolbar type remains valid. If `primaryAction` requires an array in this Scripting version, use:

```tsx
primaryAction: [<Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />],
```

---

### Task 6: Add bottom glass tab capsule

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Add `BottomGlassTabs` component**

```tsx
function BottomGlassTabs({
  selectedTab,
  onChange,
}: {
  selectedTab: MainTab
  onChange: (tab: MainTab) => void
}) {
  const recordSelected = selectedTab === "records"
  const settingsSelected = selectedTab === "settings"
  return <HStack spacing={4} padding={6} background="rgba(255,255,255,0.52)" glassEffect={UIGlass.clear().interactive(true).tint("rgba(255,214,204,0.45)")}>
    <Button action={() => onChange("records")}>
      <HStack spacing={4} padding={10} background={recordSelected ? "rgba(255,149,128,0.24)" : "rgba(255,255,255,0)"}>
        <Text foregroundStyle={recordSelected ? "label" : "gray"}>记录</Text>
      </HStack>
    </Button>
    <Button action={() => onChange("settings")}>
      <HStack spacing={4} padding={10} background={settingsSelected ? "rgba(255,149,128,0.24)" : "rgba(255,255,255,0)"}>
        <Text foregroundStyle={settingsSelected ? "label" : "gray"}>设置</Text>
      </HStack>
    </Button>
  </HStack>
}
```

If `glassEffect` or `UIGlass` fails diagnostics because of deployment/runtime constraints, remove the `glassEffect={...}` prop and keep the translucent rounded capsule styling. The visual requirement is graceful degradation, not hard failure on non-iOS-26 environments.

- [ ] **Step 2: Place the tab capsule at the bottom of content**

At the end of the main `VStack`, after the selected page:

```tsx
<BottomGlassTabs selectedTab={selectedTab} onChange={setSelectedTab} />
```

Add enough bottom spacing/padding around it so it reads as a bottom control. If Scripting supports a safe-area inset/floating overlay in this project, use that; otherwise keep it as the final scroll item.

- [ ] **Step 3: Verify glass tab compiles**

Run:

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: either the glass version compiles, or the fallback translucent version compiles after removing unsupported `glassEffect` usage.

---

### Task 7: Final polish and validation

**Files:**
- Modify: `index.tsx`
- Modify: `plan.md` only if implementation changes scope

- [ ] **Step 1: Review visual hierarchy manually**

Check these conditions in the Scripting editor preview/run:

- Records tab opens by default.
- Top card contains `记录胎动`.
- Daily cards make `推算 XX 次 / 12小时` the largest data element.
- Today shows cycle rows.
- History cards show compact summary only.
- Settings tab shows overview, data management, and rules.
- Toolbar only shows `关闭 + 刷新`.
- Export/restore/reset are available from settings.
- Restore/reset confirmation dialogs still appear.

- [ ] **Step 2: Run project diagnostics**

```sh
scripting-ts project "Tiny Kick Counter" --check
```

Expected: no diagnostics.

- [ ] **Step 3: Optional runtime smoke test**

Run the script in Scripting and manually verify:

- Tap `记录胎动`: toast appears and record count changes.
- Tap `设置`: settings page appears without losing state.
- Tap `记录`: records page returns.
- Tap `刷新`: toast appears and widget reload is requested.
- Tap `导出备份`: export toast appears or a clear error is shown.
- Tap `从备份恢复`: confirmation dialog appears before file picker.
- Tap `重置全部数据`: destructive confirmation dialog appears.

---

## Self-Review

- Spec coverage: confirmed requirements are covered by Tasks 1-7.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: `MainTab`, `RecordsPage`, `SettingsPage`, and `BottomGlassTabs` signatures are defined before use in the plan.
- Scope check: the work is focused on UI only; model/data behavior remains unchanged.
