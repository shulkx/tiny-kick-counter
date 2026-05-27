# Refactoring & Code Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `index.tsx` by page, clean model/storage boundary, dedup lazy-archive logic, and add async-loading guard — without changing any user-visible behavior.

**Architecture:** Extract presentational components into `pages/records.tsx` and `pages/settings.tsx`, keep orchestration in `index.tsx`. Move `loadStateWithLazyArchive` into `common/model.ts` as a shared operation. Remove re-exports from `model.ts` so consumers import storage directly.

**Tech Stack:** TypeScript, Scripting framework (JSX with `createElement`/`Fragment` factory), `scripting-ts` CLI for type checking.

**Verification command:** `npx scripting-ts project "Tiny Kick Counter" --check` (run from `E:\scripting`)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `common/model.ts` | Modify | Add `loadStateWithLazyArchive`; later remove re-exports and unused import |
| `pages/records.tsx` | Create | RecordsHeroCard, SummaryPill, CycleRow, DayCardView, EmptyState, RecordsPage |
| `pages/settings.tsx` | Create | PlainCircleIcon, SettingsActionRow, SettingsPage |
| `index.tsx` | Rewrite | MainPage with state/handlers/TabView only (~150 lines) |
| `widget.tsx` | Modify | Use `loadStateWithLazyArchive` from model |
| `tests/model_test.ts` | Modify | Update imports to use `storage` directly |
| `.github/workflows/release.yml` | Modify | Add `pages/` to package step |

---

### Task 1: Add `loadStateWithLazyArchive` to `common/model.ts`

This task only adds the new function. Re-exports are kept intact so existing consumers stay working.

**Files:**
- Modify: `common/model.ts`

- [ ] **Step 1: Add `loadStateWithLazyArchive` function after `archiveExpiredCycleIfNeeded` (after line 101)**

```typescript
export function loadStateWithLazyArchive(nowTs = Date.now()): FetalMovementState {
  const { state } = readState()
  const archived = archiveExpiredCycleIfNeeded(state, nowTs)
  if (archived) saveState(state)
  return state
}
```

The required imports (`readState`, `saveState`, `FetalMovementState`) are already available inside `model.ts`.

- [ ] **Step 2: Run type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS — no breaking change, just a new export.

- [ ] **Step 3: Commit**

```bash
git add common/model.ts
git commit -m "refactor(model): add loadStateWithLazyArchive helper"
```

---

### Task 2: Create `pages/records.tsx`

**Files:**
- Create: `pages/records.tsx`

- [ ] **Step 1: Create `pages/` directory and `pages/records.tsx`**

