import { Cycle, SEEYOU_CYCLE_ID_PREFIX, SEEYOU_SOURCE } from "../common/types"
import { SeeyouApiResponse } from "../common/seeyou_types"
import { reconcileByDay } from "../common/seeyou_reconcile"
import { mapSeeyouRecordToCycle } from "../common/seeyou_map"
import { formatDayKey } from "../utils/date"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const baseTs = 1779800000 * 1000
const dayKey = formatDayKey(baseTs)
const otherDayTs = baseTs - 7 * 24 * 60 * 60 * 1000
const otherDayKey = formatDayKey(otherDayTs)

function existingCycle(id: number, ts: number): Cycle {
  return mapSeeyouRecordToCycle({ id, start_time: ts / 1000, date: 20260520, fetal_times: 3, click_times: 4 })
}

const existing: Cycle[] = [
  existingCycle(1, baseTs),
  existingCycle(2, baseTs + 60_000),
  existingCycle(99, otherDayTs),
]

const response: SeeyouApiResponse = [
  {
    date: 20260520,
    list: [
      { id: 2, start_time: (baseTs + 60_000) / 1000, date: 20260520, fetal_times: 5, click_times: 6 },
      { id: 3, start_time: (baseTs + 120_000) / 1000, date: 20260520, fetal_times: 8, click_times: 10 },
    ],
  },
]

const reconciled = reconcileByDay(existing, response)

const sameDay = reconciled.filter(c => c.day_key === dayKey)
assert(sameDay.length === 2, "covered day replaced to 2 entries")
assert(sameDay.some(c => c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "2"), "id=2 kept")
assert(sameDay.some(c => c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "3"), "id=3 added")
assert(!sameDay.some(c => c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "1"), "id=1 removed")

assert(reconciled.some(c => c.day_key === otherDayKey && c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "99"), "uncovered day preserved")

const responseWithEmpty: SeeyouApiResponse = [{ date: 20260520, list: [] }]
const reconciled2 = reconcileByDay(existing, responseWithEmpty)
const sameDay2 = reconciled2.filter(c => c.day_key === dayKey)
assert(sameDay2.length === 2, "empty list skips reconcile (kept original 2)")

const mixed: Cycle[] = [
  ...existing,
  { cycle_id: "local-1", day_key: dayKey, started_at: "", started_ts: baseTs, scheduled_end_at: "", scheduled_end_ts: baseTs + 3600000, effective_count: 1, total_count: 1, effective_movements: [] },
]
const reconciledMixed = reconcileByDay(mixed, response)
assert(reconciledMixed.some(c => c.cycle_id === "local-1"), "non-seeyou cycle preserved")

console.log("seeyou_reconcile_test passed")
