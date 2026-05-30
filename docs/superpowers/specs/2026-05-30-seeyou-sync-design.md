# 美柚胎动数据同步 — Design

**日期**: 2026-05-30
**作者**: brainstorming
**状态**: Draft (待审阅)

## 1. 目的与范围

让用户在 Tiny Kick Counter 中导入并展示来自美柚 (Seeyou) 的胎动记录，与本机数据合并显示。美柚数据作为云端镜像缓存，本机数据始终是用户的"原始数据真相"。

**核心约束**：
- 美柚数据**不影响**本机数据（独立存储、独立类型字段）
- 美柚数据**可随时重建**（不进备份，不影响 reset / restore）
- 同步是辅助功能，失败不阻塞核心记录流程

**非目标**：
- 不向美柚反向写入数据
- 不做美柚账号登录流程（用户自带 token）
- 不为非技术用户做 token 抓取教程

## 2. 美柚 API 行为（实测）

`GET https://tools.seeyouyima.com/fetal?app_id=01&...&start=0`

需要 `authorization` 请求头（用户的 token）。

**关键发现**：`start` 参数**不是分页 offset**。`start=0` 一次性返回该账号全部历史（实测一个账号返回 147 天 / 926 条 / 约 80 KB）。无需翻页。

**返回结构**（按天分组，从最新到最旧）：
```json
[
  {
    "date": 20260529,
    "list": [
      { "id": 399503186, "start_time": 1780029885, "date": 20260529, "fetal_times": 7, "click_times": 14 },
      ...
    ],
    "total_fetal_times": 27,
    "total_hours": 4,
    "predict_fetal_times": 81
  },
  ...
]
```

- `id`：美柚记录主键（数字）
- `start_time`：unix 秒（无 end_time，约定 +1 小时为窗口）
- `fetal_times` / `click_times`：偶尔缺失（极少数老记录无此字段，按 0 处理）
- 日期字段是北京时间归属，但我们重算成设备本地时区的 `day_key`

## 3. 数据模型

### 3.1 复用 `Cycle` 类型（不新增类型）

美柚记录通过映射函数转成 `Cycle`，关键字段：

| 字段 | 来源 |
|---|---|
| `cycle_id` | `"seeyou:" + id`（防止与本机 UUID 冲突） |
| `day_key` | 用 `start_time * 1000` 在设备本地时区重算（YYYY-MM-DD） |
| `started_at` / `started_ts` | `start_time * 1000` |
| `scheduled_end_at` / `scheduled_end_ts` | `started_ts + 3_600_000` |
| `effective_count` | `fetal_times ?? 0` |
| `total_count` | `click_times ?? 0` |
| `effective_movements` | `[]`（美柚无明细） |
| `source` | `"seeyou"` |
| `is_valid` | 不设置（stats 用 `is_valid !== false` 过滤，未设置时视为 valid，符合预期） |
| `close_reason` / `ended_ts` | 不设置 |

> `Source` 类型需要扩展为 `"shortcut" | "widget" | "app" | "unknown" | "seeyou"`。

### 3.2 存储布局

```
appGroupDocumentsDirectory/TinyKickCounter/
  state.json          ← 本机数据（完全不动，schema_version=1 保持）
  seeyou.json         ← 美柚缓存（新增）

Keychain:
  "tiny_kick_counter.seeyou_token"   ← token 加密存储
```

`seeyou.json` 结构：
```json
{
  "schema_version": 1,
  "sync_enabled": true,
  "cycles": [ /* SeeyouCycle as Cycle[] */ ],
  "last_sync_ts": 1780029885000,
  "last_sync_status": "ok" | "token_invalid" | "network_error" | "parse_error" | null,
  "last_sync_error_message": "..."
}
```

`sync_enabled` 必须放在 `seeyou.json`（而不是只放内存），因为 widget 也要读它判断"是否合并显示"。

## 4. 同步策略

### 4.1 单一路径：全量按天对账 + upsert

