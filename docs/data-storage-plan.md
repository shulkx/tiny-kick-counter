# 数据存储规划

Tiny Kick Counter 当前仍处于开发阶段，可以不兼容旧的本地数据，也不需要设计旧数据迁移流程。存储优化按“先保证可备份，再完善恢复，最后稳定主存储”的顺序推进。

## 背景

当前项目使用 Scripting `Storage` 保存完整状态：

- 存储键：`fetal_movement_state`
- 数据结构：`FetalMovementState`
- 访问入口：主页面、Widget、AppIntents、Shortcuts

胎动记录属于高价值、时间序列数据。当前仅通过控制台输出完整 JSON 不足以满足实际备份需求，需要提供用户可见、可同步、可复制的备份文件。

## 目标

- 支持手动导出完整数据。
- 支持将导出文件作为备份长期保存。
- 备份文件优先写入 iCloud Documents，便于在 Files app 中查看、同步和再次备份。
- 主页面、Widget、AppIntents 和 Shortcuts 最终访问同一份主状态。
- 开发阶段不处理旧数据迁移；必要时可以直接重置或覆盖旧数据。

## 分阶段路线

### 阶段 1：JSON 备份导出（已实现）

保留当前 `Storage` 作为主存储，先补齐可备份能力。

实现内容：

- 已新增带 metadata 的备份 JSON，而不是只导出裸 `state`。
- 备份内容包含应用名、备份版本、导出时间、导出来源和完整 `FetalMovementState`。
- 主页面“导出”按钮会写入备份文件，并提示文件名。
- Shortcuts `export` 命令继续返回 `export_json`，同时返回备份文件信息，便于自动化备份。
- 备份文件优先保存到：`FileManager.iCloudDocumentsDirectory/TinyKickCounter/backups/`。
- 如果 iCloud Documents 不可用，会降级到本地 Documents，再降级到 App Group Documents。

建议文件名：

```text
tiny-kick-counter-backup-YYYYMMDD-HHmmss.json
```

备份格式草案：

```ts
export type BackupSource = "manual" | "shortcut" | "auto"

export type FetalMovementBackup = {
  app: "Tiny Kick Counter"
  backup_version: 1
  exported_at: string
  exported_ts: number
  source: BackupSource
  state: FetalMovementState
}
```

### 阶段 2：从备份恢复

在导出稳定后，再支持恢复。

计划改动：

- 支持选择或读取备份 JSON 并恢复当前状态。
- 恢复前自动导出当前状态，生成安全备份。
- 校验 `app`、`backup_version`、`state.schema_version`。
- 开发阶段只接受当前版本格式，不处理历史 schema 迁移。
- 恢复失败时保留现有状态不变。

### 阶段 3：切换主存储到文件

待导出和恢复能力稳定后，将主状态从 `Storage` 切换到文件。

计划改动：

- 主状态保存到 App Group 下的 JSON 文件，确保主页面、Widget、AppIntents 和 Shortcuts 都可以访问。
- 建议主状态路径：`FileManager.appGroupDocumentsDirectory/TinyKickCounter/state.json`。
- 保存时先写临时文件，再替换正式文件，降低写入中断导致状态损坏的风险。
- 读取失败时返回空状态并暴露 warning。
- 开发阶段允许直接忽略旧 `Storage` 数据，不做迁移。
- 继续保留阶段 1 的 iCloud Documents 手动备份能力。

### 阶段 4：可选 CSV 摘要导出

JSON 备份用于完整恢复，CSV 用于阅读和分享。

计划改动：

- 增加按天汇总 CSV。
- 可选增加按周期明细 CSV。
- CSV 仅作为可读摘要，不作为恢复来源。

## 非目标

当前阶段暂不处理：

- 旧版本数据迁移。
- 多设备并发编辑冲突合并。
- 自动定时备份。
- 加密备份。
- CSV 恢复。

## 推荐下一步

先实现阶段 1：JSON 备份导出。

涉及文件预计为：

- `common/types.ts`：增加备份类型和导出结果类型字段。
- `common/storage.ts`：增加创建备份对象、写入备份文件的函数。
- `common/model.ts`：让 `export` 命令返回备份文件信息。
- `index.tsx`：将主页面“导出”按钮改为写入备份文件。
