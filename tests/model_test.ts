import { recordMovement, closeCycle, readState, saveState, defaultState, resetState, migrateStateIfNeeded } from "../model"

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
    assert(closed.status === "closed", "manual close succeeds")
    const state = readState().state
    assert(state.active_cycle === null, "manual close clears active cycle")
    assert(state.completed_cycles.length === 1, "manual close archives cycle")
    assert(state.completed_cycles[0].is_valid === false, "manual close marks invalid")

    const migrated = migrateStateIfNeeded({
      schema_version: 1,
      active_cycle: null,
      completed_cycles: [
        { at: "2026-05-26 09:50:05", ts: base },
        readState().state.completed_cycles[0],
      ],
    })
    assert(migrated.completed_cycles.length === 1, "migration filters malformed completed cycles")
    assert(migrated.completed_cycles[0].cycle_id !== undefined, "migration keeps valid completed cycle")

    console.log("model_test passed")
  } finally {
    await resetState()
  }
}

run()