每次同步都做同一件事：

1. `GET start=0` → 拿到全部历史（按天分组）
2. 对返回里出现的**每一天**，做"按天对账"：
   - 把本地 `seeyou.cycles` 中 `day_key == 该天` 的全部清掉
   - 用返回的 list 写入
   - **空 list 跳过该天**（防御 API 异常导致误删）
3. 返回里**没出现**的日期 → 完全不动
4. 更新 `last_sync_ts` 和 `last_sync_status`

第一次同步、日常同步、手动同步逻辑完全一致 —— 因为 API 单次就返回全量。

### 4.2 触发时机

| 触发 | 行为 |
|---|---|
| 主 App 启动 / 回前台（active 事件） | 如果 toggle 开 且距上次 ≥ 5 分钟，触发自动同步 |
| 设置页"立即同步"按钮 | 立即同步（无间隔限制） |
| Widget intents（record / close_cycle） | **不触发同步** |
| Shortcut intent | **不触发同步** |

最小间隔 5 分钟用于防止用户频繁前后台切换导致请求风暴。

### 4.3 错误处理

- HTTP 401 → `token_invalid`
- 网络异常 / 超时（15 秒） → `network_error`
- JSON 解析失败或结构非预期 → `parse_error`
- 自动同步失败：**不重试**，等下次 active 事件
- 手动同步失败：**不重试**，弹 Dialog 显示分类错误信息

### 4.4 "清空美柚数据"

设置页提供红色按钮，二次确认后：

- 重置 `seeyou.json` 为 `{ schema_version: 1, sync_enabled: <保持当前值>, cycles: [], last_sync_ts: null, last_sync_status: null }`
- **不动 token、不动本机数据**
- 下次同步等于"第一次同步"（拉全量重建）

适用于：换美柚账号、数据感觉不对、想彻底清除美柚痕迹但保留 token 等场景。



## 5. UI 设计


### 5.1 设置页（pages/settings.tsx）

在现有设置项下方新增一个 Section "美柚同步"：

```
─── 美柚同步 ─────────────────────
[Toggle]  启用美柚同步              ●○

  Token  [..........................]
         [👁 显示/隐藏]   [保存]

  上次同步：今天 14:32  ✅
  [立即同步]

  [清空美柚数据]  ← 红色文字，二次确认
──────────────────────────────────
```

行为细节：
- **Toggle 关时**：隐藏"上次同步"、"立即同步"、"清空美柚数据"三行；Token 输入框保留（方便用户在 toggle 关闭时也能预配置）；UI 完全不显示美柚数据；不触发任何自动同步
- **Token 输入**：多行 TextField + 显示/隐藏开关；保存后存入 Keychain（不放 JSON）
- **保存按钮**：点击后写 Keychain 并 toast "已保存 Token"，不自动触发同步
- **立即同步**：调用同步函数，按钮变 loading "同步中…"，完成后弹 toast "已同步 N 条记录"；失败弹 Dialog 显示分类错误
- **上次同步状态**：成功 + 三种失败
  - `✅ 今天 14:32`
  - `❌ Token 失效 · 今天 14:32`
  - `❌ 网络错误 · 今天 14:32`
  - `❌ 数据异常 · 今天 14:32`
- **清空美柚数据**：二次确认 Dialog "将清空 N 条美柚记录，下次同步会重新下载完整历史，本机记录不受影响"
- **Token 旁的 ? 提示**：点开显示一句简短说明 + 提示阅读 README


### 5.2 主页 / 历史页卡片

`buildDayCards` 增加可选参数 `seeyouCycles: Cycle[]`：

- 合并发生在 stats 层：本机 cycles + 美柚 cycles concat → 按 `started_ts` 排序 → 分组到 day cards
- DayCard 内 `cycles` 字段同时包含两种来源，按时间升序

