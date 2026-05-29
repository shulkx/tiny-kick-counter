import { Button, Divider, HStack, Script, Spacer, Text, VStack, Widget } from "scripting"
import { RecordMovementIntent } from "./app_intents"
import {
  getTodayCard,
  loadStateWithLazyArchive,
  roundedBackground,
  selectWidgetRows,
  themeColors,
  widgetCardRadius,
} from "./common/model"
import type { FetalMovementState } from "./common/model"
import { formatMinuteRemaining, formatTime } from "./utils"

type WidgetRow = ReturnType<typeof selectWidgetRows>["rows"][number]
type Card = ReturnType<typeof getTodayCard>

function Summary({ card }: { card: Card }) {
  const estimated = card?.estimated_count ?? 0

  return <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
    <HStack alignment="top">
      <VStack alignment="leading" spacing={3}>
        <Text font={15} fontWeight="bold" foregroundStyle={themeColors.label}>今日胎动</Text>
        <Text font={12} foregroundStyle={themeColors.secondaryLabel}>
          {card ? `已计${card.counted_hours}小时 · 有效${card.effective_total}次` : "还没有记录"}
        </Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={0}>
        <Text font={11} foregroundStyle={themeColors.secondaryLabel}>推算</Text>
        <Text font={24} fontWeight="bold" foregroundStyle={themeColors.label}>{estimated}</Text>
      </VStack>
    </HStack>
  </VStack>
}

function StatusCard({ row, nowTs }: { row?: WidgetRow; nowTs: number }) {
  if (!row) {
    return <VStack
      alignment="leading"
      spacing={4}
      padding={{ horizontal: 12, vertical: 8 }}
      background={roundedBackground(themeColors.widgetNeutralCardBackground, widgetCardRadius)}
      frame={{ maxWidth: "infinity" }}
    >
      <Text font={13} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>准备开始</Text>
      <Text font={12} foregroundStyle={themeColors.secondaryLabel}>点击下方按钮开始 1 小时计数</Text>
    </VStack>
  }

  const cycle = row.cycle
  const time = `${formatTime(cycle.started_ts)}–${formatTime(cycle.scheduled_end_ts)}`
  const title = row.isActive ? "进行中" : "最近一轮"
  const trailing = row.isActive ? `剩${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)}分` : "已完成"

  return <VStack
    alignment="leading"
    spacing={4}
    padding={{ horizontal: 12, vertical: 8 }}
    background={roundedBackground(row.isActive ? themeColors.widgetActiveCardBackground : themeColors.widgetNeutralCardBackground, widgetCardRadius)}
    frame={{ maxWidth: "infinity" }}
  >
    <HStack>
      <Text font={12} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{title}</Text>
      <Spacer />
      <Text font={12} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{trailing}</Text>
    </HStack>
    <Text font={12} foregroundStyle={themeColors.label}>{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
  </VStack>
}

function StatusCardSmall({ row, nowTs }: { row?: WidgetRow; nowTs: number }) {
  if (!row) {
    return <VStack
      alignment="center"
      spacing={4}
      padding={{ horizontal: 10, vertical: 8 }}
      background={roundedBackground(themeColors.widgetNeutralCardBackground, 12)}
      frame={{ maxWidth: "infinity" }}
    >
      <Text font={12} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>准备开始</Text>
      <Text font={11} foregroundStyle={themeColors.secondaryLabel} multilineTextAlignment="center">
        {"点击下方按钮\n开始 1 小时计数"}
      </Text>
    </VStack>
  }

  const cycle = row.cycle
  const time = `${formatTime(cycle.started_ts)}–${formatTime(cycle.scheduled_end_ts)}`
  const title = row.isActive ? "进行中" : "最近一轮"
  const trailing = row.isActive ? `剩${formatMinuteRemaining(nowTs, cycle.scheduled_end_ts)}分` : "已完成"

  return <VStack
    alignment="center"
    spacing={0}
    padding={{ horizontal: 10, vertical: 8 }}
    background={roundedBackground(row.isActive ? themeColors.widgetActiveCardBackground : themeColors.widgetNeutralCardBackground, 12)}
    frame={{ maxWidth: "infinity" }}
  >
    <HStack frame={{ maxWidth: "infinity" }}>
      <Text font={12} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{title}</Text>
      <Spacer />
      <Text font={12} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>{trailing}</Text>
    </HStack>
    <HStack alignment="lastTextBaseline" spacing={2} padding={{ top: 4 }}>
      <Text font={28} fontWeight="bold" foregroundStyle={themeColors.label}>{cycle.effective_count}</Text>
      <Text font={12} foregroundStyle={themeColors.secondaryLabel}>次有效</Text>
    </HStack>
    <Text font={11} foregroundStyle={themeColors.secondaryLabel} padding={{ top: 2 }}>
      {time} · 点击{cycle.total_count}次
    </Text>
  </VStack>
}

function ActionButton({ fontSize, height, width }: { fontSize: number; height: number; width?: number }) {
  const frameProps = width != null
    ? { width, height }
    : { maxWidth: "infinity" as const, height }
  return <HStack buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
    {width != null ? <Spacer /> : null}
    <Button intent={RecordMovementIntent({})}>
      <Text
        font={fontSize}
        fontWeight="semibold"
        foregroundStyle={themeColors.systemBlue}
        frame={frameProps}
        background={roundedBackground(themeColors.primaryButtonBackground, height / 2)}
      >记录胎动</Text>
    </Button>
    {width != null ? <Spacer /> : null}
  </HStack>
}

function CycleRow({ cycle, index }: { cycle: WidgetRow["cycle"]; index: number }) {
  const time = `${formatTime(cycle.started_ts)}–${formatTime(cycle.scheduled_end_ts)}`
  return <VStack
    alignment="leading"
    spacing={2}
    padding={{ horizontal: 12, vertical: 6 }}
    background={roundedBackground(themeColors.widgetNeutralCardBackground, 12)}
    frame={{ maxWidth: "infinity" }}
  >
    <HStack>
      <Text font={11} fontWeight="semibold" foregroundStyle={themeColors.widgetAccentText}>第 {index} 轮</Text>
      <Spacer />
      <Text font={11} foregroundStyle={themeColors.secondaryLabel}>已完成</Text>
    </HStack>
    <Text font={11} foregroundStyle={themeColors.label}>{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
  </VStack>
}

function SmallView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card)
  const primaryRow = rows[0]

  return <VStack
    alignment="leading"
    padding={14}
    foregroundStyle={themeColors.label}
  >
    <Text font={13} fontWeight="bold" foregroundStyle={themeColors.label}>胎动记录</Text>
    <Spacer />
    <StatusCardSmall row={primaryRow} nowTs={nowTs} />
    <Spacer />
    <ActionButton fontSize={14} height={30} />
  </VStack>
}

