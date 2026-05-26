import { Cycle, FetalMovementState, STORAGE_KEY, STORAGE_OPTIONS } from "./types"

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

export function exportState(): string {
  return JSON.stringify(readState().state, null, 2)
}
