import { recordMovement, closeCycle, resetState, deleteCycle, loadStateWithLazyArchive } from "../common/model"
import { readState, saveState, defaultState, migrateStateIfNeeded } from "../common/storage"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function run() {
  saveState(defaultState())
  try {
    const base = Date.now() - 10 * 60 * 1000

    const first = await recordMovement(base, "app")
    assert(first.status === "new_cycle", "first record creates new cycle")
    assert(first.effective_count === 1, "first record effective count")
    assert(first.total_count === 1, "first record total count")

    const sub = await recordMovement(base + 60 * 1000, "app")
    assert(sub.status === "sub_movement", "within 5 minutes is sub movement")
    assert(sub.effective_count === 1, "sub movement keeps effective count")
    assert(sub.total_count === 2, "sub movement increments total count")

    const effective = await recordMovement(base + 6 * 60 * 1000, "app")
    assert(effective.status === "effective", "after 5 minutes is effective")
    assert(effective.effective_count === 2, "effective increments effective count")
    assert(effective.total_count === 3, "effective increments total count")

    const rejected = await recordMovement(base + 2 * 60 * 1000, "app")
    assert(rejected.status === "out_of_order_rejected", "out-of-order record is rejected")

    const closed = await closeCycle(base + 10 * 60 * 1000, "app")
    assert(closed.status === "discarded", "manual close discards cycle")
    const stateAfterClose = readState().state
    assert(stateAfterClose.active_cycle === null, "manual close clears active cycle")
    assert(stateAfterClose.completed_cycles.length === 0, "manual close does not archive cycle")

    // Test deleteCycle
    saveState(defaultState())
    const delBase = Date.now() - 2 * 60 * 60 * 1000
    await recordMovement(delBase, "app")
    // Force expiry by reading state with a future timestamp
    const expiredState = loadStateWithLazyArchive(delBase + 61 * 60 * 1000)
    assert(expiredState.completed_cycles.length === 1, "expired cycle archived for delete test")
    const cycleToDelete = expiredState.completed_cycles[0].cycle_id

    const deleteResult = deleteCycle(cycleToDelete)
    assert(deleteResult.status === "deleted", "deleteCycle returns deleted status")
    const afterDelete = readState().state
    assert(afterDelete.completed_cycles.length === 0, "cycle removed after delete")

    const notFound = deleteCycle("nonexistent-id")
    assert(notFound.status === "not_found", "deleteCycle returns not_found for missing cycle")

    const fakeCycle = {
      cycle_id: "fake",
      day_key: "2026-05-26",
      started_at: "2026-05-26 09:00:00",
      started_ts: base,
      scheduled_end_at: "2026-05-26 10:00:00",
      scheduled_end_ts: base + 3600000,
      effective_count: 1,
      total_count: 1,
      effective_movements: [],
      close_reason: "manual" as const,
      is_valid: false,
    }
    const validCycle = {
      cycle_id: "valid",
      day_key: "2026-05-26",
      started_at: "2026-05-26 09:00:00",
      started_ts: base,
      scheduled_end_at: "2026-05-26 10:00:00",
      scheduled_end_ts: base + 3600000,
      effective_count: 4,
      total_count: 5,
      effective_movements: [],
      close_reason: "expired" as const,
      is_valid: true,
    }
    const migrated = migrateStateIfNeeded({
      schema_version: 1,
      active_cycle: null,
      completed_cycles: [
        { at: "2026-05-26 09:50:05", ts: base } as any,
        fakeCycle,
        validCycle,
      ],
    })
    assert(migrated.completed_cycles.length === 1, "migration keeps valid cycles, filters invalid and malformed")
    assert(migrated.completed_cycles[0].cycle_id === "valid", "migration keeps the correct cycle")

    console.log("model_test passed")
  } finally {
    await resetState()
  }
}

run()
