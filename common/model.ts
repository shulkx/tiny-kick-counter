import {
  CYCLE_DURATION_MS,
  EFFECTIVE_WINDOW_MS,
  Cycle,
  EffectiveMovement,
  Source,
  FetalMovementState,
  Command,
  CommandResult,
} from "./types"
import { formatDayKey, formatLocal, formatTime } from "../utils/date"
import { isFutureRejected } from "../utils/command"
import { cancelPendingCycleEndNotifications, scheduleCycleEndNotification } from "../utils/notifications"
import { createBackupFile, defaultState, parseBackupJson, readState, restoreFromBackup, restoreFromBackupFile, saveState } from "./storage"

export { createBackupFile }
export { buildDayCards, getTodayCard, selectWidgetRows, summarizeDayCards } from "./stats"
export { roundedBackground, themeColors, widgetCardRadius } from "./theme"
export type { FetalMovementState } from "./types"

export async function resetState(): Promise<CommandResult> {
  const nowTs = Date.now()
  const state = defaultState()
  saveState(state)
  await cancelPendingCycleEndNotifications()
  return result("reset", "unknown", nowTs, "reset", "重置胎动数据", "胎动记录已全部清空。")
}

export function createEffectiveMovement(nowTs: number): EffectiveMovement {
  const windowEndTs = nowTs + EFFECTIVE_WINDOW_MS
  return {
    effective_id: formatLocal(nowTs),
    effective_at: formatLocal(nowTs),
    effective_ts: nowTs,
    window_end_at: formatLocal(windowEndTs),
    window_end_ts: windowEndTs,
    sub_movements: [],
  }
}

export function createNewCycle(nowTs: number, source: Source): Cycle {
  const endTs = nowTs + CYCLE_DURATION_MS
  const movement = createEffectiveMovement(nowTs)
  return {
    cycle_id: formatLocal(nowTs),
    day_key: formatDayKey(nowTs),
    started_at: formatLocal(nowTs),
    started_ts: nowTs,
    scheduled_end_at: formatLocal(endTs),
    scheduled_end_ts: endTs,
    effective_count: 1,
    total_count: 1,
    effective_movements: [movement],
    source,
  }
}

export function getLastRecordTs(cycle: Cycle): number {
  let last = cycle.started_ts
  for (const movement of cycle.effective_movements) {
    last = Math.max(last, movement.effective_ts)
    for (const sub of movement.sub_movements) {
      last = Math.max(last, sub.ts)
    }
  }
  return last
}

export function archiveActiveCycle(state: FetalMovementState, reason: "expired" | "manual", endedTs: number): Cycle | null {
  if (!state.active_cycle) return null
  const cycle = state.active_cycle
  cycle.ended_ts = endedTs
  cycle.ended_at = formatLocal(endedTs)
  cycle.close_reason = reason
  cycle.is_valid = reason === "expired"
  state.completed_cycles.push(cycle)
  state.active_cycle = null
  return cycle
}

export function result(
  command: Command,
  source: Source,
  eventTs: number,
  status: string,
  title: string,
  message: string,
  extras: Partial<CommandResult> = {},
): CommandResult {
  return {
    status,
    title,
    message,
    command,
    source,
    event_ts: eventTs,
    event_at: formatLocal(eventTs),
    ...extras,
  }
}

export function archiveExpiredCycleIfNeeded(state: FetalMovementState, nowTs: number): Cycle | null {
  if (!state.active_cycle) return null
  if (nowTs < state.active_cycle.scheduled_end_ts) return null
  return archiveActiveCycle(state, "expired", state.active_cycle.scheduled_end_ts)
}

export function loadStateWithLazyArchive(nowTs = Date.now()): FetalMovementState {
  const { state } = readState()
  const archived = archiveExpiredCycleIfNeeded(state, nowTs)
  if (archived) saveState(state)
  return state
}

