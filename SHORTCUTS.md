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
