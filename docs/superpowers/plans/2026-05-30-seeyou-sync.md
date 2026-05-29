# 美柚同步功能 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Tiny Kick Counter 通过用户 Token 拉取美柚胎动记录，缓存到本地独立 JSON，主页 / 历史页 / Widget 合并显示并通过角标区分来源。

**Architecture:**
- 美柚数据独立于本机 state.json，存于 `seeyou.json` + Token 存于 Keychain。
- 数据流：`seeyou_api` → 映射成 `Cycle`（复用类型） → `reconcileByDay` 按天对账写入缓存 → stats 层合并显示。
- 同步触发：主 App `scenePhase=active`（5 分钟限流）+ 设置页"立即同步"按钮；Widget / Intent 永不触发同步。

**Tech Stack:** TypeScript + Scripting iOS APIs（FileManager、Keychain、HTTP）+ SwiftUI 包装组件。

**Spec:** `docs/superpowers/specs/2026-05-30-seeyou-sync-design.md`

**验证命令（唯一）：** `scripting-ts project "Tiny Kick Counter" --check`

---

## 任务总览

1. 扩展 `Source` 类型与添加 `SEEYOU_SOURCE` 常量
2. 创建 `common/seeyou_types.ts`（API 类型 + 缓存类型 + 同步结果）
3. 创建 `common/seeyou_token.ts`（Keychain 封装）
4. 创建 `common/seeyou_map.ts`（API 记录 → Cycle 映射，pure）
5. 创建 `common/seeyou_reconcile.ts`（按天对账，pure）
6. 创建 `common/seeyou_api.ts`（HTTP + 错误分类）
7. 创建 `common/seeyou_cache.ts`（seeyou.json I/O + sync_enabled）
8. 创建 `common/seeyou_sync.ts`（编排：token → fetch → reconcile → save）
9. 修改 `common/stats.ts`（合并 seeyouCycles + 区分本机 active）
10. 修改 `common/model.ts`（re-export 入口需要的 API）
11. 修改 `pages/settings.tsx`（美柚同步 Section）
12. 修改 `index.tsx`（自动同步 + 美柚 cycle 守卫 + 卡片合并 + 角标）
13. 修改 `widget.tsx`（合并今日美柚 + CycleRow 角标）
14. 在 `README.md` 加 Token 获取简短说明

---

### Task 1: 扩展 `Source` 类型 + 添加 `SEEYOU_SOURCE` 常量

**Files:**
- Modify: `common/types.ts:7`

- [ ] **Step 1: 修改 Source 类型**

在 `common/types.ts` 第 7 行：

```typescript
export type Source = "shortcut" | "widget" | "app" | "unknown" | "seeyou"
export const SEEYOU_SOURCE: Source = "seeyou"
export const SEEYOU_CYCLE_ID_PREFIX = "seeyou:"
```

- [ ] **Step 2: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS（不引入新错误）

- [ ] **Step 3: Commit**

```bash
git add common/types.ts
git commit -m "feat(seeyou): extend Source type with 'seeyou' and add constants"
```

---

### Task 2: 创建 `common/seeyou_types.ts`

**Files:**
- Create: `common/seeyou_types.ts`

- [ ] **Step 1: 写入文件全部内容**

```typescript
import { Cycle } from "./types"

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

export const SEEYOU_FETCH_TIMEOUT_MS = 15_000
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
```

- [ ] **Step 2: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add common/seeyou_types.ts
git commit -m "feat(seeyou): add seeyou types, constants and default cache factory"
```

---


### Task 3: 创建 `common/seeyou_token.ts`（Keychain 封装）

**Files:**
- Create: `common/seeyou_token.ts`

参考：`dts/global.d.ts` 中 `Keychain` 命名空间提供 `get/set/remove(key, options)`。

- [ ] **Step 1: 写入文件全部内容**

```typescript
import { SEEYOU_KEYCHAIN_TOKEN_KEY } from "./seeyou_types"