export async function recordMovement(eventTs: number, source: Source): Promise<CommandResult> {
  const nowTs = Date.now()
  const { state, warning } = readState()

  if (isFutureRejected(eventTs, nowTs)) {
    return result("record", source, eventTs, "future_time_rejected", "记录胎动", "记录时间异常，晚于当前时间过多，已取消。", { warning })
  }

  const archived = archiveExpiredCycleIfNeeded(state, eventTs)

  if (!state.active_cycle) {
    const cycle = createNewCycle(eventTs, source)
    state.active_cycle = cycle
    saveState(state)
    await scheduleCycleEndNotification(cycle)
    const status = archived ? "expired_archived_and_new_cycle" : "new_cycle"
    const prefix = archived ? "上个周期已自动结束。" : ""
    return result("record", source, eventTs, status, "记录胎动", `${prefix}已开启新周期，并记录为有效胎动。有效 1 次，点击 1 次。`, {
      cycle_id: cycle.cycle_id,
      day_key: cycle.day_key,
      effective_count: 1,
      total_count: 1,
      archived_cycle_id: archived?.cycle_id,
      warning,
    })
  }

  const cycle = state.active_cycle
  const lastRecordTs = getLastRecordTs(cycle)
  if (eventTs < lastRecordTs) {
    return result("record", source, eventTs, "out_of_order_rejected", "记录胎动", "记录时间早于上一条记录，已取消。请重新点击记录胎动。", { warning })
  }

  const movements = cycle.effective_movements
  const lastEffective = movements[movements.length - 1]
  cycle.total_count += 1

  if (eventTs - lastEffective.effective_ts < EFFECTIVE_WINDOW_MS) {
    lastEffective.sub_movements.push({ at: formatLocal(eventTs), ts: eventTs })
    saveState(state)
    return result("record", source, eventTs, "sub_movement", "记录胎动", `已记录为子胎动，不计入有效次数。有效 ${cycle.effective_count} 次，点击 ${cycle.total_count} 次。`, {
      cycle_id: cycle.cycle_id,
      day_key: cycle.day_key,
      effective_count: cycle.effective_count,
      total_count: cycle.total_count,
      warning,
    })
  }

  const movement = createEffectiveMovement(eventTs)
  cycle.effective_movements.push(movement)
  cycle.effective_count += 1
  saveState(state)
  return result("record", source, eventTs, "effective", "记录胎动", `已记录为有效胎动。有效 ${cycle.effective_count} 次，点击 ${cycle.total_count} 次。`, {
    cycle_id: cycle.cycle_id,
    day_key: cycle.day_key,
    effective_count: cycle.effective_count,
    total_count: cycle.total_count,
    warning,
  })
}

export async function closeCycle(eventTs: number, source: Source): Promise<CommandResult> {
  const nowTs = Date.now()
  const { state, warning } = readState()

  if (isFutureRejected(eventTs, nowTs)) {
    return result("close_cycle", source, eventTs, "future_time_rejected", "结束胎动周期", "结束时间异常，晚于当前时间过多，已取消。", { warning })
  }

  archiveExpiredCycleIfNeeded(state, eventTs)

  if (!state.active_cycle) {
    saveState(state)
    return result("close_cycle", source, eventTs, "no_active_cycle", "结束胎动周期", "当前没有正在进行的胎动周期。", { warning })
  }

  const cycle = state.active_cycle
  const lastRecordTs = getLastRecordTs(cycle)
  if (eventTs < cycle.started_ts) {
    return result("close_cycle", source, eventTs, "close_time_before_start_rejected", "结束胎动周期", "结束时间早于周期开始时间，已取消。", { warning })
  }
  if (eventTs < lastRecordTs) {
    return result("close_cycle", source, eventTs, "close_time_before_last_record_rejected", "结束胎动周期", "结束时间早于上一条记录，已取消。", { warning })
  }

  archiveActiveCycle(state, "manual", eventTs)
  saveState(state)
  await cancelPendingCycleEndNotifications()
  return result("close_cycle", source, eventTs, "closed", "结束胎动周期", `当前胎动周期已提前结束，并标记为无效。有效 ${cycle.effective_count} 次，点击 ${cycle.total_count} 次。`, {
    cycle_id: cycle.cycle_id,
    day_key: cycle.day_key,
    effective_count: cycle.effective_count,
    total_count: cycle.total_count,
    warning,
  })
}

export async function status(eventTs: number, source: Source): Promise<CommandResult> {
  const nowTs = Date.now()
  const { state, warning } = readState()

  if (isFutureRejected(eventTs, nowTs)) {
    return result("status", source, eventTs, "future_time_rejected", "胎动状态", "查询时间异常，晚于当前时间过多，已取消。", { warning })
  }

  const archived = archiveExpiredCycleIfNeeded(state, eventTs)
  if (archived) saveState(state)
  if (!state.active_cycle) {
    return result("status", source, eventTs, "status", "胎动状态", archived ? "上个周期已自动结束。当前没有正在进行的胎动周期。" : "当前没有正在进行的胎动周期。", { warning })
  }
  const cycle = state.active_cycle
  return result("status", source, eventTs, "status", "胎动状态", `当前周期 ${formatTime(cycle.started_ts)}-${formatTime(cycle.scheduled_end_ts)}。有效 ${cycle.effective_count} 次，点击 ${cycle.total_count} 次。`, {
    cycle_id: cycle.cycle_id,
    day_key: cycle.day_key,
    effective_count: cycle.effective_count,
    total_count: cycle.total_count,
    warning,
  })
}

