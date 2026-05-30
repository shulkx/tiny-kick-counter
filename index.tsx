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
import { HistoryPage } from "./pages/history"
import { RecordsPage } from "./pages/records"
import { SettingsPage } from "./pages/settings"

function MainPage() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<FetalMovementState>(() => loadStateWithLazyArchive())
  const [nowTs, setNowTs] = useState(Date.now())
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"reset" | "restore" | "close_cycle" | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [seeyouCache, setSeeyouCache] = useState(() => readSeeyouCache())
  const [dataVersionRef] = useState(() => ({ current: 0 }))
  const [dataVersion, setDataVersion] = useState(0)
  const [historyCards, setHistoryCards] = useState<DayCard[]>([])
  const [historyVersion, setHistoryVersion] = useState(-1)
  const [settingsCards, setSettingsCards] = useState<DayCard[]>([])
  const [settingsVersion, setSettingsVersion] = useState(-1)

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

  useEffect(() => {
    const handleScenePhase = (phase: "active" | "inactive" | "background") => {
      if (phase === "active") {
        invalidateSeeyouData()
        rebuildDerivedCards()
        void autoSyncIfDue().then(result => {
          if (result?.kind === "ok") {
            invalidateSeeyouData()
            rebuildDerivedCards()
            Widget.reloadAll()
          }
        })
      }
    }
    AppEvents.scenePhase.addListener(handleScenePhase)
    return () => AppEvents.scenePhase.removeListener(handleScenePhase)
  }, [])

  function handleManualRefresh() {
    invalidateSeeyouData("已刷新页面并请求更新小组件。")
    rebuildDerivedCards()
    Widget.reloadAll()
  }

  function rebuildDerivedCards() {
    const freshState = loadStateWithLazyArchive()
    const freshCache = readSeeyouCache()
    setSeeyouCache(freshCache)
    const cycles = freshCache.sync_enabled ? freshCache.cycles : []
    setHistoryCards(buildDayCards(freshState, Infinity, cycles))
    setHistoryVersion(dataVersionRef.current)
    setSettingsCards(buildDayCards(freshState, RECENT_DAY_LIMIT, cycles))
    setSettingsVersion(dataVersionRef.current)
  }

  function handleSeeyouDataChanged(message?: string) {
    invalidateSeeyouData(message)
    const freshState = loadStateWithLazyArchive()
    const freshCache = readSeeyouCache()
    const cycles = freshCache.sync_enabled ? freshCache.cycles : []
    setSettingsCards(buildDayCards(freshState, RECENT_DAY_LIMIT, cycles))
    setSettingsVersion(dataVersionRef.current)
  }

  async function handleRecord() {
    if (isRecording) return
    setIsRecording(true)
    try {
      const result = await recordMovement(Date.now(), "app")
      invalidateData(result.message)
      Widget.reloadAll()
    } finally {
      setIsRecording(false)
    }
  }

  async function handleConfirmedCloseCycle() {
    setConfirmAction(null)
    if (isRecording) return
    setIsRecording(true)
    try {
      const result = await closeCycle(Date.now(), "app")
      invalidateData(result.message)
      Widget.reloadAll()
    } finally {
      setIsRecording(false)
    }
  }

  async function handleExport() {
    try {
      const backup = await createBackupFile("manual")
      console.log(backup.json)
      invalidateData(`已导出备份：${backup.file_name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      invalidateData(`导出失败：${message}`)
    }
  }

  async function handleRestore() {
    setConfirmAction(null)
    try {
      const files = await DocumentPicker.pickFiles()
      const filePath = files[0]
      if (!filePath) {
        invalidateData("已取消恢复。")
        return
      }
      const result = await restoreBackupFromFile(filePath, Date.now(), "app")
      invalidateData(result.message)
      if (result.status === "restore") {
        rebuildDerivedCards()
        Widget.reloadAll()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      invalidateData(`恢复失败：${message}`)
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
    }
  }

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
      const freshState = loadStateWithLazyArchive()
      const cycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
      setHistoryCards(buildDayCards(freshState, Infinity, cycles))
      setHistoryVersion(dataVersionRef.current)
      Widget.reloadAll()
    }
  }

  async function handleReset() {
    const result = await resetState()
    setConfirmAction(null)
    invalidateData(result.message)
    rebuildDerivedCards()
    Widget.reloadAll()
  }

  const seeyouCycles = seeyouCache.sync_enabled ? seeyouCache.cycles : []
  const todayCard = buildTodayCard(state, nowTs, seeyouCycles)
  const todayCards = todayCard ? [todayCard] : []

  return <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={themeColors.pageBackground}>
    <TabView>
    <Tab title="记录" systemImage="heart.text.square">
      <NavigationStack>
        <ScrollView
          onAppear={() => {
            const { archived } = refreshView()
            if (archived) bumpVersion()
            void autoSyncIfDue().then(result => {
              if (result?.kind === "ok") { invalidateSeeyouData(); Widget.reloadAll() }
            })
          }}
          navigationTitle="胎动记录"
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            cancellationAction: <Button title="关闭" action={dismiss} />,
            topBarTrailing: [
              <Button title="说明" systemImage="info.circle" action={() => {
                void Dialog.alert({
                  message: "• 1 小时为一个计数周期\n• 首次记录自动开始周期\n• 5 分钟内连续点击计为子胎动\n• ≥ 5 分钟视为新的有效胎动\n• 手动提前结束的周期不参与统计",
                  title: "计数规则",
                  buttonLabel: "知道了",
                })
              }} />,
              <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
            ],
          }}
          confirmationDialog={{
            title: "停止本次记录？",
            isPresented: confirmAction === "close_cycle",
            onChanged: isPresented => { if (!isPresented) setConfirmAction(null) },
            message: <Text>系统将不会保存这次的数据</Text>,
            actions: <VStack>
              <Button title="确认停止" role="destructive" action={() => { void handleConfirmedCloseCycle() }} />
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
          <VStack alignment="leading" spacing={14} padding={12}>
            <RecordsPage
              state={state}
              cards={todayCards}
              nowTs={nowTs}
              onRecord={() => { void handleRecord() }}
              onCloseCycle={() => setConfirmAction("close_cycle")}
            />
          </VStack>
        </ScrollView>
      </NavigationStack>
    </Tab>

    <Tab title="历史" systemImage="clock.arrow.circlepath">
      <NavigationStack>
        <VStack
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
          navigationTitle="历史记录"
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            cancellationAction: <Button title="关闭" action={dismiss} />,
            topBarTrailing: [
              <Button title="说明" systemImage="info.circle" action={() => {
                void Dialog.alert({
                  title: "统计结果说明",
                  message: "推算次数 = 有效胎动数 × 12 ÷ 计时小时\n\n正常（绿色）：推算次数 ≥ 30\n注意（橙色）：推算次数 ≥ 20\n紧急（红色）：推算次数 < 20\n\n本计数结果不包含任何医疗建议，如有任何疑问，请及时和您的医生联系。",
                  buttonLabel: "知道了",
                })
              }} />,
              <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
            ],
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
            cards={historyCards}
            onDeleteCycle={(cycleId) => { void handleDeleteCycle(cycleId) }}
          />
        </VStack>
      </NavigationStack>
    </Tab>

    <Tab title="设置" systemImage="gearshape">
      <NavigationStack>
        <ScrollView
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
          navigationTitle="设置"
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            cancellationAction: <Button title="关闭" action={dismiss} />,
            primaryAction: <Button title="刷新" systemImage="arrow.clockwise" action={handleManualRefresh} />,
          }}
          confirmationDialog={{
            title: confirmAction === "restore" ? "从备份恢复？" : "重置胎动数据？",
            isPresented: confirmAction === "restore" || confirmAction === "reset",
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
          <VStack alignment="leading" spacing={14} padding={12}>
            <SettingsPage
              cards={settingsCards}
              onExport={() => { void handleExport() }}
              onRestore={() => setConfirmAction("restore")}
              onReset={() => setConfirmAction("reset")}
              onSeeyouDataChanged={handleSeeyouDataChanged}
            />
          </VStack>
        </ScrollView>
      </NavigationStack>
    </Tab>
    </TabView>
  </VStack>
}

async function run() {
  await Navigation.present(<MainPage />)
  Script.exit()
}

run()
