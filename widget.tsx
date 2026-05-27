import { Button, HStack, Script, Spacer, Text, VStack, Widget, WidgetFamily } from "scripting"
import { roundedBackground, themeColors, widgetCardRadius } from "./common/theme"
import { CloseCycleIntent, RecordMovementIntent } from "./app_intents"
import { loadStateWithLazyArchive } from "./common/model"
import { getTodayCard, selectWidgetRows } from "./common/stats"
import { FetalMovementState } from "./common/types"
import { formatMinuteRemaining, formatTime } from "./utils"

function Summary({ card }: { card: ReturnType<typeof getTodayCard> }) {
  const estimated = card?.estimated_count ?? 0

  return <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
    <HStack alignment="top">
      <VStack alignment="leading" spacing={3}>
        <Text font="headline" foregroundStyle={themeColors.label}>今日胎动</Text>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>
          {card ? `已计${card.counted_hours}小时 · 有效${card.effective_total}次` : "还没有记录"}
        </Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={0}>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>推算</Text>
        <Text font="title" foregroundStyle={themeColors.label}>{estimated}</Text>
      </VStack>
    </HStack>
  </VStack>
}

function StatusCard({ row, nowTs }: { row?: ReturnType<typeof selectWidgetRows>["rows"][number]; nowTs: number }) {
  if (!row) {
    return <VStack
      alignment="leading"
      spacing={4}
      padding={{ horizontal: 10, vertical: 8 }}
      background={roundedBackground(themeColors.widgetNeutralCardBackground, widgetCardRadius)}
      frame={{ maxWidth: "infinity" }}
    >
      <Text font="caption" foregroundStyle={themeColors.widgetAccentText}>准备开始</Text>
      <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>点击下方按钮开始 1 小时计数</Text>
    </VStack>
  }

  const cycle = row.cycle
  const time = `${formatTime(cycle.started_ts)}-${formatTime(cycle.scheduled_end_ts)}`
  const title = row.isActive ? "进行中" : "最近一轮"
  const trailing = row.isActive ? `剩${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)}分` : "已完成"

  return <VStack
    alignment="leading"
    spacing={5}
    padding={{ horizontal: 10, vertical: 8 }}
    background={roundedBackground(row.isActive ? themeColors.widgetActiveCardBackground : themeColors.widgetNeutralCardBackground, widgetCardRadius)}
    frame={{ maxWidth: "infinity" }}
  >
    <HStack>
      <Text font="caption" foregroundStyle={themeColors.widgetAccentText}>{title}</Text>
      <Spacer />
      <Text font="caption" foregroundStyle={themeColors.widgetAccentText}>{trailing}</Text>
    </HStack>
    <Text font="caption" foregroundStyle={themeColors.label}>{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
  </VStack>
}

function ActionButtons({ hasActive, family }: { hasActive: boolean; family: WidgetFamily }) {
  const isLarge = family === "systemLarge" || family === "systemExtraLarge"
  const buttonHeight = isLarge ? 40 : 32
  const primaryWidth = isLarge ? 148 : 112
  const secondaryWidth = isLarge ? 78 : 64

  return <HStack spacing={isLarge ? 10 : 8} buttonStyle="plain">
    <Button intent={RecordMovementIntent({})}>
      <Text
        font={isLarge ? 18 : 16}
        foregroundStyle={themeColors.systemBlue}
        frame={{ width: primaryWidth, height: buttonHeight }}
        background={roundedBackground(themeColors.primaryButtonBackground, buttonHeight / 2)}
      >记录胎动</Text>
    </Button>
    {hasActive ? <Button role="destructive" intent={CloseCycleIntent({})}>
      <Text
        font={isLarge ? 18 : 16}
        foregroundStyle={themeColors.secondaryLabel}
        frame={{ width: secondaryWidth, height: buttonHeight }}
        background={roundedBackground(themeColors.secondaryButtonBackground, buttonHeight / 2)}
      >结束</Text>
    </Button> : null}
  </HStack>
}

function WidgetView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card)
  const hasActive = Boolean(state.active_cycle)
  const primaryRow = rows[0]
  const family = Widget.family
  const isLarge = family === "systemLarge" || family === "systemExtraLarge"
  const contentPadding = isLarge ? { horizontal: 18, vertical: 18 } : { horizontal: 18, vertical: 12 }
  const contentSpacing = isLarge ? 22 : 9

  return <VStack alignment="leading" spacing={contentSpacing} padding={contentPadding} foregroundStyle={themeColors.label}>
    <Summary card={card} />
    <StatusCard row={primaryRow} nowTs={nowTs} />
    {isLarge ? <Spacer /> : null}
    <ActionButtons hasActive={hasActive} family={family} />
  </VStack>
}

const nowTs = Date.now()
const state = loadStateWithLazyArchive(nowTs)

const nextReload = state.active_cycle
  ? new Date(Math.min(nowTs + 5 * 60 * 1000, state.active_cycle.scheduled_end_ts + 1000))
  : undefined

Widget.present(<WidgetView state={state} nowTs={nowTs} />, nextReload ? { policy: "after", date: nextReload } : undefined)
Script.exit()