function MediumView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card)
  const primaryRow = rows[0]

  return <VStack
    alignment="leading"
    padding={{ horizontal: 16, vertical: 14 }}
    foregroundStyle={themeColors.label}
  >
    <Summary card={card} />
    <Spacer />
    <StatusCard row={primaryRow} nowTs={nowTs} />
    <Spacer />
    <ActionButton fontSize={15} height={32} width={130} />
  </VStack>
}

function LargeView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const card = getTodayCard(state, nowTs)
  const { rows } = selectWidgetRows(card, 6)
  const primaryRow = rows[0]
  const completedRows = rows.filter(r => !r.isActive && r !== primaryRow)

  return <VStack
    alignment="leading"
    padding={16}
    foregroundStyle={themeColors.label}
  >
    <Summary card={card} />
    <Spacer />
    <StatusCard row={primaryRow} nowTs={nowTs} />
    <Spacer />
    <ActionButton fontSize={15} height={34} width={150} />
    {completedRows.length > 0 ? <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
      <Divider />
      <Text font={11} fontWeight="semibold" foregroundStyle={themeColors.secondaryLabel}>今日周期记录</Text>
      {completedRows.map((row, i) =>
        <CycleRow key={row.cycle.cycle_id} cycle={row.cycle} index={completedRows.length - i} />
      )}
    </VStack> : null}
    <Spacer />
  </VStack>
}

function WidgetView({ state, nowTs }: { state: FetalMovementState; nowTs: number }) {
  const family = Widget.family
  if (family === "systemSmall") {
    return <SmallView state={state} nowTs={nowTs} />
  }
  if (family === "systemLarge" || family === "systemExtraLarge") {
    return <LargeView state={state} nowTs={nowTs} />
  }
  return <MediumView state={state} nowTs={nowTs} />
}

const nowTs = Date.now()
const state = loadStateWithLazyArchive(nowTs)

const nextReload = state.active_cycle
  ? new Date(Math.min(nowTs + 5 * 60 * 1000, state.active_cycle.scheduled_end_ts + 1000))
  : undefined

Widget.present(<WidgetView state={state} nowTs={nowTs} />, nextReload ? { policy: "after", date: nextReload } : undefined)
Script.exit()