async function syncNotificationsForRestoredState(state: FetalMovementState): Promise<void> {
  await cancelPendingCycleEndNotifications()
  if (state.active_cycle) {
    await scheduleCycleEndNotification(state.active_cycle)
  }
}

function restoreSuccessResult(command: Command, source: Source, eventTs: number, restoredState: FetalMovementState, safetyBackup: Awaited<ReturnType<typeof createBackupFile>>, backupFilePath?: string): CommandResult {
  return result(command, source, eventTs, "restore", "恢复胎动数据", `已从备份恢复胎动数据。恢复前安全备份：${safetyBackup.file_name}`, {
    restore_backup_file_path: backupFilePath,
    restore_safety_backup_file_path: safetyBackup.file_path,
    restore_safety_backup_file_name: safetyBackup.file_name,
    restored_completed_cycle_count: restoredState.completed_cycles.length,
    restored_has_active_cycle: !!restoredState.active_cycle,
  })
}

export async function restoreBackupFromFile(filePath: string, eventTs: number, source: Source): Promise<CommandResult> {
  const nowTs = Date.now()
  if (isFutureRejected(eventTs, nowTs)) {
    return result("restore", source, eventTs, "future_time_rejected", "恢复胎动数据", "恢复时间异常，晚于当前时间过多，已取消。")
  }
  try {
    const safetyBackup = await createBackupFile("auto", eventTs)
    const restoredState = await restoreFromBackupFile(filePath)
    await syncNotificationsForRestoredState(restoredState)
    return restoreSuccessResult("restore", source, eventTs, restoredState, safetyBackup, filePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return result("restore", source, eventTs, "restore_failed", "恢复胎动数据", `恢复失败：${message}`, { warning: message })
  }
}

export async function restoreBackupFromJson(raw: string, eventTs: number, source: Source): Promise<CommandResult> {
  const nowTs = Date.now()
  if (isFutureRejected(eventTs, nowTs)) {
    return result("restore", source, eventTs, "future_time_rejected", "恢复胎动数据", "恢复时间异常，晚于当前时间过多，已取消。")
  }
  try {
    const safetyBackup = await createBackupFile("auto", eventTs)
    const backup = parseBackupJson(raw)
    const restoredState = restoreFromBackup(backup)
    await syncNotificationsForRestoredState(restoredState)
    return restoreSuccessResult("restore", source, eventTs, restoredState, safetyBackup)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return result("restore", source, eventTs, "restore_failed", "恢复胎动数据", `恢复失败：${message}`, { warning: message })
  }
}

export async function runCommand(command: Command, eventTs: number, source: Source, options: { backup_file_path?: string; backup_json?: string } = {}): Promise<CommandResult> {
  if (command === "close_cycle") return closeCycle(eventTs, source)
  if (command === "status") return status(eventTs, source)
  if (command === "export") {
    const nowTs = Date.now()
    const { state, warning } = readState()
    if (isFutureRejected(eventTs, nowTs)) {
      return result("export", source, eventTs, "future_time_rejected", "导出胎动数据", "导出时间异常，晚于当前时间过多，已取消。", { warning })
    }
    const archived = archiveExpiredCycleIfNeeded(state, eventTs)
    if (archived) saveState(state)
    try {
      const backup = await createBackupFile("shortcut", eventTs, state)
      return result("export", source, eventTs, "export", "导出胎动数据", archived ? `上个周期已自动结束。已导出备份：${backup.file_name}` : `已导出备份：${backup.file_name}`, {
        export_json: backup.json,
        export_file_path: backup.file_path,
        export_file_name: backup.file_name,
        export_directory: backup.directory,
        export_storage: backup.storage,
        archived_cycle_id: archived?.cycle_id,
        warning,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return result("export", source, eventTs, "export_failed", "导出胎动数据", "生成备份文件失败，请稍后重试。", {
        export_json: JSON.stringify(state, null, 2),
        archived_cycle_id: archived?.cycle_id,
        warning: warning ? `${warning} ${errorMessage}` : errorMessage,
      })
    }
  }
  if (command === "restore") {
    if (options.backup_file_path) return restoreBackupFromFile(options.backup_file_path, eventTs, source)
    if (options.backup_json) return restoreBackupFromJson(options.backup_json, eventTs, source)
    return result("restore", source, eventTs, "restore_missing_backup", "恢复胎动数据", "缺少备份文件路径或备份 JSON，已取消恢复。")
  }
  if (command === "reset") return resetState()
  return recordMovement(eventTs, source)
}
