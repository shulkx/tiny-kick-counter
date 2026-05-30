import { Cycle, SEEYOU_SOURCE } from "../common/types"
import { SeeyouApiResponse } from "./types"
import { mapSeeyouRecordToCycle } from "./map"

export function reconcileByDay(currentCycles: Cycle[], response: SeeyouApiResponse): Cycle[] {
  const seeyouCycles = currentCycles.filter(c => c.source === SEEYOU_SOURCE)
  const otherCycles = currentCycles.filter(c => c.source !== SEEYOU_SOURCE)

  const byDay = new Map<string, Cycle[]>()
  for (const cycle of seeyouCycles) {
    const arr = byDay.get(cycle.day_key)
    if (arr) arr.push(cycle)
    else byDay.set(cycle.day_key, [cycle])
  }

  const allMapped: Cycle[] = []
  const coveredDays = new Set<string>()

  for (const group of response) {
    if (!Array.isArray(group.list) || group.list.length === 0) continue
    const mapped = group.list.map(mapSeeyouRecordToCycle)
    for (const c of mapped) {
      coveredDays.add(c.day_key)
      allMapped.push(c)
    }
  }

  for (const k of coveredDays) byDay.set(k, [])
  for (const c of allMapped) {
    const arr = byDay.get(c.day_key)
    if (arr) arr.push(c)
    else byDay.set(c.day_key, [c])
  }

  const merged: Cycle[] = []
  for (const arr of byDay.values()) merged.push(...arr)
  return [...otherCycles, ...merged]
}
