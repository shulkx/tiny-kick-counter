import { Cycle } from "../common/types"

export type SeeyouRecord = {
  id: number
  start_time: number
  date: number
  fetal_times?: number
  click_times?: number
}

export type SeeyouDayGroup = {
  date: number
  list: SeeyouRecord[]
  total_fetal_times?: number
  total_hours?: number
  predict_fetal_times?: number
}

export type SeeyouApiResponse = SeeyouDayGroup[]

export type SeeyouSyncStatus = "ok" | "token_invalid" | "network_error" | "parse_error"

export type SeeyouCacheFile = {
  schema_version: 1
  sync_enabled: boolean
  cycles: Cycle[]
  last_sync_ts: number | null
  last_sync_status: SeeyouSyncStatus | null
  last_sync_error_message: string | null
}

export type SeeyouFetchResult =
  | { kind: "ok"; data: SeeyouApiResponse }
  | { kind: "token_invalid"; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "parse_error"; message: string }

export type SeeyouSyncResult =
  | { kind: "ok"; importedCount: number; totalCount: number }
  | { kind: "no_token"; message: string }
  | { kind: "token_invalid"; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "parse_error"; message: string }

export const SEEYOU_FETCH_TIMEOUT_S = 15
export const SEEYOU_AUTO_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000
export const SEEYOU_KEYCHAIN_TOKEN_KEY = "tiny_kick_counter.seeyou_token"
export const SEEYOU_CACHE_FILE = "seeyou.json"
export const SEEYOU_API_URL = "https://tools.seeyouyima.com/fetal"

export function defaultSeeyouCache(): SeeyouCacheFile {
  return {
    schema_version: 1,
    sync_enabled: false,
    cycles: [],
    last_sync_ts: null,
    last_sync_status: null,
    last_sync_error_message: null,
  }
}
