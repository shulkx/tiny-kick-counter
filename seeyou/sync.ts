import { SEEYOU_AUTO_SYNC_MIN_INTERVAL_MS, SeeyouSyncResult } from "./types"
import { getSeeyouToken } from "./token"
import { fetchSeeyouFetal } from "./api"
import { reconcileByDay } from "./reconcile"
import { readSeeyouCache, saveSeeyouCache, shouldAutoSync } from "./cache"

export async function syncSeeyou(): Promise<SeeyouSyncResult> {
  const token = getSeeyouToken()
  if (!token) {
    return { kind: "no_token", message: "未配置 Token" }
  }

  const fetchResult = await fetchSeeyouFetal(token)

  if (fetchResult.kind !== "ok") {
    const cache = readSeeyouCache()
    saveSeeyouCache({
      ...cache,
      last_sync_ts: Date.now(),
      last_sync_status: fetchResult.kind,
      last_sync_error_message: fetchResult.message,
    })
    return fetchResult
  }

  const cache = readSeeyouCache()
  const reconciledCycles = reconcileByDay(cache.cycles, fetchResult.data)

  const next = {
    ...cache,
    cycles: reconciledCycles,
    last_sync_ts: Date.now(),
    last_sync_status: "ok" as const,
    last_sync_error_message: null,
  }
  saveSeeyouCache(next)

  return { kind: "ok", importedCount: reconciledCycles.length, totalCount: reconciledCycles.length }
}

let pendingAutoSync: Promise<SeeyouSyncResult | null> | null = null

export async function autoSyncIfDue(): Promise<SeeyouSyncResult | null> {
  if (pendingAutoSync) return pendingAutoSync
  const cache = readSeeyouCache()
  if (!cache.sync_enabled) return null
  const now = Date.now()
  if (!shouldAutoSync(now, cache.last_sync_ts, SEEYOU_AUTO_SYNC_MIN_INTERVAL_MS)) return null
  pendingAutoSync = syncSeeyou().finally(() => { pendingAutoSync = null })
  return pendingAutoSync
}
