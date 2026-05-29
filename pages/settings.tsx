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
    }
  }

  function handleHelp() {
    void Dialog.alert({
      message: "需要通过抓包工具获取美柚 App 请求中的 authorization 请求头。详见 README。",
      title: "如何获取美柚 Token",
      buttonLabel: "知道了",
    })
  }

  const statusIcon = cache.last_sync_status === "ok" ? "✅" : cache.last_sync_status ? "❌" : ""
  const statusLabel = cache.last_sync_status === "token_invalid" ? "Token 失效"
    : cache.last_sync_status === "network_error" ? "网络错误"
    : cache.last_sync_status === "parse_error" ? "数据异常"
    : ""
  const syncTimeStr = cache.last_sync_ts ? formatSyncTime(cache.last_sync_ts) : ""

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

    <VStack alignment="leading" spacing={8}>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>Token</Text>
      {showToken
        ? <TextField title="Token" value={tokenText} onChanged={setTokenText} prompt="粘贴美柚 authorization 头" />
        : <SecureField title="Token" value={tokenText} onChanged={setTokenText} prompt="粘贴美柚 authorization 头" />
      }
      <HStack spacing={10}>
        <Button action={() => setShowToken(!showToken)} buttonStyle="plain">
          <Text font="caption" foregroundStyle={themeColors.systemBlue}>{showToken ? "隐藏" : "显示"}</Text>
        </Button>
        <Button action={handleSaveToken} buttonStyle="plain">
          <Text font="caption" foregroundStyle={themeColors.systemBlue}>保存</Text>
        </Button>
      </HStack>
    </VStack>

    {cache.sync_enabled ? <VStack alignment="leading" spacing={8}>
      {cache.last_sync_ts ? <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>
        上次同步：{syncTimeStr} {statusIcon}{statusLabel ? ` ${statusLabel}` : ""}
      </Text> : null}
      <Button action={() => { void handleSync() }} buttonStyle="plain">
        <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.systemBlue}>
          {isSyncing ? "同步中…" : "立即同步"}
        </Text>
      </Button>
      <Button action={() => { void handleClear() }} buttonStyle="plain">
        <Text font="subheadline" foregroundStyle={themeColors.systemRed}>清空美柚数据</Text>
      </Button>
    </VStack> : null}
  </VStack>
}
