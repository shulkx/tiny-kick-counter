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
import { roundedBackground, smallCardRadius, themeColors } from "../common/theme"
import { Cycle, DayCard } from "../common/types"
import { formatChineseDateFromDayKey, formatTime } from "../utils"

function HistoryCycleRow({
  cycle,
  onDelete,
}: {
  cycle: Cycle
  onDelete?: (cycleId: string) => void
}) {
  const isActive = !cycle.close_reason
  const swipe = onDelete ? {
    allowsFullSwipe: false,
    actions: [
      <Button
        role="destructive"
        action={() => onDelete(cycle.cycle_id)}
      >
        <Label title="删除" systemImage="trash" />
      </Button>,
    ],
  } : undefined

  return <HStack
    spacing={12}
    padding={13}
    background={roundedBackground(isActive ? themeColors.activeCycleBackground : themeColors.pillBackground, smallCardRadius)}
    listRowInsets={0}
    listRowSeparator="hidden"
    listRowBackground={<VStack />}
    trailingSwipeActions={swipe}
  >
    <VStack alignment="leading" spacing={4}>
      <HStack spacing={6}>
        <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>
          {formatTime(cycle.started_ts)}-{formatTime(cycle.scheduled_end_ts)}
        </Text>
        {isActive ? <Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text> : null}
      </HStack>
      <HStack spacing={10}>
        <Text font="caption" foregroundStyle={themeColors.label}>有效 {cycle.effective_count}</Text>
        <Text font="caption" foregroundStyle={themeColors.secondaryLabel}>点击 {cycle.total_count}</Text>
      </HStack>
    </VStack>
    <Spacer />
  </HStack>
}

function HistoryEmpty() {
  return <VStack
    alignment="center"
    spacing={8}
    padding={28}
    background={roundedBackground(themeColors.emptyStateBackground)}
    foregroundStyle={themeColors.label}
  >
    <Text font="title3" fontWeight="semibold">暂无历史记录</Text>
    <Text font="subheadline" foregroundStyle={themeColors.secondaryLabel}>完成一个计数周期后，记录会出现在这里。</Text>
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
    return <VStack alignment="leading" spacing={14} padding={12}>
      <HistoryEmpty />
    </VStack>
  }

  const allCycles = cards.flatMap(card => card.cycles)
  const listHeight = Math.max(200, allCycles.length * 70 + cards.length * 40 + 20)

  return <VStack alignment="leading" spacing={0} padding={{ horizontal: 12 }}>
    <List
      listStyle="plain"
      listRowSpacing={8}
      frame={{ height: listHeight }}
    >
      {cards.map(card =>
        <Section header={
          <Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.secondaryLabel}>
            {formatChineseDateFromDayKey(card.day_key)}
          </Text>
        }>
          {card.cycles.map(cycle =>
            <HistoryCycleRow
              cycle={cycle}
              onDelete={cycle.close_reason ? onDeleteCycle : undefined}
            />
          )}
        </Section>
      )}
    </List>
  </VStack>
}
