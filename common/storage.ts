import { BackupSource, BackupStorage, Cycle, FetalMovementBackup, FetalMovementState, STORAGE_KEY, STORAGE_OPTIONS } from "./types"

export function defaultState(): FetalMovementState {
  return { schema_version: 1, active_cycle: null, completed_cycles: [] }
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isValidCycle(value: unknown): value is Cycle {
  if (!value || typeof value !== "object") return false
  const cycle = value as Partial<Cycle>
  return typeof cycle.cycle_id === "string"
    && typeof cycle.day_key === "string"
    && typeof cycle.started_at === "string"
    && isFinitePositiveNumber(cycle.started_ts)
    && typeof cycle.scheduled_end_at === "string"
    && isFinitePositiveNumber(cycle.scheduled_end_ts)
    && typeof cycle.effective_count === "number"
    && Number.isFinite(cycle.effective_count)
    && typeof cycle.total_count === "number"
    && Number.isFinite(cycle.total_count)
    && Array.isArray(cycle.effective_movements)
}

function isValidState(value: unknown): value is FetalMovementState {
  if (!value || typeof value !== "object") return false
  const state = value as Partial<FetalMovementState>
  return state.schema_version === 1
    && (state.active_cycle === null || isValidCycle(state.active_cycle))
    && Array.isArray(state.completed_cycles)
    && state.completed_cycles.every(isValidCycle)
}

function isBackupSource(value: unknown): value is BackupSource {
  return value === "manual" || value === "shortcut" || value === "auto"
}

export function migrateStateIfNeeded(value: unknown): FetalMovementState {
  if (!value || typeof value !== "object") return defaultState()
  const state = value as Partial<FetalMovementState>
  if (state.schema_version !== 1) return defaultState()
  return {
    schema_version: 1,
    active_cycle: isValidCycle(state.active_cycle) ? state.active_cycle : null,
    completed_cycles: Array.isArray(state.completed_cycles) ? state.completed_cycles.filter(isValidCycle) : [],
  }
}

export function readState(): { state: FetalMovementState; warning?: string } {
  const raw = Storage.get<unknown>(STORAGE_KEY, STORAGE_OPTIONS)
  if (raw == null) return { state: defaultState() }
  try {
    if (typeof raw === "string") {
      return { state: migrateStateIfNeeded(JSON.parse(raw)) }
    }
    return { state: migrateStateIfNeeded(raw) }
  } catch {
    const state = defaultState()
    saveState(state)
    return { state, warning: "胎动记录数据异常，已重置为空状态。" }
  }
}

export function saveState(state: FetalMovementState): void {
  Storage.set(STORAGE_KEY, state, STORAGE_OPTIONS)
}

export type BackupFileResult = {
  backup: FetalMovementBackup
  json: string
  file_path: string
  file_name: string
  directory: string
  storage: BackupStorage
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function backupTimestamp(ts: number): string {
  const date = new Date(ts)
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function joinPath(...parts: string[]): string {
  return parts
    .map((part, index) => index === 0 ? part.replace(/\/+$/g, "") : part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")
}

function getBackupDirectoryCandidates(): Array<{ directory: string; storage: BackupStorage }> {
  const candidates: Array<{ directory: string; storage: BackupStorage }> = []
  if (FileManager.isiCloudEnabled) {
    candidates.push({
      directory: joinPath(FileManager.iCloudDocumentsDirectory, "TinyKickCounter", "backups"),
      storage: "icloud",
    })
  }
  candidates.push({
    directory: joinPath(FileManager.documentsDirectory, "TinyKickCounter", "backups"),
    storage: "documents",
  })
  candidates.push({
    directory: joinPath(FileManager.appGroupDocumentsDirectory, "TinyKickCounter", "backups"),
    storage: "app_group",
  })
  return candidates
}

export function createBackup(source: BackupSource, exportedTs = Date.now(), state = readState().state): FetalMovementBackup {
  return {
    app: "Tiny Kick Counter",
    backup_version: 1,
    exported_at: new Date(exportedTs).toISOString(),
    exported_ts: exportedTs,
    source,
    state,
  }
}

export async function createBackupFile(source: BackupSource, exportedTs = Date.now(), state = readState().state): Promise<BackupFileResult> {
  const backup = createBackup(source, exportedTs, state)
  const json = JSON.stringify(backup, null, 2)
  const fileName = `tiny-kick-counter-backup-${backupTimestamp(exportedTs)}.json`
  let lastError: unknown

  for (const candidate of getBackupDirectoryCandidates()) {
    try {
      await FileManager.createDirectory(candidate.directory, true)
      const filePath = joinPath(candidate.directory, fileName)
      await FileManager.writeAsString(filePath, json)
      return {
        backup,
        json,
        file_path: filePath,
        file_name: fileName,
        directory: candidate.directory,
        storage: candidate.storage,
      }
    } catch (error) {
      lastError = error
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? "未知错误")
  throw new Error(`写入备份文件失败：${message}`)
}

export function parseBackupJson(raw: string): FetalMovementBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("备份文件不是有效 JSON。")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("备份内容格式无效。")
  }

  const backup = parsed as Partial<FetalMovementBackup>
  if (backup.app !== "Tiny Kick Counter") {
    throw new Error("备份文件不属于 Tiny Kick Counter。")
  }
  if (backup.backup_version !== 1) {
    throw new Error("备份版本不受支持。")
  }
  if (typeof backup.exported_at !== "string" || typeof backup.exported_ts !== "number" || !Number.isFinite(backup.exported_ts)) {
    throw new Error("备份导出时间无效。")
  }
  if (!isBackupSource(backup.source)) {
    throw new Error("备份来源无效。")
  }
  if (!isValidState(backup.state)) {
    throw new Error("备份状态数据无效。")
  }

  return {
    app: "Tiny Kick Counter",
    backup_version: 1,
    exported_at: backup.exported_at,
    exported_ts: backup.exported_ts,
    source: backup.source,
    state: migrateStateIfNeeded(backup.state),
  }
}

export async function readBackupFile(filePath: string): Promise<FetalMovementBackup> {
  const raw = await FileManager.readAsString(filePath)
  return parseBackupJson(raw)
}

export function restoreFromBackup(backup: FetalMovementBackup): FetalMovementState {
  const restoredState = parseBackupJson(JSON.stringify(backup)).state
  saveState(restoredState)
  return restoredState
}

export async function restoreFromBackupFile(filePath: string): Promise<FetalMovementState> {
  const backup = await readBackupFile(filePath)
  return restoreFromBackup(backup)
}

export function exportState(): string {
  return JSON.stringify(readState().state, null, 2)
}
