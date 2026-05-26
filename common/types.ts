export const STORAGE_KEY = "fetal_movement_state"
export const STORAGE_OPTIONS = { shared: false }
export const CYCLE_DURATION_MS = 60 * 60 * 1000
export const EFFECTIVE_WINDOW_MS = 5 * 60 * 1000
export const FUTURE_TOLERANCE_MS = 2 * 60 * 1000
export const RECENT_DAY_LIMIT = 30
export const ESTIMATE_HOURS = 12

export type Source = "shortcut" | "widget" | "app" | "unknown"
export type CloseReason = "expired" | "manual"
export type Command = "record" | "close_cycle" | "status" | "export" | "reset"
export type BackupSource = "manual" | "shortcut" | "auto"
export type BackupStorage = "icloud" | "documents" | "app_group"

export type SubMovement = {
  at: string
  ts: number
}

export type EffectiveMovement = {
  effective_id: string
  effective_at: string
  effective_ts: number
  window_end_at: string
  window_end_ts: number
  sub_movements: SubMovement[]
}

export type Cycle = {
  cycle_id: string
  day_key: string
  started_at: string
  started_ts: number
  scheduled_end_at: string
  scheduled_end_ts: number
  effective_count: number
  total_count: number
  effective_movements: EffectiveMovement[]
  ended_at?: string
  ended_ts?: number
  close_reason?: CloseReason
  is_valid?: boolean
  source?: Source
}

export type FetalMovementState = {
  schema_version: 1
  active_cycle: Cycle | null
  completed_cycles: Cycle[]
}

export type FetalMovementBackup = {
  app: "Tiny Kick Counter"
  backup_version: 1
  exported_at: string
  exported_ts: number
  source: BackupSource
  state: FetalMovementState
}

export type CommandInput = {
  command: Command
  event_ts: number
  source: Source
  warning?: string
}

export type CommandResult = {
  status: string
  title: string
  message: string
  command: Command
  source: Source
  event_ts: number
  event_at: string
  cycle_id?: string
  day_key?: string
  effective_count?: number
  total_count?: number
  archived_cycle_id?: string
  warning?: string
  export_json?: string
  export_file_path?: string
  export_file_name?: string
  export_directory?: string
  export_storage?: BackupStorage
}

export type DayCard = {
  day_key: string
  cycles: Cycle[]
  counted_hours: number
  effective_total: number
  total_clicks: number
  estimated_count: number
  has_active_cycle: boolean
}

export type WidgetCycleRow = {
  cycle: Cycle
  label: "当前" | "上轮"
  isActive: boolean
}
