# 胎动计数快捷指令配置

本项目保留 Apple Shortcuts / Apple Watch 入口。快捷指令负责获取当前时间、调用 Scripting 脚本，并用脚本返回值发送确认通知。

## 快捷指令：记录胎动

1. 获取当前日期
2. 获取当前日期的 Unix 时间戳（秒）
3. 计算：Unix 秒 * 1000
4. 文本：

   ```json
   {"command":"record","event_ts":计算结果,"source":"shortcut"}
   ```

5. 运行 Scripting 脚本：`Tiny Kick Counter`，输入为上一步文本
6. 获取词典值：`title`
7. 获取词典值：`message`
8. 发送通知：标题 = `title`，正文 = `message`

预期：Apple Watch 和 iPhone 收到确认通知。第一次重置后运行通常返回 `new_cycle`。

## 快捷指令：结束当前胎动周期

1. 获取当前日期
2. 获取当前日期的 Unix 时间戳（秒）
3. 计算：Unix 秒 * 1000
4. 文本：

   ```json
   {"command":"close_cycle","event_ts":计算结果,"source":"shortcut"}
   ```

5. 运行 Scripting 脚本：`Tiny Kick Counter`，输入为上一步文本
6. 获取词典值：`title`
7. 获取词典值：`message`
8. 发送通知：标题 = `title`，正文 = `message`

预期：当前周期提前结束并标记为手动无效；普通卡片和小组件不统计该周期，但导出 JSON 保留。

## 快捷指令：导出备份

1. 获取当前日期
2. 获取当前日期的 Unix 时间戳（秒）
3. 计算：Unix 秒 * 1000
4. 文本：

   ```json
   {"command":"export","event_ts":计算结果,"source":"shortcut"}
   ```

5. 运行 Scripting 脚本：`Tiny Kick Counter`，输入为上一步文本
6. 可读取返回的词典值：
   - `title`：结果标题
   - `message`：结果说明
   - `export_json`：完整备份 JSON，包含 metadata 和 state
   - `export_file_name`：备份文件名
   - `export_file_path`：备份文件完整路径
   - `export_directory`：备份目录
   - `export_storage`：实际存储位置，可能是 `icloud`、`documents` 或 `app_group`

预期：生成 `tiny-kick-counter-backup-YYYYMMDD-HHmmss.json` 备份文件。优先保存到 iCloud Documents 下的 `TinyKickCounter/backups/`。

## 快捷指令：从备份恢复

优先建议在主页面点击“恢复”，从 Files app 手动选择备份 JSON。若需要通过 Shortcuts 自动化恢复，可以传入备份文件路径或完整备份 JSON。

### 方式一：通过备份文件路径恢复

文本：

```json
{"command":"restore","event_ts":计算结果,"source":"shortcut","backup_file_path":"/path/to/tiny-kick-counter-backup.json"}
```

### 方式二：通过备份 JSON 恢复

文本：

```json
{"command":"restore","event_ts":计算结果,"source":"shortcut","backup_json":"完整备份 JSON 字符串"}
```

恢复命令会：

- 恢复前自动生成一份安全备份。
- 只接受 Tiny Kick Counter 当前版本备份格式。
- 校验 `app`、`backup_version` 和 `state.schema_version`。
- 恢复失败时不修改当前状态。

可读取返回的词典值：

- `title`：结果标题
- `message`：结果说明
- `restore_backup_file_path`：被恢复的备份路径，仅文件路径方式返回
- `restore_safety_backup_file_path`：恢复前安全备份路径
- `restore_safety_backup_file_name`：恢复前安全备份文件名
- `restored_completed_cycle_count`：恢复后的已完成周期数
- `restored_has_active_cycle`：恢复后是否存在进行中的周期
