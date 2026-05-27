import {
  Button,
  Color,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { cardShadow, roundedBackground, smallCardRadius, themeColors } from "../common/theme"
import { DayCard } from "../common/types"
import { summarizeDayCards } from "../common/stats"
import { SummaryPill } from "./records"

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
}: {
  cards: DayCard[]
  onExport: () => void
  onRestore: () => void
  onReset: () => void
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
  </VStack>
}