```typescript
import {
  Button,
  Divider,
  HStack,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { cardShadow, roundedBackground, smallCardRadius, themeColors } from "../common/theme"
import { Cycle, DayCard, FetalMovementState } from "../common/types"
import { formatDayKey, formatMinuteRemaining, formatTime } from "../utils"

export function SummaryPill({ title, value }: { title: string; value: string | number }) {
  return <VStack
    alignment="leading"
    spacing={3}
    padding={11}
    background={roundedBackground(themeColors.pillBackground, smallCardRadius)}
  >
    <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>{title}</Text>
    <Text font="headline" fontWeight="medium" foregroundStyle={themeColors.label}>{value}</Text>
  </VStack>
}

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
  return <VStack
    alignment="leading"
    spacing={14}
    padding={18}
    background={roundedBackground(themeColors.heroCardBackground)}
    foregroundStyle={themeColors.label}
    shadow={cardShadow()}
  >
    <VStack alignment="leading" spacing={5}>
      <Text font="title3" fontWeight="medium">温柔记录每一次胎动</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>
        {activeCycle
          ? `当前周期剩约 ${formatMinuteRemaining(nowTs, activeCycle.scheduled_end_ts)} 分钟 · 已有效 ${activeCycle.effective_count} 次`
          : "点击记录胎动开始 1 小时计数周期"}
      </Text>
    </VStack>
    <HStack spacing={10}>
      <Button title="记录胎动" systemImage="plus.circle.fill" buttonStyle="borderedProminent" action={onRecord} />
      {activeCycle ? <Button title="结束当前周期" systemImage="xmark.circle" role="destructive" buttonStyle="bordered" action={onCloseCycle} /> : null}
    </HStack>
  </VStack>
}

function CycleRow({ cycle, nowTs }: { cycle: Cycle; nowTs: number }) {
  const isActive = !cycle.close_reason
  const timeRange = `${formatTime(cycle.started_ts)}-${formatTime(cycle.scheduled_end_ts)}`
  const status = isActive
    ? `进行中 · 剩约 ${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)} 分钟`
    : "已完成"

  return <VStack
    alignment="leading"
    spacing={7}
    padding={13}
    background={roundedBackground(isActive ? themeColors.activeCycleBackground : themeColors.pillBackground, smallCardRadius)}
  >
    <HStack>
      <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>{isActive ? "当前周期" : "计数周期"}</Text>
      <Spacer />
      {isActive ? <HStack spacing={4}>
        <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text>
        <Text font="caption" foregroundStyle={themeColors.activeStatusText}>{status}</Text>
      </HStack> : <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>{status}</Text>}
    </HStack>
    <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>{timeRange}</Text>
    <HStack spacing={12}>
      <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>有效 {cycle.effective_count} 次</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>点击 {cycle.total_count} 次</Text>
    </HStack>
  </VStack>
}

function DayCardView({ card, nowTs }: { card: DayCard; nowTs: number }) {
  const isToday = card.day_key === formatDayKey(nowTs)
  return <VStack
    alignment="leading"
    spacing={14}
    padding={16}
    background={roundedBackground(themeColors.cardBackground)}
    foregroundStyle={themeColors.label}
    shadow={cardShadow()}
  >
    <HStack>
      <VStack alignment="leading" spacing={5}>
        <Text font="headline" fontWeight="medium">{isToday ? `今天 ${card.day_key.slice(5)}` : card.day_key}</Text>
        <Text font="caption" foregroundStyle={card.has_active_cycle ? themeColors.activeSubtitle : themeColors.secondaryLabel}>{card.has_active_cycle ? "● 含正在进行周期" : "已完成计数"}</Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={1}>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>推算</Text>
        <Text font="title" fontWeight="medium">{card.estimated_count} 次</Text>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>/ 12小时</Text>
      </VStack>
    </HStack>
    <HStack spacing={8}>
      <SummaryPill title="计数小时" value={card.counted_hours} />
      <SummaryPill title="有效胎动" value={card.effective_total} />
      <SummaryPill title="总点击" value={card.total_clicks} />
    </HStack>
    <Divider />
    <VStack alignment="leading" spacing={8}>
      {isToday
        ? card.cycles.map(cycle => <CycleRow cycle={cycle} nowTs={nowTs} />)
        : <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>{card.cycles.length} 个周期 · {card.has_active_cycle ? "含进行中周期" : "已完成计数"}</Text>}
    </VStack>
  </VStack>
}

function EmptyState() {
  return <VStack
    alignment="center"
    spacing={8}
    padding={28}
    background={roundedBackground(themeColors.emptyStateBackground)}
    foregroundStyle={themeColors.label}
  >
    <Text font="title3" fontWeight="semibold">还没有胎动记录</Text>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>点击"记录胎动"开始第一个 1 小时计数周期。</Text>
  </VStack>
}

export function RecordsPage({
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
    <Text font="headline" fontWeight="medium">每日记录</Text>
    {cards.length === 0 ? <EmptyState /> : cards.map(card => <DayCardView card={card} nowTs={nowTs} />)}
  </VStack>
}
```

- [ ] **Step 2: Run type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS — new file adds exports but nothing depends on it yet, and existing code still compiles.

- [ ] **Step 3: Commit**

```bash
git add pages/records.tsx
git commit -m "refactor(ui): extract RecordsPage into pages/records.tsx"
```

---

### Task 3: Create `pages/settings.tsx`

**Files:**
- Create: `pages/settings.tsx`

- [ ] **Step 1: Create `pages/settings.tsx`**

