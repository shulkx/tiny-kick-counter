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
import { formatChineseDateFromDayKey, formatMinuteRemaining, formatTime } from "../utils"

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
      <Button title="记录胎动" systemImage="plus.circle.fill" buttonStyle="bordered" tint="systemBlue" action={onRecord} />
      {activeCycle ? <Button title="结束当前周期" systemImage="xmark.circle" role="destructive" buttonStyle="bordered" action={onCloseCycle} /> : null}
    </HStack>
  </VStack>
}

function CycleRow({ cycle, nowTs }: { cycle: Cycle; nowTs: number }) {
  const isActive = !cycle.close_reason && cycle.source !== "seeyou"
  const isSeeyou = cycle.source === "seeyou"
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
      </HStack> : <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>{status}{isSeeyou ? " ·美柚" : ""}</Text>}
    </HStack>
    <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>{timeRange}</Text>
    <HStack spacing={12}>
      <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>有效 {cycle.effective_count} 次</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>点击 {cycle.total_count} 次</Text>
    </HStack>
  </VStack>
}

function DayCardView({ card, nowTs }: { card: DayCard; nowTs: number }) {
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
        <Text font="headline" fontWeight="medium">{formatChineseDateFromDayKey(card.day_key)}</Text>
        <Text font="caption" foregroundStyle={card.has_active_cycle ? themeColors.activeSubtitle : themeColors.secondaryLabel}>
          {card.has_active_cycle ? "● 含正在进行周期" : "已完成计数"}
        </Text>
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
      {card.cycles.map(cycle => <CycleRow cycle={cycle} nowTs={nowTs} />)}
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
    <Text font="headline" fontWeight="medium">今日记录</Text>
    {cards.length === 0 ? <EmptyState /> : cards.map(card => <DayCardView card={card} nowTs={nowTs} />)}
  </VStack>
}
