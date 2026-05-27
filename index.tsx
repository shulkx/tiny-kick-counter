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
  createBackupFile,
  loadStateWithLazyArchive,
  recordMovement,
  resetState,
  restoreBackupFromFile,
} from "./common/model"
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
