import { Cycle, DayCard, ESTIMATE_HOURS, FetalMovementState, RECENT_DAY_LIMIT, WidgetCycleRow } from "./types"
import { formatDayKey } from "../utils/date"

export function getVisibleCycles(state: FetalMovementState): Cycle[] {
  const cycles = state.completed_cycles.filter(cycle => cycle.is_valid !== false)
  if (state.active_cycle) cycles.push(state.active_cycle)
  return cycles
}

export function buildDayCards(state: FetalMovementState, limit = RECENT_DAY_LIMIT): DayCard[] {
  const grouped = new Map<string, Cycle[]>()
  for (const cycle of getVisibleCycles(state)) {
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
      has_active_cycle: sorted.some(cycle => !cycle.close_reason),
    }
  })

  return cards.sort((a, b) => b.day_key.localeCompare(a.day_key)).slice(0, limit)
}

export function getTodayCard(state: FetalMovementState, nowTs = Date.now()): DayCard | null {
  const today = formatDayKey(nowTs)
  const found = buildDayCards(state, RECENT_DAY_LIMIT).find(card => card.day_key === today)
  return found ? found : null
}

export function selectWidgetRows(card: DayCard | null): { rows: WidgetCycleRow[]; hiddenCount: number } {
  if (!card) return { rows: [], hiddenCount: 0 }
  const active = card.cycles.find(cycle => !cycle.close_reason)
  const completed = card.cycles.filter(cycle => cycle.close_reason === "expired")
  const rows: WidgetCycleRow[] = []
  if (active) rows.push({ cycle: active, label: "当前", isActive: true })
  for (const cycle of completed) {
    if (rows.length >= 2) break
    rows.push({ cycle, label: "上轮", isActive: false })
  }
  const hiddenCount = Math.max(0, card.cycles.length - rows.length)
  return { rows, hiddenCount }
}
