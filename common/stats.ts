import { Cycle, DayCard, ESTIMATE_HOURS, FetalMovementState, RECENT_DAY_LIMIT, SEEYOU_SOURCE, WidgetCycleRow } from "./types"
import { formatDayKey } from "../utils/date"

export function isLocalActive(cycle: Cycle): boolean {
  return cycle.source !== SEEYOU_SOURCE && !cycle.close_reason
}

export function getVisibleCycles(state: FetalMovementState): Cycle[] {
  const cycles = state.completed_cycles.filter(cycle => cycle.is_valid !== false)
  if (state.active_cycle) cycles.push(state.active_cycle)
  return cycles
}

export function buildDayCards(state: FetalMovementState, limit = RECENT_DAY_LIMIT, seeyouCycles: Cycle[] = []): DayCard[] {
  const grouped = new Map<string, Cycle[]>()
  const allCycles = [...getVisibleCycles(state), ...seeyouCycles]
  for (const cycle of allCycles) {
    const key = cycle.day_key || formatDayKey(cycle.started_ts)
    const existing = grouped.get(key)
    const list = existing ? existing : []
    list.push(cycle)
    grouped.set(key, list)
  }

  const cards = Array.from(grouped.entries()).map(([day_key, cycles]) => {
    const sorted = cycles.slice().sort((a, b) => b.started_ts - a.started_ts)
    const counted_hours = sorted.length
    const effective_total = sorted.reduce((sum, cycle) => sum + cycle.effective_count, 0)
    const total_clicks = sorted.reduce((sum, cycle) => sum + cycle.total_count, 0)
    const estimated_count = counted_hours > 0 ? Math.round((effective_total / counted_hours) * ESTIMATE_HOURS) : 0
    return {
      day_key,
      cycles: sorted,
      counted_hours,
      effective_total,
      total_clicks,
      estimated_count,
      has_active_cycle: sorted.some(isLocalActive),
    }
  })

  return cards.sort((a, b) => b.day_key.localeCompare(a.day_key)).slice(0, limit)
}

export function summarizeDayCards(cards: DayCard[]): { recordDays: number; cycleCount: number; effectiveTotal: number } {
  return {
    recordDays: cards.length,
    cycleCount: cards.reduce((sum, card) => sum + card.cycles.length, 0),
    effectiveTotal: cards.reduce((sum, card) => sum + card.effective_total, 0),
  }
}

export function getTodayCard(state: FetalMovementState, nowTs = Date.now(), seeyouCycles: Cycle[] = []): DayCard | null {
  const today = formatDayKey(nowTs)
  const found = buildDayCards(state, RECENT_DAY_LIMIT, seeyouCycles).find(card => card.day_key === today)
  return found ? found : null
}

export function selectWidgetRows(card: DayCard | null, maxRows = 2): { rows: WidgetCycleRow[]; hiddenCount: number } {
  if (!card) return { rows: [], hiddenCount: 0 }
  const active = card.cycles.find(isLocalActive)
  const completed = card.cycles.filter(cycle => cycle.close_reason === "expired" || cycle.source === SEEYOU_SOURCE)
  const rows: WidgetCycleRow[] = []
  if (active) rows.push({ cycle: active, label: "当前", isActive: true })
  for (const cycle of completed) {
    if (rows.length >= maxRows) break
    rows.push({ cycle, label: "上轮", isActive: false })
  }
  const hiddenCount = Math.max(0, card.cycles.length - rows.length)
  return { rows, hiddenCount }
}
