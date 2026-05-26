import {
  AppEvents,
  Button,
  Divider,
  HStack,
  Navigation,
  NavigationStack,
  Script,
  ScrollView,
  Spacer,
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
  saveState,
} from "./common/model"
import { buildDayCards } from "./common/stats"
import { Cycle, DayCard, FetalMovementState } from "./common/types"
import { formatMinuteRemaining, formatTime } from "./utils"

function loadStateWithLazyArchive(nowTs = Date.now()): FetalMovementState {
  const { state } = readState()
  const archived = archiveExpiredCycleIfNeeded(state, nowTs)
  if (archived) saveState(state)
  return state
}

function Header({
  state,
  onRecord,
  onCloseCycle,
}: {
  state: FetalMovementState
  onRecord: () => void
  onCloseCycle: () => void
}) {
  return <VStack alignment="leading" spacing={12} padding={16}>
    <VStack alignment="leading" spacing={4}>
      <Text font="largeTitle">胎动计数</Text>
      <Text foregroundStyle="gray">记录 1 小时周期，5 分钟内连续点击计为子胎动</Text>
    </VStack>
    <HStack spacing={10}>
      <Button title="记录胎动" systemImage="plus.circle.fill" action={onRecord} />
      {state.active_cycle ? <Button title="结束当前周期" systemImage="xmark.circle" role="destructive" action={onCloseCycle} /> : null}
    </HStack>
  </VStack>
}

function SummaryPill({ title, value }: { title: string; value: string | number }) {
  return <VStack alignment="leading" spacing={2} padding={10} background="rgba(142,142,147,0.12)">
    <Text font="caption" foregroundStyle="gray">{title}</Text>
    <Text font="headline">{value}</Text>
  </VStack>
}

function CycleRow({ cycle, nowTs }: { cycle: Cycle; nowTs: number }) {
  const isActive = !cycle.close_reason
  const timeRange = `${formatTime(cycle.started_ts)}-${formatTime(cycle.scheduled_end_ts)}`
  const status = isActive
    ? `进行中 · 剩约 ${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)} 分钟`
    : "已完成"

  return <VStack alignment="leading" spacing={6} padding={12} background={isActive ? "rgba(52,199,89,0.14)" : "rgba(142,142,147,0.10)"}>
    <HStack>
      <Text font="headline">{isActive ? "当前周期" : "计数周期"}</Text>
      <Spacer />
      <Text foregroundStyle={isActive ? "green" : "gray"}>{status}</Text>
    </HStack>
    <Text foregroundStyle="gray">{timeRange}</Text>
    <HStack spacing={12}>
      <Text>有效 {cycle.effective_count} 次</Text>
      <Text foregroundStyle="gray">点击 {cycle.total_count} 次</Text>
    </HStack>
  </VStack>
}

function DayCardView({ card, nowTs }: { card: DayCard; nowTs: number }) {
  return <VStack alignment="leading" spacing={12} padding={16} background="rgba(255,255,255,0.08)">
    <HStack>
      <VStack alignment="leading" spacing={4}>
        <Text font="title3">{card.day_key}</Text>
        <Text foregroundStyle="gray">{card.has_active_cycle ? "含正在进行周期" : "已完成计数"}</Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={2}>
        <Text font="title2">推算 {card.estimated_count}</Text>
        <Text font="caption" foregroundStyle="gray">12 小时</Text>
      </VStack>
    </HStack>
    <HStack spacing={8}>
      <SummaryPill title="计数小时" value={card.counted_hours} />
      <SummaryPill title="有效胎动" value={card.effective_total} />
      <SummaryPill title="总点击" value={card.total_clicks} />
    </HStack>
    <Divider />
    <VStack alignment="leading" spacing={8}>
      {card.cycles.map(cycle => <CycleRow cycle={cycle} nowTs={nowTs} />)}
    </VStack>
  </VStack>
}

function EmptyState() {
  return <VStack alignment="center" spacing={8} padding={28}>
    <Text font="title3">还没有胎动记录</Text>
    <Text foregroundStyle="gray">点击“记录胎动”开始第一个 1 小时计数周期。</Text>
  </VStack>
}

function MainPage() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<FetalMovementState>(() => loadStateWithLazyArchive())
  const [nowTs, setNowTs] = useState(Date.now())
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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

  async function handleReset() {
    const result = await resetState()
    setShowResetConfirm(false)
    refresh(result.message)
    requestWidgetReload()
  }

  const cards = buildDayCards(state)

  return <NavigationStack>
    <ScrollView
      onAppear={() => refresh()}
      navigationTitle="胎动记录"
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        cancellationAction: <Button title="关闭" action={dismiss} />,
        primaryAction: [
          <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
          <Button title="导出" action={() => { void handleExport() }} />,
        ],
        destructiveAction: <Button title="重置" role="destructive" action={() => setShowResetConfirm(true)} />,
      }}
      confirmationDialog={{
        title: "重置胎动数据？",
        isPresented: showResetConfirm,
        onChanged: setShowResetConfirm,
        message: <Text>此操作会清空当前周期和全部历史记录，不能撤销。</Text>,
        actions: <VStack>
          <Button title="确认重置" role="destructive" action={() => { void handleReset() }} />
          <Button title="取消" role="cancel" action={() => setShowResetConfirm(false)} />
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
      <VStack alignment="leading" spacing={14} padding={12}>
        <Header
          state={state}
          onRecord={() => { void handleRecord() }}
          onCloseCycle={() => { void handleCloseCycle() }}
        />
        {cards.length === 0 ? <EmptyState /> : cards.map(card => <DayCardView card={card} nowTs={nowTs} />)}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  await Navigation.present(<MainPage />)
  Script.exit()
}

run()
