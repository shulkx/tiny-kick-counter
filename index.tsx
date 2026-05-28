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
  buildDayCards,
  closeCycle,
  createBackupFile,
  deleteCycle,
  loadStateWithLazyArchive,
  recordMovement,
  resetState,
  restoreBackupFromFile,
  themeColors,
} from "./common/model"
import type { FetalMovementState } from "./common/model"
import { formatDayKey } from "./utils"
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

  async function handleReset() {
    const result = await resetState()
    setConfirmAction(null)
    refresh(result.message)
    Widget.reloadAll()
  }

  const cards = buildDayCards(state)
  const allCards = buildDayCards(state, Infinity)
  const todayKey = formatDayKey(nowTs)
  const todayCards = cards.filter(card => card.day_key === todayKey)

  return <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={themeColors.pageBackground}>
    <TabView>
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
  </VStack>
}

async function run() {
  await Navigation.present(<MainPage />)
  Script.exit()
}

run()