export function getSeeyouToken(): string | null {
  try {
    const value = Keychain.get(SEEYOU_KEYCHAIN_TOKEN_KEY)
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export function setSeeyouToken(token: string): void {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    clearSeeyouToken()
    return
  }
  Keychain.set(SEEYOU_KEYCHAIN_TOKEN_KEY, trimmed)
}

export function clearSeeyouToken(): void {
  try {
    Keychain.remove(SEEYOU_KEYCHAIN_TOKEN_KEY)
  } catch {
    // already absent
  }
}

export function hasSeeyouToken(): boolean {
  return getSeeyouToken() !== null
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

> 如 Keychain 真实 API 名称与上述不一致（例如 `Keychain.set(key, value, opts)` 顺序不同），按 `dts/global.d.ts` 中实际签名调整调用，但保持函数导出名不变。

- [ ] **Step 3: Commit**

```bash
git add common/seeyou_token.ts
git commit -m "feat(seeyou): keychain wrappers for token get/set/clear/has"
```

---

### Task 4: 创建 `common/seeyou_map.ts`（映射 + 测试）

**Files:**
- Create: `common/seeyou_map.ts`
- Create: `tests/seeyou_map_test.ts`

**纯函数职责**：把 `SeeyouRecord` 映射为 `Cycle`（含 day_key 本地时区重算、cycle_id 前缀、字段默认值）。

- [ ] **Step 1: 写测试 `tests/seeyou_map_test.ts`**

```typescript
import { SeeyouRecord } from "../common/seeyou_types"
import { mapSeeyouRecordToCycle } from "../common/seeyou_map"
import { formatDayKey } from "../utils/date"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const record: SeeyouRecord = {
  id: 399503186,
  start_time: 1780029885,
  date: 20260529,
  fetal_times: 7,
  click_times: 14,
}

const cycle = mapSeeyouRecordToCycle(record)

assert(cycle.cycle_id === "seeyou:399503186", "cycle_id has seeyou prefix")
assert(cycle.source === "seeyou", "source is seeyou")
assert(cycle.started_ts === 1780029885 * 1000, "started_ts is start_time * 1000")
assert(cycle.scheduled_end_ts === cycle.started_ts + 3_600_000, "end is +1 hour")
assert(cycle.effective_count === 7, "effective_count from fetal_times")
assert(cycle.total_count === 14, "total_count from click_times")
assert(cycle.effective_movements.length === 0, "no sub movements")
assert(cycle.is_valid === undefined, "is_valid not set")
assert(cycle.close_reason === undefined, "close_reason not set")
assert(cycle.ended_ts === undefined, "ended_ts not set")
assert(cycle.day_key === formatDayKey(cycle.started_ts), "day_key from started_ts local tz")

const missingCounts: SeeyouRecord = { id: 1, start_time: 1780029885, date: 20260529 }
const cycle2 = mapSeeyouRecordToCycle(missingCounts)
assert(cycle2.effective_count === 0, "missing fetal_times defaults to 0")
assert(cycle2.total_count === 0, "missing click_times defaults to 0")

console.log("seeyou_map_test passed")
```

- [ ] **Step 2: 验证测试在 implementation 之前会失败（参考）**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: FAIL（`mapSeeyouRecordToCycle` 未定义）

- [ ] **Step 3: 写 implementation `common/seeyou_map.ts`**

```typescript
import { Cycle, SEEYOU_CYCLE_ID_PREFIX, SEEYOU_SOURCE } from "./types"
import { formatDayKey } from "../utils/date"
import { SeeyouRecord } from "./seeyou_types"

const ONE_HOUR_MS = 60 * 60 * 1000

function isoOfTs(ts: number): string {
  return new Date(ts).toISOString()
}

export function mapSeeyouRecordToCycle(record: SeeyouRecord): Cycle {
  const startedTs = record.start_time * 1000
  const scheduledEndTs = startedTs + ONE_HOUR_MS
  return {
    cycle_id: SEEYOU_CYCLE_ID_PREFIX + record.id,
    day_key: formatDayKey(startedTs),
    started_at: isoOfTs(startedTs),
    started_ts: startedTs,
    scheduled_end_at: isoOfTs(scheduledEndTs),
    scheduled_end_ts: scheduledEndTs,
    effective_count: typeof record.fetal_times === "number" ? record.fetal_times : 0,
    total_count: typeof record.click_times === "number" ? record.click_times : 0,
    effective_movements: [],
    source: SEEYOU_SOURCE,
  }
}
```

- [ ] **Step 4: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add common/seeyou_map.ts tests/seeyou_map_test.ts
git commit -m "feat(seeyou): map SeeyouRecord to Cycle with local day_key + tests"
```

---


### Task 5: 创建 `common/seeyou_reconcile.ts`（按天对账 + 测试）

**Files:**
- Create: `common/seeyou_reconcile.ts`
- Create: `tests/seeyou_reconcile_test.ts`

**纯函数职责**：对返回的每个 day group，如果 `list` 非空，覆盖本地该 `day_key` 的所有美柚 cycles；空 list 跳过该天；返回里没出现的 day_key 保留不动。

**关键**：day_key 来自映射后的 cycle（设备本地时区），不来自美柚的 `date` 字段。

- [ ] **Step 1: 写测试 `tests/seeyou_reconcile_test.ts`**

```typescript
import { Cycle, SEEYOU_CYCLE_ID_PREFIX, SEEYOU_SOURCE } from "../common/types"
import { SeeyouApiResponse } from "../common/seeyou_types"
import { reconcileByDay } from "../common/seeyou_reconcile"
import { mapSeeyouRecordToCycle } from "../common/seeyou_map"
import { formatDayKey } from "../utils/date"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const baseTs = 1779800000 * 1000
const dayKey = formatDayKey(baseTs)
const otherDayTs = baseTs - 7 * 24 * 60 * 60 * 1000
const otherDayKey = formatDayKey(otherDayTs)

function existingCycle(id: number, ts: number): Cycle {
  return mapSeeyouRecordToCycle({ id, start_time: ts / 1000, date: 20260520, fetal_times: 3, total_count: 4 } as any)
}

const existing: Cycle[] = [
  existingCycle(1, baseTs),
  existingCycle(2, baseTs + 60_000),
  existingCycle(99, otherDayTs),
]

const response: SeeyouApiResponse = [
  {
    date: 20260520,
    list: [
      { id: 2, start_time: (baseTs + 60_000) / 1000, date: 20260520, fetal_times: 5, click_times: 6 },
      { id: 3, start_time: (baseTs + 120_000) / 1000, date: 20260520, fetal_times: 8, click_times: 10 },
    ],
  },
]

const reconciled = reconcileByDay(existing, response)

const sameDay = reconciled.filter(c => c.day_key === dayKey)
assert(sameDay.length === 2, "covered day replaced to 2 entries")
assert(sameDay.some(c => c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "2"), "id=2 kept")
assert(sameDay.some(c => c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "3"), "id=3 added")
assert(!sameDay.some(c => c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "1"), "id=1 (deleted on server) removed locally")

assert(reconciled.some(c => c.day_key === otherDayKey && c.cycle_id === SEEYOU_CYCLE_ID_PREFIX + "99"), "uncovered day preserved")

// 空 list 不触发对账
const responseWithEmpty: SeeyouApiResponse = [{ date: 20260520, list: [] }]
const reconciled2 = reconcileByDay(existing, responseWithEmpty)
const sameDay2 = reconciled2.filter(c => c.day_key === dayKey)
assert(sameDay2.length === 2, "empty list skips reconcile (kept original 2)")

// source 守卫：非 seeyou 来源不应被对账影响（防御性）
const mixed: Cycle[] = [
  ...existing,
  { cycle_id: "local-1", day_key: dayKey, started_at: "", started_ts: baseTs, scheduled_end_at: "", scheduled_end_ts: baseTs + 3600000, effective_count: 1, total_count: 1, effective_movements: [] },
]
const reconciledMixed = reconcileByDay(mixed, response)
assert(reconciledMixed.some(c => c.cycle_id === "local-1"), "non-seeyou cycle preserved")

console.log("seeyou_reconcile_test passed")
```

- [ ] **Step 2: 写 implementation `common/seeyou_reconcile.ts`**

```typescript
import { Cycle, SEEYOU_SOURCE } from "./types"
import { SeeyouApiResponse } from "./seeyou_types"
import { mapSeeyouRecordToCycle } from "./seeyou_map"

export function reconcileByDay(currentCycles: Cycle[], response: SeeyouApiResponse): Cycle[] {
  // 仅对账 seeyou 来源；其他 source（异常情况）原样保留
  const seeyouCycles = currentCycles.filter(c => c.source === SEEYOU_SOURCE)
  const otherCycles = currentCycles.filter(c => c.source !== SEEYOU_SOURCE)

  // 按 day_key 分桶
  const byDay = new Map<string, Cycle[]>()
  for (const cycle of seeyouCycles) {
    const arr = byDay.get(cycle.day_key)
    if (arr) arr.push(cycle)
    else byDay.set(cycle.day_key, [cycle])
  }

  // 处理返回中每个 day group
  for (const group of response) {
    if (!Array.isArray(group.list) || group.list.length === 0) continue
    const mapped = group.list.map(mapSeeyouRecordToCycle)
    // 同一组内可能跨多个本地 day_key（极端情况：跨午夜），分别覆盖
    const dayKeysCovered = new Set(mapped.map(c => c.day_key))
    for (const k of dayKeysCovered) byDay.set(k, [])
    for (const c of mapped) {
      const arr = byDay.get(c.day_key)
      if (arr) arr.push(c)
      else byDay.set(c.day_key, [c])
    }
  }

  const merged: Cycle[] = []
  for (const arr of byDay.values()) merged.push(...arr)
  return [...otherCycles, ...merged]
}
```

- [ ] **Step 3: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add common/seeyou_reconcile.ts tests/seeyou_reconcile_test.ts
git commit -m "feat(seeyou): reconcile-by-day with empty-list defense + tests"
```

---


### Task 6: 创建 `common/seeyou_api.ts`（HTTP + 错误分类）

**Files:**
- Create: `common/seeyou_api.ts`

**职责**：构造 GET 请求，添加固定查询参数 + `authorization` 头，超时 15 秒；错误分类成 `SeeyouFetchResult`。

参考：抓包脚本 `seeyou_fetal_api.py` 里 `DEFAULT_PARAMS` 和 `STATIC_HEADERS`，照搬即可。

- [ ] **Step 1: 写入文件全部内容**

```typescript
import {
  SEEYOU_API_URL,
  SEEYOU_FETCH_TIMEOUT_MS,
  SeeyouApiResponse,
  SeeyouFetchResult,
} from "./seeyou_types"

const QUERY_PARAMS: Record<string, string> = {
  app_id: "01",
  channelID: "AppStore",
  lang: "zh",
  mode: "1",
  platform: "ios",
  scale: "3.0",
  themeid: "0",
  v: "9.0.6",
  v1: "9.06.0.0",
  start: "0",
}

const STATIC_HEADERS: Record<string, string> = {
  appid: "01",
  scale: "3.0",
  accept: "*/*",
  buildv: "9.06.0.6",
  source: "SYCalendarViewController->IMYToolsMainFMCountingVC",
  "accept-language": "zh-Hans-CN;q=1, en-CN;q=0.9",
  myclient: "0120906000000000",
  myappinfo: "01-2-9.06.0.0-0000-0",
  "user-agent": "Seeyou/9.06.0 (iPhone; iOS 26.5; Scale/3.00)",
  sv: "KK77",
}

function buildUrl(): string {
  const qs = Object.keys(QUERY_PARAMS)
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(QUERY_PARAMS[k]))
    .join("&")
  return SEEYOU_API_URL + "?" + qs
}

function isResponseShape(value: unknown): value is SeeyouApiResponse {
  if (!Array.isArray(value)) return false
  return value.every(group => {
    if (!group || typeof group !== "object") return false
    const g = group as { date?: unknown; list?: unknown }
    return typeof g.date === "number" && Array.isArray(g.list)
  })
}

export async function fetchSeeyouFetal(token: string): Promise<SeeyouFetchResult> {
  const url = buildUrl()
  const headers: Record<string, string> = { ...STATIC_HEADERS, authorization: token }

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(SEEYOU_FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: "network_error", message }
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: "token_invalid", message: `HTTP ${response.status}` }
  }
  if (!response.ok) {
    return { kind: "network_error", message: `HTTP ${response.status}` }
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: "parse_error", message }
  }

  if (!isResponseShape(parsed)) {
    return { kind: "parse_error", message: "返回结构与预期不符" }
  }

  return { kind: "ok", data: parsed }
}
```

> 如 Scripting 的 `fetch` 不支持 `AbortSignal.timeout`，按 dts 调整为 Scripting 提供的超时机制（例如 `Request` 配合 `timeoutInterval`）。函数签名与返回值结构保持不变。

- [ ] **Step 2: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add common/seeyou_api.ts
git commit -m "feat(seeyou): http adapter with classified error results"
```

---


### Task 7: 创建 `common/seeyou_cache.ts`（seeyou.json I/O）

**Files:**
- Create: `common/seeyou_cache.ts`

**职责**：读写 `seeyou.json`，原子化写入（参考 `common/storage.ts:79-93` 的 tmp + rename 模式）。

- [ ] **Step 1: 写入文件全部内容**

```typescript
import {
  SeeyouCacheFile,
  SeeyouSyncStatus,
  SEEYOU_CACHE_FILE,
  defaultSeeyouCache,
} from "./seeyou_types"
import { Cycle, SEEYOU_SOURCE } from "./types"

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

function isValidStatus(value: unknown): value is SeeyouSyncStatus {
  return value === "ok" || value === "token_invalid" || value === "network_error" || value === "parse_error"
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
```

- [ ] **Step 2: 验证类型检查通过**

Run: `scripting-ts project "Tiny Kick Counter" --check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add common/seeyou_cache.ts
git commit -m "feat(seeyou): atomic cache I/O + sync_enabled + clear + interval helper"
```

---

### Task 8: 创建 `common/seeyou_sync.ts`（同步编排）

**Files:**
- Create: `common/seeyou_sync.ts`

- [ ] **Step 1: 写入文件** — 编排逻辑：读 token → fetchSeeyouFetal → reconcileByDay → saveSeeyouCache。导出 `syncSeeyou()` 和 `autoSyncIfDue()`。完整代码见 spec §4 + Task 7 模式。
- [ ] **Step 2: 验证** `scripting-ts project "Tiny Kick Counter" --check` → PASS
- [ ] **Step 3: Commit** `git commit -m "feat(seeyou): sync orchestration"`

---

### Task 9: 修改 `common/stats.ts`（合并 seeyouCycles）

**Files:**
- Modify: `common/stats.ts`

- [ ] **Step 1:** `buildDayCards` 增加第三参数 `seeyouCycles: Cycle[] = []`，concat 到 all cycles。
- [ ] **Step 2:** 新增 `isLocalActive(cycle)`: `cycle.source !== "seeyou" && !cycle.close_reason`。替换原有 `!cycle.close_reason` 判断。
- [ ] **Step 3:** `getTodayCard` 增加可选参数 `seeyouCycles`，传递给 `buildDayCards`。
- [ ] **Step 4: 验证** `scripting-ts project "Tiny Kick Counter" --check` → PASS
- [ ] **Step 5: Commit** `git commit -m "feat(stats): merge seeyou cycles + isLocalActive guard"`

---

### Task 10: 修改 `common/model.ts`（re-export）

**Files:**
- Modify: `common/model.ts`

- [ ] **Step 1:** 在末尾追加 re-export：`syncSeeyou`, `autoSyncIfDue`, `readSeeyouCache`, `saveSeeyouCache`, `setSyncEnabled`, `clearSeeyouData`, `shouldAutoSync`, `getSeeyouToken`, `setSeeyouToken`, `clearSeeyouToken`, `hasSeeyouToken`, `SEEYOU_AUTO_SYNC_MIN_INTERVAL_MS`。
- [ ] **Step 2: 验证** → PASS
- [ ] **Step 3: Commit** `git commit -m "feat(model): re-export seeyou APIs for entry files"`

---

### Task 11: 修改 `pages/settings.tsx`（美柚同步 Section）

**Files:**
- Modify: `pages/settings.tsx`

- [ ] **Step 1:** 新增美柚同步 Section。包含：Toggle（sync_enabled）、Token 多行 TextField + 显示/隐藏 + 保存按钮、"上次同步"状态行、"立即同步"按钮（loading + toast/Dialog）、"清空美柚数据"红色按钮（二次确认）、? 帮助 Dialog。详见 spec §5.1。
- [ ] **Step 2: 验证** → PASS
- [ ] **Step 3: Commit** `git commit -m "feat(settings): seeyou sync section"`

---

### Task 12: 修改 `index.tsx`（自动同步 + 角标 + 删除守卫）

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1:** scenePhase active 回调中调用 `autoSyncIfDue()`，成功后 `refresh()`。
- [ ] **Step 2:** `buildDayCards` 传入 `seeyouCycles`（从 `readSeeyouCache()` 读取，toggle 关时传空）。
- [ ] **Step 3:** `handleDeleteCycle` 入口守卫：`if (cycleId.startsWith("seeyou:")) return`。
- [ ] **Step 4:** 卡片渲染：`cycle.source === "seeyou"` 时右上角显示"美柚"角标（浅色 11pt Text）。
- [ ] **Step 5: 验证** → PASS
- [ ] **Step 6: Commit** `git commit -m "feat(index): auto-sync + seeyou badge + delete guard"`

---

### Task 13: 修改 `widget.tsx`（合并今日美柚 + 角标）

**Files:**
- Modify: `widget.tsx`

- [ ] **Step 1:** 入口读 seeyouCache，`sync_enabled` 时传 cycles 给 `getTodayCard`。
- [ ] **Step 2:** CycleRow / StatusCard 中 `cycle.source === "seeyou"` 时 trailing 追加 " ·美柚"。
- [ ] **Step 3: 验证** → PASS
- [ ] **Step 4: Commit** `git commit -m "feat(widget): merge seeyou today cycles + badge"`

---

### Task 14: README 加 Token 获取说明

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** 末尾追加"美柚同步（高级）"章节：启用方式 + Token 获取说明（抓包 authorization 头）。
- [ ] **Step 2: Commit** `git commit -m "docs: add seeyou token instructions"`

---

## 执行顺序

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

严格顺序执行（每个 Task 依赖前置 Task 的产物）。
