import {
  SeeyouCacheFile,
  SeeyouSyncStatus,
  SEEYOU_CACHE_FILE,
  defaultSeeyouCache,
} from "./types"
import { Cycle, SEEYOU_SOURCE } from "../common/types"

function getCacheDirectory(): string {
  return joinPath(FileManager.appGroupDocumentsDirectory, "TinyKickCounter")
}

function getCacheFilePath(): string {
  return joinPath(getCacheDirectory(), SEEYOU_CACHE_FILE)
}

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => i === 0 ? p.replace(/\/+$/g, "") : p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")
}

function isValidCycle(value: unknown): value is Cycle {
  if (!value || typeof value !== "object") return false
  const c = value as Partial<Cycle>
  return typeof c.cycle_id === "string"
    && typeof c.day_key === "string"
    && typeof c.started_ts === "number"
    && typeof c.scheduled_end_ts === "number"
    && typeof c.effective_count === "number"
    && typeof c.total_count === "number"
    && c.source === SEEYOU_SOURCE
}

function isValidStatus(value: unknown): value is SeeyouSyncStatus {
  return value === "ok" || value === "token_invalid" || value === "network_error" || value === "parse_error"
}

function migrateCache(raw: unknown): SeeyouCacheFile {
  if (!raw || typeof raw !== "object") return defaultSeeyouCache()
  const c = raw as Partial<SeeyouCacheFile>
  if (c.schema_version !== 1) return defaultSeeyouCache()
  const cycles = Array.isArray(c.cycles) ? c.cycles.filter(isValidCycle) : []
  return {
    schema_version: 1,
    sync_enabled: c.sync_enabled === true,
    cycles,
    last_sync_ts: typeof c.last_sync_ts === "number" ? c.last_sync_ts : null,
    last_sync_status: isValidStatus(c.last_sync_status) ? c.last_sync_status : null,
    last_sync_error_message: typeof c.last_sync_error_message === "string" ? c.last_sync_error_message : null,
  }
}

export function readSeeyouCache(): SeeyouCacheFile {
  const filePath = getCacheFilePath()
  if (!FileManager.existsSync(filePath)) return defaultSeeyouCache()
  try {
    return migrateCache(JSON.parse(FileManager.readAsStringSync(filePath)))
  } catch {
    const fallback = defaultSeeyouCache()
    saveSeeyouCache(fallback)
    return fallback
  }
}

export function saveSeeyouCache(cache: SeeyouCacheFile): void {
  const dir = getCacheDirectory()
  const filePath = getCacheFilePath()
  const tempPath = joinPath(dir, `seeyou.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`)
  const json = JSON.stringify(cache, null, 2)
  FileManager.createDirectorySync(dir, true)
  FileManager.writeAsStringSync(tempPath, json)
  try {
    FileManager.renameSync(tempPath, filePath)
  } catch {
    if (FileManager.existsSync(filePath)) FileManager.removeSync(filePath)
    FileManager.renameSync(tempPath, filePath)
  }
}

export function setSyncEnabled(enabled: boolean): SeeyouCacheFile {
  const cache = readSeeyouCache()
  const next: SeeyouCacheFile = { ...cache, sync_enabled: enabled }
  saveSeeyouCache(next)
  return next
}

export function clearSeeyouData(): SeeyouCacheFile {
  const cache = readSeeyouCache()
  const next: SeeyouCacheFile = {
    schema_version: 1,
    sync_enabled: cache.sync_enabled,
    cycles: [],
    last_sync_ts: null,
    last_sync_status: null,
    last_sync_error_message: null,
  }
  saveSeeyouCache(next)
  return next
}

export function shouldAutoSync(now: number, lastSyncTs: number | null, minIntervalMs: number): boolean {
  if (lastSyncTs === null) return true
  return now - lastSyncTs >= minIntervalMs
}
