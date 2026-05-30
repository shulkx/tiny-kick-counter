import {
  Button,
  Color,
  HStack,
  Image,
  SecureField,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
  Widget,
  useState,
} from "scripting"
import { cardShadow, roundedBackground, smallCardRadius, themeColors } from "../common/theme"
import { DayCard } from "../common/types"
import { summarizeDayCards } from "../common/stats"
import { SummaryPill } from "./records"
import {
  getSeeyouToken,
  setSeeyouToken,
  clearSeeyouToken,
  readSeeyouCache,
  setSyncEnabled,
  clearSeeyouData,
  syncSeeyou,
} from "../common/model"

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
  onRefresh,
}: {
  cards: DayCard[]
  onExport: () => void
  onRestore: () => void
  onReset: () => void
  onRefresh?: () => void
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
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>管理数据与备份</Text>
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

    <SeeyouSyncSection onRefresh={onRefresh} />
  </VStack>
}

function formatSyncTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const prefix = d.toDateString() === now.toDateString() ? "今天" : `${d.getMonth() + 1}/${d.getDate()}`
  const h = d.getHours().toString().padStart(2, "0")
  const m = d.getMinutes().toString().padStart(2, "0")
  return `${prefix} ${h}:${m}`
}

function SeeyouSyncSection({ onRefresh }: { onRefresh?: () => void }) {
  const [cache, setCache] = useState(() => readSeeyouCache())
  const [tokenText, setTokenText] = useState(() => getSeeyouToken() ?? "")
  const [showToken, setShowToken] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  function handleToggle(enabled: boolean) {
    const next = setSyncEnabled(enabled)
    setCache(next)
    onRefresh?.()
    Widget.reloadAll()
  }

  function handleSaveToken() {
    setSeeyouToken(tokenText)
    void Dialog.alert({ message: "已保存 Token", buttonLabel: "好" })
  }

  async function handleSync() {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const result = await syncSeeyou()
      setCache(readSeeyouCache())
      if (result.kind === "ok") {
        void Dialog.alert({ message: `已同步 ${result.totalCount} 条记录`, title: "同步完成", buttonLabel: "好" })
      } else if (result.kind === "token_invalid") {
        void Dialog.alert({ message: "请重新获取 Token", title: "Token 失效", buttonLabel: "好" })
      } else if (result.kind === "network_error") {
        void Dialog.alert({ message: result.message, title: "网络错误", buttonLabel: "好" })
      } else if (result.kind === "parse_error") {
        void Dialog.alert({ message: result.message, title: "数据异常", buttonLabel: "好" })
      } else {
        void Dialog.alert({ message: "未配置 Token", title: "同步失败", buttonLabel: "好" })
      }
      onRefresh?.()
      Widget.reloadAll()
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleClear() {
    const count = cache.cycles.length
    const ok = await Dialog.confirm({
      title: "清空美柚数据？",
      message: `将清空 ${count} 条美柚记录，下次同步会重新下载完整历史，本机记录不受影响。`,
      cancelLabel: "取消",
      confirmLabel: "清空",
    })
    if (ok) {
      const next = clearSeeyouData()
      setCache(next)
      onRefresh?.()
      Widget.reloadAll()
    }
  }

  function handleHelp() {
    void Dialog.alert({
      message: "需要通过抓包工具获取美柚 App 请求中的 authorization 请求头。详见 README。",
      title: "如何获取美柚 Token",
      buttonLabel: "知道了",
    })
  }

  const statusText = cache.last_sync_status === "ok" && cache.last_sync_ts
    ? `${formatSyncTime(cache.last_sync_ts)} · 已同步 ${cache.cycles.length} 条`
    : cache.last_sync_status === "token_invalid" && cache.last_sync_ts
    ? `Token 失效 · ${formatSyncTime(cache.last_sync_ts)}`
    : cache.last_sync_status === "network_error" && cache.last_sync_ts
    ? `网络错误 · ${formatSyncTime(cache.last_sync_ts)}`
    : cache.last_sync_status === "parse_error" && cache.last_sync_ts
    ? `数据异常 · ${formatSyncTime(cache.last_sync_ts)}`
    : "尚未同步"
  const statusColor = cache.last_sync_status === "ok" ? themeColors.systemGreen
    : cache.last_sync_status ? themeColors.systemRed
    : themeColors.tertiaryLabel

  return <VStack
    alignment="leading"
    spacing={10}
    padding={16}
    background={roundedBackground(themeColors.groupedCardBackground)}
    foregroundStyle={themeColors.label}
    shadow={cardShadow()}
  >
    <HStack>
      <Text font="headline" fontWeight="medium">美柚同步</Text>
      <Spacer />
      <Button action={handleHelp} buttonStyle="plain">
        <Image systemName="questionmark.circle" font={16} foregroundStyle={themeColors.systemBlue} />
      </Button>
    </HStack>

    <Toggle value={cache.sync_enabled} onChanged={handleToggle} title="启用美柚同步" />

    {cache.sync_enabled ? <VStack alignment="leading" spacing={12}>
      <VStack alignment="leading" spacing={8}>
        <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>Token</Text>
        <HStack
          spacing={4}
          padding={{ horizontal: 12, vertical: 6 }}
          background={roundedBackground(themeColors.pillBackground, 10)}
        >
          {showToken
            ? <TextField title="Token" value={tokenText} onChanged={setTokenText} prompt="粘贴美柚 authorization 头" />
            : <SecureField title="Token" value={tokenText} onChanged={setTokenText} prompt="粘贴美柚 authorization 头" />
          }
          <Button action={() => setShowToken(!showToken)} buttonStyle="plain">
            <Image
              systemName={showToken ? "eye.slash" : "eye"}
              font={14}
              foregroundStyle={themeColors.secondaryLabel}
              frame={{ width: 28, height: 28 }}
            />
          </Button>
        </HStack>
        <Button action={handleSaveToken} buttonStyle="bordered" tint="systemBlue">
          <Text font="subheadline" fontWeight="medium">保存 Token</Text>
        </Button>
      </VStack>

      <HStack spacing={6} padding={{ vertical: 6, horizontal: 10 }} background={roundedBackground(cache.last_sync_status === "ok" ? themeColors.syncStatusOkBackground : cache.last_sync_status ? themeColors.syncStatusErrorBackground : themeColors.pillBackground, 8)}>
        <Image systemName="circle.fill" font={6} foregroundStyle={statusColor} />
        <Text font="caption" foregroundStyle={statusColor}>{statusText}</Text>
      </HStack>

      <SettingsActionRow
        title="立即同步"
        subtitle={isSyncing ? "同步中…" : "从美柚拉取全部胎动历史"}
        systemImage="arrow.triangle.2.circlepath"
        tint="systemBlue"
        action={() => { void handleSync() }}
      />
      <SettingsActionRow
        title="清空美柚数据"
        subtitle="清空缓存，下次同步重新下载"
        systemImage="trash.fill"
        tint={themeColors.systemRed}
        destructive
        action={() => { void handleClear() }}
      />
    </VStack> : null}
  </VStack>
}
