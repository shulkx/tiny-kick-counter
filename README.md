# Tiny Kick Counter

Tiny Kick Counter 是轻量胎动计数器的 Scripting 版本。它保留 Apple Shortcuts / Apple Watch 记录入口，同时增加 Scripting 主页面卡片和 systemMedium 交互式小组件。

相关设计与实施计划：

- 设计文档：`docs/superpowers/specs/2026-05-26-scripting-fetal-movement-design.md`
- 实施计划：`docs/superpowers/plans/2026-05-26-scripting-fetal-movement-implementation.md`

## 入口

- `index.tsx`：主页面，显示最近 30 天有记录的日期卡片。
- `widget.tsx`：systemMedium 小组件，显示今天摘要、最多 2 个周期明细，并提供记录/结束按钮。
- `intent.tsx`：Shortcuts 入口，接收 JSON 参数并返回结构化 JSON。
- `app_intents.tsx`：小组件按钮使用的 AppIntents。

## 业务规则

- 1 小时为一个计数周期。
- 没有活跃周期时，“记录胎动”自动开启周期并记录第 1 次有效胎动。
- 距上一条有效胎动不足 5 分钟的点击记为子胎动，只增加总点击数。
- 距上一条有效胎动 5 分钟及以上的点击记为新的有效胎动。
- 周期结束通知只提醒；归档由下一次入口运行时 lazy archive 完成。
- 手动提前结束的周期标记为无效，普通卡片和小组件隐藏且不参与统计，但导出 JSON 保留。
- 日期归属按周期开始时间 `day_key`。
- 推算次数 = `round(当日有效胎动总数 / 当日计数小时数 * 12)`。

## 快捷指令

快捷指令配置见 `SHORTCUTS.md`。核心方式是：快捷指令先获取当前时间戳毫秒值，作为 `event_ts` 传入 Scripting，再用返回的 `title` 和 `message` 自行发送确认通知。

示例参数：

```json
{"command":"record","event_ts":1779733304000,"source":"shortcut"}
```

```json
{"command":"close_cycle","event_ts":1779733304000,"source":"shortcut"}
```

## 文档

- 数据存储规划：`docs/data-storage-plan.md`

## 已知限制

- Widget 刷新时机由系统控制，无法保证秒级或严格 5 分钟刷新。
- 周期结束通知正文是静态提醒；最终次数需要打开主页面后由 lazy archive 显示。
- 初版只支持 systemMedium 小组件。
- 初版没有单独“开始计数”动作；记录胎动即开始周期。
- 初版没有编辑/撤销 UI。

## 验证

当前可用验证命令：

```sh
scripting-ts project "Tiny Kick Counter" --check
```

在当前 iOS shell 环境中，直接运行 `tests/model_test.ts` / `tests/stats_test.ts` 会遇到相对模块解析限制；项目级 check 可以正确解析整个脚本项目。

## 安装

安装包固定地址：

```text
https://github.com/shulkx/tiny-kick-counter/releases/latest/download/TinyKickCounter.zip
```

Scripting 远程资源配置使用同一个地址：

```json
"remoteResource": {
  "url": "https://github.com/shulkx/tiny-kick-counter/releases/latest/download/TinyKickCounter.zip",
  "autoUpdateInterval": 86400
}
```

发布包只包含运行和使用说明所需文件：`script.json`、入口文件、`README.md`、`SHORTCUTS.md`、`common/` 和 `utils/`。`docs/`、`tests/`、`.agent/`、`.github/`、`plan.md` 等开发文件不会打入 zip。

## 发布

发布前确认 `script.json.version` 已更新，例如：

```json
"version": "1.0.1"
```

创建并推送 tag：

```sh
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions 会自动创建 Release，并上传唯一资产：

```text
TinyKickCounter.zip
```

正式版本使用 `vX.Y.Z`；测试版本使用 `vX.Y.Z-beta.N`，测试版本会被标记为 prerelease。Release tag 必须指向 `main` 分支可达的提交。