```typescript
import {
  Button,
  Color,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { cardShadow, roundedBackground, smallCardRadius, themeColors } from "../common/theme"
import { DayCard } from "../common/types"
import { summarizeDayCards } from "../common/stats"
import { SummaryPill } from "./records"

function PlainCircleIcon({
  systemName,
  color,
}: {
  systemName: string
  color: Color
}) {
  return <Image
    systemName={systemName}
    font={24}
    fontWeight="medium"
    foregroundStyle={color}
    frame={{ width: 34, height: 34 }}
  />
}

function SettingsActionRow({
  title,
  subtitle,
  systemImage,
  tint,
  destructive,
  action,
}: {
  title: string
  subtitle: string
  systemImage: string
  tint: Color
  destructive?: boolean
  action: () => void
}) {
  const textColor = destructive ? themeColors.systemRed : themeColors.label
  return <Button action={action} buttonStyle="plain">
    <HStack
      spacing={12}
      padding={13}
      background={roundedBackground(destructive ? themeColors.destructiveBackground : themeColors.pillBackground, smallCardRadius)}
    >
      <PlainCircleIcon systemName={systemImage} color={tint} />
      <VStack alignment="leading" spacing={3}>
        <Text font="subheadline" fontWeight="medium" foregroundStyle={textColor}>{title}</Text>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>{subtitle}</Text>
      </VStack>
      <Spacer />
      <Image
        systemName={destructive ? "exclamationmark.triangle.fill" : "chevron.right"}
        font={13}
        fontWeight="semibold"
        foregroundStyle={destructive ? themeColors.systemRed : themeColors.tertiaryLabel}
      />
    </HStack>
  </Button>
}

export function SettingsPage({
  cards,
  onExport,
  onRestore,
  onReset,
}: {
  cards: DayCard[]
  onExport: () => void
  onRestore: () => void
  onReset: () => void
}) {
  const summary = summarizeDayCards(cards)
  return <VStack alignment="leading" spacing={14}>
    <VStack
      alignment="leading"
      spacing={5}
      padding={18}
      background={roundedBackground(themeColors.heroCardBackground)}
      foregroundStyle={themeColors.label}
      shadow={cardShadow()}
    >
      <Text font="title3" fontWeight="medium">设置</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>管理数据、备份与计数规则</Text>
    </VStack>

    <VStack
      alignment="leading"
      spacing={10}
      padding={16}
      background={roundedBackground(themeColors.groupedCardBackground)}
      foregroundStyle={themeColors.label}
      shadow={cardShadow()}
    >
      <Text font="headline" fontWeight="medium">数据概览</Text>
      <HStack spacing={8}>
        <SummaryPill title="记录天数" value={summary.recordDays} />
        <SummaryPill title="计数周期" value={summary.cycleCount} />
        <SummaryPill title="有效胎动" value={summary.effectiveTotal} />
      </HStack>
    </VStack>

    <VStack
      alignment="leading"
      spacing={10}
      padding={16}
      background={roundedBackground(themeColors.groupedCardBackground)}
      foregroundStyle={themeColors.label}
      shadow={cardShadow()}
    >
      <Text font="headline" fontWeight="medium">数据管理</Text>
      <SettingsActionRow title="导出备份" subtitle="保存当前胎动数据 JSON 文件" systemImage="square.and.arrow.up" tint="systemBlue" action={onExport} />
      <SettingsActionRow title="从备份恢复" subtitle="选择 JSON 备份；恢复前会自动安全备份" systemImage="arrow.clockwise.icloud" tint="systemGreen" action={onRestore} />
      <SettingsActionRow title="重置全部数据" subtitle="清空当前周期和全部历史记录，不能撤销" systemImage="trash.fill" tint={themeColors.systemRed} destructive action={onReset} />
    </VStack>

    <VStack
      alignment="leading"
      spacing={8}
      padding={16}
      background={roundedBackground(themeColors.groupedCardBackground)}
      foregroundStyle={themeColors.label}
      shadow={cardShadow()}
    >
      <Text font="headline" fontWeight="medium">计数规则</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>• 1 小时为一个计数周期</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>• 5 分钟内连续点击计为子胎动</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>• 推算 = 有效胎动 / 计数小时 × 12</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>• 手动提前结束的周期不参与普通统计</Text>
    </VStack>
  </VStack>
}
```

