import {
  AppEvents,
  Button,
  Color,
  Divider,
  HStack,
  Image,
  Navigation,
  NavigationStack,
  Script,
  ScrollView,
  Spacer,
  Tab,
  TabView,
  Text,
  VStack,
  Widget,
  useEffect,
  useState,
} from "scripting"
import {
  archiveExpiredCycleIfNeeded,
  closeCycle,
  createBackupFile,
  readState,
  recordMovement,
  resetState,
  restoreBackupFromFile,
  saveState,
} from "./common/model"
import { buildDayCards, summarizeDayCards } from "./common/stats"
import { cardShadow, roundedBackground, smallCardRadius, themeColors } from "./common/theme"
import { Cycle, DayCard, FetalMovementState } from "./common/types"
import { formatDayKey, formatMinuteRemaining, formatTime } from "./utils"

function loadStateWithLazyArchive(nowTs = Date.now()): FetalMovementState {
  const { state } = readState()
  const archived = archiveExpiredCycleIfNeeded(state, nowTs)
  if (archived) saveState(state)
  return state
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

function SummaryPill({ title, value }: { title: string; value: string | number }) {
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
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>点击“记录胎动”开始第一个 1 小时计数周期。</Text>
  </VStack>
}

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
    <Text font="headline" fontWeight="medium">每日记录</Text>
    {cards.length === 0 ? <EmptyState /> : cards.map(card => <DayCardView card={card} nowTs={nowTs} />)}
  </VStack>
}

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

function SettingsPage({
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


function MainPage() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<FetalMovementState>(() => loadStateWithLazyArchive())
  const [nowTs, setNowTs] = useState(Date.now())
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"reset" | "restore" | null>(null)

  function requestWidgetReload() {
    Widget.reloadAll()
  }

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
    requestWidgetReload()
  }

  async function handleRecord() {
    const result = await recordMovement(Date.now(), "app")
    refresh(result.message)
    requestWidgetReload()
  }

  async function handleCloseCycle() {
    const result = await closeCycle(Date.now(), "app")
    refresh(result.message)
    requestWidgetReload()
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
      if (result.status === "restore") requestWidgetReload()
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
    requestWidgetReload()
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
