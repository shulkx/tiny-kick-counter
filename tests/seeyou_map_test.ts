import { SeeyouRecord } from "../common/seeyou_types"
import { mapSeeyouRecordToCycle } from "../common/seeyou_map"
import { formatDayKey } from "../utils/date"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const record: SeeyouRecord = {
  id: 399503186,
  start_time: 1780029885,
  date: 20260529,
  fetal_times: 7,
  click_times: 14,
}

const cycle = mapSeeyouRecordToCycle(record)

assert(cycle.cycle_id === "seeyou:399503186", "cycle_id has seeyou prefix")
assert(cycle.source === "seeyou", "source is seeyou")
assert(cycle.started_ts === 1780029885 * 1000, "started_ts is start_time * 1000")
assert(cycle.scheduled_end_ts === cycle.started_ts + 3_600_000, "end is +1 hour")
assert(cycle.effective_count === 7, "effective_count from fetal_times")
assert(cycle.total_count === 14, "total_count from click_times")
assert(cycle.effective_movements.length === 0, "no sub movements")
assert(cycle.is_valid === undefined, "is_valid not set")
assert(cycle.close_reason === undefined, "close_reason not set")
assert(cycle.ended_ts === undefined, "ended_ts not set")
assert(cycle.day_key === formatDayKey(cycle.started_ts), "day_key from started_ts local tz")

const missingCounts: SeeyouRecord = { id: 1, start_time: 1780029885, date: 20260529 }
const cycle2 = mapSeeyouRecordToCycle(missingCounts)
assert(cycle2.effective_count === 0, "missing fetal_times defaults to 0")
assert(cycle2.total_count === 0, "missing click_times defaults to 0")

console.log("seeyou_map_test passed")