卡片渲染层：
- 右上角根据 `cycle.source === "seeyou"` 渲染 **"美柚"** 角标（浅色 11pt）
- 本机卡片不显示角标（保持现有视觉）
- **美柚卡片禁用长按删除手势**：删除处理函数入口加一行 `if (cycle.source === "seeyou") return`
- 美柚卡片仍然不可点开（现有 implementation 本就不可点开，无需变更）

详情：详情页这条对美柚 cycle 不适用（卡片不可点开）。

### 5.3 Widget 合并（widget.tsx）

widget 入口读取 seeyou.json：

- 如果 `sync_enabled === false`：完全忽略，不读 cycles
- 如果 `sync_enabled === true`：把今日的美柚 cycle 合并进 `card.cycles`，参与 `effective_total`、`counted_hours`、`estimated_count`、`predict_fetal_times` 等推算
- `selectWidgetRows` 排序后统一编号；美柚 row 在 CycleRow 末尾 trailing 处加 "·美柚" 小字角标
- widget 入口**不触发任何网络请求**（不调用同步函数）
- ActionButton "记录胎动" 行为不变（永远操作本机 active_cycle）


## 6. 模块拆分

### 新增模块

**common/seeyou_api.ts** — HTTP 请求 + 错误分类
- `fetchSeeyouFetal(token: string): Promise<SeeyouApiResponse>`
- 使用 Scripting 提供的 HTTP API（具体 API 名以 `dts/` 为准），15 秒超时
- 错误分类：401 → `{kind: "token_invalid"}`；其他 HTTP/网络 → `{kind: "network_error"}`；JSON 解析失败 → `{kind: "parse_error"}`
- 不依赖任何其他业务模块（pure adapter）

**common/seeyou_token.ts** — Keychain 读写
- `getSeeyouToken(): string | null`
- `setSeeyouToken(token: string): void`
- `clearSeeyouToken(): void`
- 键名：`tiny_kick_counter.seeyou_token`

**common/seeyou.ts** — 缓存 + 映射 + 同步编排
- 类型：`SeeyouCacheFile { schema_version, sync_enabled, cycles, last_sync_ts, last_sync_status, last_sync_error_message }`
- `readSeeyouCache(): SeeyouCacheFile`
- `saveSeeyouCache(cache): void`
- `mapSeeyouRecordToCycle(record, dateGroupYYYYMMDD): Cycle` — 单条映射，重算 day_key
- `reconcileByDay(currentCycles, apiResponse): Cycle[]` — 按天对账（空 list 跳过）
- `syncSeeyou(): Promise<SyncResult>` — 主入口：读 token → fetch → reconcile → 保存
- `clearSeeyouData(): void` — 清空缓存（不清 token）
- `shouldAutoSync(now, lastSyncTs, MIN_INTERVAL_MS=5*60*1000): boolean`

### 修改模块

**common/types.ts**
- `Source` 类型扩展：`"shortcut" | "widget" | "app" | "unknown" | "seeyou"`
- 不新增 SeeyouCycle 类型（复用 Cycle，详见 §3.1）

**common/stats.ts**
- `buildDayCards(state, ...)` 新增可选参数 `seeyouCycles?: Cycle[]`
- 内部合并 `state.completed_cycles` + `state.active_cycle` + `seeyouCycles`，排序后分组
- `selectWidgetRows`、`getTodayCard` 接收已合并的 day card，不感知来源

**common/model.ts**
- 新增 re-export：`syncSeeyou`、`clearSeeyouData`、`getSeeyouToken`、`setSeeyouToken`、`readSeeyouCache`、`shouldAutoSync`
- 遵循 .cursor/rules/bundler-imports.md：entry files (index.tsx, widget.tsx) 只从 common/model 导入

**pages/settings.tsx**
- 新增"美柚同步" Section（详见 §5.1）

**index.tsx**
- `scenePhase === "active"` 处理函数中：如果 `sync_enabled && shouldAutoSync(...)` → 调用 `syncSeeyou()`（fire-and-forget，不阻塞 UI）
- `buildDayCards` 调用处传入 `readSeeyouCache().sync_enabled ? readSeeyouCache().cycles : undefined`

