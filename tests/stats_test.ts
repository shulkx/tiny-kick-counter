import { FetalMovementState, Cycle } from "../common/types"
import { buildDayCards, buildTodayCard, getTodayCard, selectWidgetRows, summarizeDayCards } from "../common/stats"
import { formatDayKey } from "../utils/date"

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

// --- buildTodayCard tests ---

const TEST_TODAY_TS = new Date(2026, 4, 26, 8, 0, 0).getTime()
const TEST_TODAY_KEY = formatDayKey(TEST_TODAY_TS)
assert(TEST_TODAY_KEY === "2026-05-26", `TEST_TODAY_KEY should be 2026-05-26 but got ${TEST_TODAY_KEY}`)

const TEST_TODAY_TS_MINUS_1H = new Date(2026, 4, 26, 7, 0, 0).getTime()
const TEST_TODAY_TS_MINUS_2H = new Date(2026, 4, 26, 6, 0, 0).getTime()
const TEST_YESTERDAY_TS = new Date(2026, 4, 25, 8, 0, 0).getTime()

const perfState: FetalMovementState = {
  schema_version: 1,
  active_cycle: cycle("active", "2026-05-26", TEST_TODAY_TS, 1, 2),
  completed_cycles: [
    cycle("valid", "2026-05-26", TEST_TODAY_TS_MINUS_1H, 2, 3, "expired", true),
    cycle("manual", "2026-05-26", TEST_TODAY_TS_MINUS_2H, 9, 9, "manual", false),
    cycle("old", "2026-05-25", TEST_YESTERDAY_TS, 1, 1, "expired", true),
  ],
}

// Test 1: equivalence with buildDayCards for today
const todayCard = buildTodayCard(perfState, TEST_TODAY_TS)
const todayFromFull = buildDayCards(perfState, Infinity).find(c => c.day_key === "2026-05-26")
assert(todayCard !== null, "buildTodayCard returns today card")
assert(todayCard!.day_key === todayFromFull!.day_key, "day_key matches")
assert(todayCard!.effective_total === todayFromFull!.effective_total, "effective_total matches")
assert(todayCard!.counted_hours === todayFromFull!.counted_hours, "counted_hours matches")
assert(todayCard!.estimated_count === todayFromFull!.estimated_count, "estimated_count matches")
assert(todayCard!.cycles.length === todayFromFull!.cycles.length, "cycles count matches")

// Test 2: returns null when no cycles match
const noMatchCard = buildTodayCard(perfState, 99999999999999)
assert(noMatchCard === null, "buildTodayCard returns null for day with no cycles")

// Test 3: key fallback — cycle without day_key uses formatDayKey(started_ts)
const noDayKeyState: FetalMovementState = {
  schema_version: 1,
  active_cycle: null,
  completed_cycles: [
    { ...cycle("nodaykey", "", TEST_TODAY_TS, 3, 5, "expired", true), day_key: "" },
  ],
}
const fallbackCard = buildTodayCard(noDayKeyState, TEST_TODAY_TS)
assert(fallbackCard !== null, "buildTodayCard handles missing day_key via fallback")
assert(fallbackCard!.effective_total === 3, "fallback card has correct effective_total")

// Test 4: seeyou cycles included
const seeyouCycle = cycle("seeyou:123", "2026-05-26", TEST_TODAY_TS_MINUS_1H + 1800000, 4, 8, "expired", true)
seeyouCycle.source = "seeyou"
const withSeeyou = buildTodayCard(perfState, TEST_TODAY_TS, [seeyouCycle])
assert(withSeeyou !== null, "buildTodayCard includes seeyou cycles")
assert(withSeeyou!.effective_total === todayCard!.effective_total + 4, "seeyou effective added")

// Test 5: getTodayCard delegates to buildTodayCard
const getTodayResult = getTodayCard(perfState, TEST_TODAY_TS)
assert(getTodayResult !== null, "getTodayCard returns card")
assert(getTodayResult!.effective_total === todayCard!.effective_total, "getTodayCard delegates to buildTodayCard")

console.log("buildTodayCard tests passed")
