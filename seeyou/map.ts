import { Cycle, SEEYOU_CYCLE_ID_PREFIX, SEEYOU_SOURCE } from "../common/types"
import { formatDayKey } from "../utils/date"
import { SeeyouRecord } from "./types"

const ONE_HOUR_MS = 60 * 60 * 1000

function isoOfTs(ts: number): string {
  return new Date(ts).toISOString()
}

export function mapSeeyouRecordToCycle(record: SeeyouRecord): Cycle {
  const startedTs = record.start_time * 1000
  const scheduledEndTs = startedTs + ONE_HOUR_MS
  return {
    cycle_id: SEEYOU_CYCLE_ID_PREFIX + record.id,
    day_key: formatDayKey(startedTs),
    started_at: isoOfTs(startedTs),
    started_ts: startedTs,
    scheduled_end_at: isoOfTs(scheduledEndTs),
    scheduled_end_ts: scheduledEndTs,
    effective_count: typeof record.fetal_times === "number" ? record.fetal_times : 0,
    total_count: typeof record.click_times === "number" ? record.click_times : 0,
    effective_movements: [],
    source: SEEYOU_SOURCE,
  }
}