**widget.tsx**
- 入口读 seeyou 缓存（仅当 `sync_enabled`）
- `getTodayCard` 调用前合并美柚 cycles
- 不触发同步

### 不修改

- `intent.tsx` / `app_intents.tsx` / `utils/notifications.ts` / `utils/command.ts` / `utils/date.ts`
- `common/storage.ts`（state.json 完全不变）


## 7. 关键不变量（implementation 必须遵守）

按重要性排序，违反任何一条都会破坏设计的核心保证：

1. **美柚数据不进 backup**：`createBackup` / `restoreFromBackup` 完全不感知 seeyou.json
2. **reset / restore 不动 seeyou.json**：本机操作语义清晰，美柚数据独立
3. **widget intents / shortcut intent 不触发同步**：避免拖慢 intent 响应、超出时间预算
4. **自动同步 5 分钟最小间隔**：避免前后台切换风暴
5. **按天对账时空 list 跳过**：防御 API 返回异常导致误删
6. **cycle_id 加 "seeyou:" 前缀**：避免与本机 UUID 冲突
7. **day_key 用设备本地时区重算**：忽略美柚返回的 `date` 字段（北京时间）
8. **Source 类型必须先扩展为联合类型**：包含 "seeyou"，否则赋值会编译失败
9. **美柚 cycle 永远不出现在 state.active_cycle**：只存在于 seeyou.json
10. **美柚 cycle 不可被 deleteCycle 操作**：长按删除处理函数加 source 守卫
11. **Token 存 Keychain 不存 JSON**：避免 token 出现在 backup 文件、日志、临时文件中
12. **`sync_enabled` 影响显示**：toggle 关 → 主页/widget 不合并美柚数据（即使缓存里有）

## 8. Out of Scope

明确不做的事，避免实现时范围蔓延：

- ❌ 不向美柚反向写入数据（这个 API 是只读 GET，且不在产品定位内）
- ❌ 不做美柚账号登录流程（用户自带 token）
- ❌ 不做 token 抓取的 in-app 教程（README 简短说明 + ? 提示）
- ❌ 不做后台定时同步（Scripting 无持久后台任务能力；依赖前台触发）
- ❌ 不做美柚数据的详情页（美柚 API 无 sub_movement 明细）
- ❌ 不做美柚数据的删除/编辑入口（云端数据，本地无操作权）
- ❌ 不做 deeplink 到美柚 App
- ❌ 不做多账号支持（一个 token = 一个账号）
- ❌ 不做美柚数据导入到 state.json 的"转移"功能
- ❌ 不做同步失败的自动重试

## 9. 验证

完成 implementation 后必须通过：

```sh
scripting-ts project "Tiny Kick Counter" --check
```

手动验证清单：
- [ ] 配置 token 后立即同步成功，主页/历史页/widget 显示美柚数据带角标
- [ ] 关闭 toggle，UI 立即隐藏美柚数据；缓存文件保留
- [ ] 重新开启 toggle，无需同步，数据立即恢复
- [ ] 用错误的 token 同步，弹出"Token 失效"提示
- [ ] 断网手动同步，弹出"网络错误"提示
- [ ] 在美柚 App 删除一条今天的记录，下次同步后本地该条消失
- [ ] 在美柚 App 删除一条很老（>3 个月）的记录，下次同步本地也消失（因为单次返回全量）
- [ ] 清空美柚数据后，缓存清零，token 保留，下次同步重建全量
- [ ] reset 本机数据，美柚数据不变
- [ ] 导出 backup 文件，文件中不含美柚数据
- [ ] 从 backup 恢复，美柚数据不被覆盖
- [ ] widget 按"记录胎动"按钮，正常创建本机 cycle，不触发同步请求
- [ ] 5 分钟内多次切换前后台，只触发一次同步

