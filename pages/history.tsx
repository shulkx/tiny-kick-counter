import type { Color } from "scripting"
import {
  Button,
  HStack,
  Label,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { themeColors } from "../common/theme"
import { Cycle, DayCard } from "../common/types"
import { formatChineseDateFromDayKey, formatTime } from "../utils"

function estimatedCountColor(count: number) {
  if (count >= 30) return themeColors.systemGreen
  if (count >= 20) return "systemOrange" as Color
  return themeColors.systemRed
}

function DaySummaryRow({ card }: { card: DayCard }) {
  return <VStack alignment="leading" spacing={6} listRowSeparator="hidden">
    <HStack>
      <HStack spacing={6}>
        <Text font="headline" fontWeight="medium" foregroundStyle={themeColors.label}>
          {formatChineseDateFromDayKey(card.day_key)}
        </Text>
        {card.has_active_cycle
          ? <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text>
          : null}
      </HStack>
      <Spacer />
      <VStack alignment="trailing" spacing={1}>
        <Text font="title2" fontWeight="semibold" foregroundStyle={estimatedCountColor(card.estimated_count)}>
          {card.estimated_count}
        </Text>
        <Text font="caption2" foregroundStyle={themeColors.secondaryLabel}>推算次数</Text>
      </VStack>
    </HStack>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>
      {card.counted_hours}小时计数 · {card.effective_total}次有效胎动
    </Text>
  </VStack>
}

function HistoryCycleRow({
  cycle,
  onDelete,
}: {
  cycle: Cycle
  onDelete?: (cycleId: string) => void
}) {
  const isActive = !cycle.close_reason && cycle.source !== "seeyou"
  const isSeeyou = cycle.source === "seeyou"
  const swipe = onDelete && !isSeeyou ? {
    allowsFullSwipe: false,
    actions: [
      <Button
        tint={themeColors.systemRed}
        action={() => onDelete(cycle.cycle_id)}
      >
        <Label title="删除" systemImage="trash" />
      </Button>,
    ],
  } : undefined

  return <HStack trailingSwipeActions={swipe}>
    <HStack spacing={6}>
      <Text font="subheadline" foregroundStyle={themeColors.label}>
        {formatTime(cycle.started_ts)}-{formatTime(cycle.scheduled_end_ts)}
      </Text>
      {isActive ? <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text> : null}
      {isSeeyou ? <Text font={11} foregroundStyle={themeColors.tertiaryLabel}>美柚</Text> : null}
    </HStack>
    <Spacer />
    <HStack spacing={10}>
      <Text font="subheadline" foregroundStyle={themeColors.label}>有效 {cycle.effective_count}</Text>
      <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>点击 {cycle.total_count}</Text>
    </HStack>
  </HStack>
}

function HistoryEmpty() {
  return <VStack alignment="center" spacing={8} padding={28}>
    <Text font="title3" fontWeight="semibold" foregroundStyle={themeColors.label}>暂无历史记录</Text>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>
      完成一个计数周期后，记录会出现在这里。
    </Text>
  </VStack>
}

export function HistoryPage({
  cards,
  onDeleteCycle,
}: {
  cards: DayCard[]
  onDeleteCycle: (cycleId: string) => void
}) {
  if (cards.length === 0) {
    return <List listStyle="insetGroup">
      <HistoryEmpty />
    </List>
  }

  return <List listStyle="insetGroup">
    {cards.map(card =>
      <Section>
        <DaySummaryRow card={card} />
        {card.cycles.map(cycle =>
          <HistoryCycleRow
            cycle={cycle}
            onDelete={cycle.close_reason ? onDeleteCycle : undefined}
          />
        )}
      </Section>
    )}
  </List>
}
