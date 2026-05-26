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
