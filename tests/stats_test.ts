import { FetalMovementState, Cycle } from "../common/types"
import { buildDayCards, selectWidgetRows, summarizeDayCards } from "../common/stats"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function cycle(id: string, day: string, started: number, effective: number, total: number, close_reason?: "expired" | "manual", is_valid?: boolean): Cycle {
  return {
    cycle_id: id,
    day_key: day,
    started_at: day + " 00:00:00",
    started_ts: started,
    scheduled_end_at: day + " 01:00:00",
    scheduled_end_ts: started + 3600000,
    effective_count: effective,
    total_count: total,
    effective_movements: [],
    close_reason,
    is_valid,
  }
}

const state: FetalMovementState = {
  schema_version: 1,
  active_cycle: cycle("active", "2026-05-26", 3000, 1, 2),
  completed_cycles: [
    cycle("valid", "2026-05-26", 2000, 2, 3, "expired", true),
    cycle("manual", "2026-05-26", 1000, 9, 9, "manual", false),
    cycle("old", "2026-05-25", 500, 1, 1, "expired", true),
  ],
}

const cards = buildDayCards(state)
assert(cards.length === 2, "two visible day cards")
assert(cards[0].day_key === "2026-05-26", "today first")
assert(cards[0].counted_hours === 2, "manual invalid excluded")
assert(cards[0].effective_total === 3, "effective sum excludes manual")
assert(cards[0].estimated_count === 18, "estimated count is round(3/2*12)")

const selection = selectWidgetRows(cards[0])
assert(selection.rows.length === 2, "widget shows two rows")
assert(selection.rows[0].isActive === true, "active row first")
assert(selection.hiddenCount === 0, "no hidden visible rows")

const summary = summarizeDayCards(cards)
assert(summary.recordDays === 2, "summary counts visible record days")
assert(summary.cycleCount === 3, "summary counts visible cycles including active")
assert(summary.effectiveTotal === 4, "summary sums visible effective movements")

console.log("stats_test passed")