- [ ] **Step 2: Run type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add pages/settings.tsx
git commit -m "refactor(ui): extract SettingsPage into pages/settings.tsx"
```

---

### Task 4: Rewrite `index.tsx` to use extracted pages

**Files:**
- Modify: `index.tsx` (full rewrite to ~150 lines)

- [ ] **Step 1: Replace `index.tsx` with the orchestration-only version**

```typescript
import {
  AppEvents,
  Button,
  Navigation,
  NavigationStack,
  Script,
  ScrollView,
  Tab,
  TabView,
  Text,
  VStack,
  Widget,
  useEffect,
  useState,
} from "scripting"
import {
  closeCycle,
  loadStateWithLazyArchive,
  recordMovement,
  resetState,
  restoreBackupFromFile,
} from "./common/model"
import { createBackupFile } from "./common/storage"
import { buildDayCards } from "./common/stats"
import { themeColors } from "./common/theme"
import { FetalMovementState } from "./common/types"
import { RecordsPage } from "./pages/records"
import { SettingsPage } from "./pages/settings"

function MainPage() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<FetalMovementState>(() => loadStateWithLazyArchive())
  const [nowTs, setNowTs] = useState(Date.now())
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"reset" | "restore" | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  function refresh(message?: string) {
    setNowTs(Date.now())
    setState(loadStateWithLazyArchive())
    if (message) {
      setToastMessage(message)
      setShowToast(true)
    }
  }

  useEffect(() => {
    const handleScenePhase = (phase: "active" | "inactive" | "background") => {
      if (phase === "active") refresh()
    }
    AppEvents.scenePhase.addListener(handleScenePhase)
    return () => AppEvents.scenePhase.removeListener(handleScenePhase)
  }, [])

  function handleManualRefresh() {
    refresh("已刷新页面并请求更新小组件。")
    Widget.reloadAll()
  }

  async function handleRecord() {
    if (isRecording) return
    setIsRecording(true)
    try {
      const result = await recordMovement(Date.now(), "app")
      refresh(result.message)
      Widget.reloadAll()
    } finally {
      setIsRecording(false)
    }
  }

  async function handleCloseCycle() {
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

  async function handleExport() {
    try {
      const backup = await createBackupFile("manual")
      console.log(backup.json)
      refresh(`已导出备份：${backup.file_name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      refresh(`导出失败：${message}`)
    }
  }

  async function handleRestore() {
    setConfirmAction(null)
    try {
      const files = await DocumentPicker.pickFiles()
      const filePath = files[0]
      if (!filePath) {
        refresh("已取消恢复。")
        return
      }
      const result = await restoreBackupFromFile(filePath, Date.now(), "app")
      refresh(result.message)
      if (result.status === "restore") Widget.reloadAll()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      refresh(`恢复失败：${message}`)
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
    }
  }

  async function handleReset() {
    const result = await resetState()
    setConfirmAction(null)
    refresh(result.message)
    Widget.reloadAll()
  }

  const cards = buildDayCards(state)

  return <TabView>
    <Tab title="记录" systemImage="heart.text.square">
      <NavigationStack>
        <ScrollView
          onAppear={() => refresh()}
          navigationTitle="胎动记录"
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
          <VStack alignment="leading" spacing={14} padding={12} background={themeColors.pageBackground}>
            <RecordsPage
              state={state}
              cards={cards}
              nowTs={nowTs}
              onRecord={() => { void handleRecord() }}
              onCloseCycle={() => { void handleCloseCycle() }}
            />
          </VStack>
        </ScrollView>
      </NavigationStack>
    </Tab>

    <Tab title="设置" systemImage="gearshape">
      <NavigationStack>
        <ScrollView
          onAppear={() => refresh()}
          navigationTitle="设置"
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            cancellationAction: <Button title="关闭" action={dismiss} />,
            primaryAction: <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
          }}
          confirmationDialog={{
            title: confirmAction === "restore" ? "从备份恢复？" : "重置胎动数据？",
            isPresented: confirmAction !== null,
            onChanged: isPresented => { if (!isPresented) setConfirmAction(null) },
            message: <Text>{confirmAction === "restore" ? "恢复会用备份文件覆盖当前胎动数据。恢复前会自动生成一份安全备份。" : "此操作会清空当前周期和全部历史记录，不能撤销。"}</Text>,
            actions: <VStack>
              {confirmAction === "restore"
                ? <Button title="选择备份并恢复" role="destructive" action={() => { void handleRestore() }} />
                : <Button title="确认重置" role="destructive" action={() => { void handleReset() }} />}
              <Button title="取消" role="cancel" action={() => setConfirmAction(null)} />
            </VStack>,
          }}
          toast={{
            message: toastMessage,
            isPresented: showToast,
            onChanged: setShowToast,
            duration: 2,
            position: "bottom",
          }}
        >
          <VStack alignment="leading" spacing={14} padding={12} background={themeColors.pageBackground}>
            <SettingsPage
              cards={cards}
              onExport={() => { void handleExport() }}
              onRestore={() => setConfirmAction("restore")}
              onReset={() => setConfirmAction("reset")}
            />
          </VStack>
        </ScrollView>
      </NavigationStack>
    </Tab>
  </TabView>
}

async function run() {
  await Navigation.present(<MainPage />)
  Script.exit()
}

run()
```

- [ ] **Step 2: Run type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS — `index.tsx` now imports `createBackupFile` from `./common/storage` directly, and pages from `./pages/`. The old re-exports in `model.ts` are still present (not yet removed), so `widget.tsx` and `tests/model_test.ts` still compile.

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "refactor(index): slim down to orchestration only, use extracted pages"
```

---

### Task 5: Update `widget.tsx` to use `loadStateWithLazyArchive`

**Files:**
- Modify: `widget.tsx`

- [ ] **Step 1: Update imports — replace storage imports with `loadStateWithLazyArchive`**

Replace lines 1-7:

```typescript
import { Button, HStack, Script, Spacer, Text, VStack, Widget, WidgetFamily } from "scripting"
import { roundedBackground, themeColors, widgetCardRadius } from "./common/theme"
import { CloseCycleIntent, RecordMovementIntent } from "./app_intents"
import { loadStateWithLazyArchive } from "./common/model"
import { getTodayCard, selectWidgetRows } from "./common/stats"
import { FetalMovementState } from "./common/types"
import { formatMinuteRemaining, formatTime } from "./utils"
```

- [ ] **Step 2: Replace inline archive pattern (lines 108-111) with single call**

Replace:

```typescript
const nowTs = Date.now()
const { state } = readState()
const archived = archiveExpiredCycleIfNeeded(state, nowTs)
if (archived) saveState(state)
```

With:

```typescript
const nowTs = Date.now()
const state = loadStateWithLazyArchive(nowTs)
```

Lines 113-119 stay unchanged:

```typescript
const nextReload = state.active_cycle
  ? new Date(Math.min(nowTs + 5 * 60 * 1000, state.active_cycle.scheduled_end_ts + 1000))
  : undefined

Widget.present(<WidgetView state={state} nowTs={nowTs} />, nextReload ? { policy: "after", date: nextReload } : undefined)
Script.exit()
```

- [ ] **Step 3: Run type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add widget.tsx
git commit -m "refactor(widget): use shared loadStateWithLazyArchive"
```

---

### Task 6: Remove re-exports from `model.ts` and update test imports

Now that no consumer depends on re-exported storage symbols, remove them.

**Files:**
- Modify: `common/model.ts`
- Modify: `tests/model_test.ts`

- [ ] **Step 1: Update `tests/model_test.ts` imports**

Replace line 1:

```typescript
import { recordMovement, closeCycle, readState, saveState, defaultState, resetState, migrateStateIfNeeded } from "../common/model"
```

With:

```typescript
import { recordMovement, closeCycle, resetState, migrateStateIfNeeded } from "../common/model"
import { readState, saveState, defaultState } from "../common/storage"
```

- [ ] **Step 2: Remove re-export line from `common/model.ts`**

Delete the last line (line 314 in original, may have shifted due to Task 1 insertion):

```typescript
export { createBackup, createBackupFile, defaultState, exportState, getStateDirectory, getStateFilePath, migrateStateIfNeeded, parseBackupJson, readBackupFile, readState, restoreFromBackup, restoreFromBackupFile, saveState } from "./storage"
```

- [ ] **Step 3: Remove unused `exportState` from `model.ts` internal import**

On the import line from `"./storage"` (originally line 14), remove `exportState` since it is no longer used internally or re-exported.

Original:

```typescript
import { createBackupFile, defaultState, exportState, parseBackupJson, readState, restoreFromBackup, restoreFromBackupFile, saveState } from "./storage"
```

Updated:

```typescript
import { createBackupFile, defaultState, parseBackupJson, readState, restoreFromBackup, restoreFromBackupFile, saveState } from "./storage"
```

- [ ] **Step 4: Run type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS — all consumers now import storage symbols directly, test uses correct paths.

- [ ] **Step 5: Commit**

```bash
git add common/model.ts tests/model_test.ts
git commit -m "refactor(model): remove storage re-exports, update test imports"
```

---

### Task 7: Update release workflow to include `pages/`

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add `cp -R pages dist/package/` to the Prepare package step**

After line `cp -R common dist/package/`, add `cp -R pages dist/package/`.

The full "Prepare package" step becomes:

```yaml
      - name: Prepare package
        run: |
          rm -rf dist
          mkdir -p dist/package

          cp script.json dist/package/
          cp index.tsx dist/package/
          cp widget.tsx dist/package/
          cp intent.tsx dist/package/
          cp app_intents.tsx dist/package/
          cp README.md dist/package/
          cp SHORTCUTS.md dist/package/

          cp -R common dist/package/
          cp -R pages dist/package/
          cp -R utils dist/package/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): include pages/ in package"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full type check**

Run: `npx scripting-ts project "Tiny Kick Counter" --check`

Expected: PASS with zero errors.

- [ ] **Step 2: Verify no stale imports remain**

Search all `.tsx` and `.ts` files for imports from `"./common/model"` (or `"../common/model"`) that reference any of these storage-only symbols: `readState`, `saveState`, `createBackupFile`, `defaultState`, `exportState`, `parseBackupJson`, `migrateStateIfNeeded`, `getStateDirectory`, `getStateFilePath`, `readBackupFile`, `restoreFromBackup`, `restoreFromBackupFile`, `createBackup`.

Expected: None found in any file except `common/model.ts` itself (which imports them for internal use).

- [ ] **Step 3: Manual smoke test (on device)**

1. Open the app → "记录" tab shows hero card and empty state (or existing records).
2. Tap "记录胎动" → toast confirms new cycle or effective movement.
3. Rapid-tap "记录胎动" 3 times quickly → only one toast appears per async completion (no duplicate toasts).
4. Switch to "设置" tab → data overview shows correct totals.
5. Widget renders correctly on home screen.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Split `index.tsx` by page → Tasks 2, 3, 4
- ✅ Clean model/storage boundary → Task 6 (remove re-exports) + Task 4 (import from storage)
- ✅ Extract `loadStateWithLazyArchive` → Task 1 + Task 5
- ✅ Async-loading guard → Task 4 (`isRecording` state)
- ✅ Test import fix → Task 6

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:**
- `loadStateWithLazyArchive` signature matches between Task 1 definition and Task 4/5 usage.
- `SummaryPill` exported from `pages/records.tsx` (Task 2) and imported in `pages/settings.tsx` (Task 3).
- `createBackupFile` imported from `"./common/storage"` in Task 4's `index.tsx`.
- `readState`/`saveState`/`defaultState` imported from `"../common/storage"` in Task 6's test update.

**Ordering guarantee:** Every commit (Tasks 1→7) leaves the project in a passing type-check state. Re-exports are removed only after all consumers have migrated (Task 6).
