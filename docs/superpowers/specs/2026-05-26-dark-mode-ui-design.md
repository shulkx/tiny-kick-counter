# Tiny Kick Counter 深色模式界面优化设计

## 背景

当前主界面和小组件在深色模式下存在明显可读性问题：多处卡片和按钮使用固定浅色 `rgba`、浅蓝或浅灰背景，但文本仍采用深色模式默认前景色，导致白字落在浅色卡片上，形成低对比度。截图中主界面设置页、记录页卡片、小组件状态卡片和按钮均受影响。

本次优化选择“折中方案”：保留现有温柔卡片视觉，不把主界面整体改成标准 `List`，但用 Scripting 标准动态样式建立共享主题，让主界面和小组件都正确适配浅色/深色模式。

## 目标

- 修复主界面记录页、设置页在深色模式下文字和卡片背景低对比的问题。
- 修复小组件在深色模式下状态卡片、摘要区和按钮不可读的问题。
- 保留现有布局、文案、交互和温柔卡片风格。
- 建立集中主题 token，减少未来继续硬编码浅色背景的风险。
- 尽可能使用 Scripting 标准能力：`DynamicShapeStyle`、系统语义色、`Widget.family`、`Widget.present`、现有 AppIntent 结构。

## 非目标

- 不重写业务逻辑、数据模型、统计规则或 AppIntent 行为。
- 不把主界面整体迁移为 `List + Section`，避免扩大范围和改变既有视觉。
- 不新增用户可配置主题或手动深浅色切换。
- 不引入自定义 `colorScheme` 状态监听，除非动态样式无法覆盖具体问题。

## 标准依据

Scripting API 调研结果：

- `Color` 支持 keyword、hex、rgba。
- `KeywordsColor` 包含 `label`、`secondaryLabel`、`tertiaryLabel`、`systemBackground`、`systemGroupedBackground`、`secondarySystemGroupedBackground`、`tertiarySystemGroupedBackground`、`systemFill`、`systemBlue`、`systemGreen`、`systemRed` 等语义色。
- `DynamicShapeStyle` 支持 `{ light, dark }`，系统按当前 color scheme 自动选择样式。
- `foregroundStyle` 与 `background` 都支持 `DynamicShapeStyle`。
- `background` 支持 `{ style, shape }`，因此可继续使用现有圆角卡片结构。
- 小组件应在 `widget.tsx` 中定义 UI，不使用 hooks；交互控件继续通过 `app_intents.tsx` 注册的 intents。

## 架构设计

### 1. 新增共享主题模块

新增 `common/theme.ts`，集中定义 UI 主题相关 token 和 helper。建议导出：

- `cardRadius`、`smallCardRadius`：统一圆角。
- `roundedBackground(style, radius)`：返回现有组件兼容的 `{ style, shape }` 对象。
- `cardShadow()`：浅色模式保留轻微暖色阴影；深色模式使用透明或极弱阴影，避免深色卡片出现脏边。
- `themeColors`：集中颜色 token。

示例 token 分类：

- 页面背景：`pageBackground`
- 主卡片：`heroCardBackground`
- 普通卡片：`cardBackground`
- 小信息块：`pillBackground`
- 活跃周期卡片：`activeCycleBackground`
- 空状态卡片：`emptyStateBackground`
- 危险操作背景：`destructiveBackground`
- 主按钮背景：`primaryButtonBackground`
- 次按钮背景：`secondaryButtonBackground`
- 状态文字：`activeStatusText`、`activeStatusDot`、`activeSubtitle`

这些 token 优先用 `DynamicShapeStyle`，其中 light 保留当前浅色暖调，dark 使用深灰、深暖灰、深绿/深蓝半透明色，确保与 `label` / `secondaryLabel` 有足够对比。

### 2. 主界面改造

`index.tsx` 保留组件结构，仅替换颜色来源：

- 删除本地重复常量 `CARD_RADIUS`、`SMALL_CARD_RADIUS`、`ACTIVE_*`，改从 `common/theme.ts` 导入。
- `RecordsHeroCard`、`SettingsPage` 顶部卡片、`EmptyState` 使用 `heroCardBackground` 或 `emptyStateBackground`。
- `DayCardView`、设置页各 section 使用 `cardBackground`。
- `SummaryPill` 使用 `pillBackground`。
- `CycleRow`：
  - active 使用 `activeCycleBackground`。
  - inactive 使用 `pillBackground` 或普通嵌套卡片背景。
  - 标题和统计文字显式使用 `label` / `secondaryLabel`，状态继续使用动态绿色 token。
- `SettingsActionRow`：
  - 普通行使用 `pillBackground`。
  - destructive 行使用 `destructiveBackground`，标题/图标使用 `systemRed`。
- 外层 `ScrollView` 内部容器可设置动态页面背景，或通过卡片背景完成主要视觉修复；优先最小改动，不改变导航和 Tab 结构。

### 3. 小组件改造

`widget.tsx` 继续保持无 hooks、无状态管理的标准小组件结构，只替换颜色与背景：

- 导入 `roundedBackground`、`themeColors`、必要圆角 token。
- `Summary`：标题使用 `label`，说明/“推算”使用 `secondaryLabel`，数字使用 `label`。
- `StatusCard`：
  - 无数据状态使用 `widgetNeutralCardBackground`。
  - active 使用 `widgetActiveCardBackground`。
  - completed 使用 `widgetNeutralCardBackground`。
  - 行内标题、尾随状态、时间统计都显式设置前景色。
- `ActionButtons`：
  - “记录胎动”使用 `primaryButtonBackground` + `systemBlue`。
  - “结束”使用 `secondaryButtonBackground` + `secondaryLabel`。
  - 保持现有尺寸随 `Widget.family` 调整。
- `WidgetView` 根容器可设置 `foregroundStyle="label"`，避免未显式设置的正文落到错误默认色。

### 4. 数据流与交互

本次不改变数据流：

- 主界面继续通过 `readState` / `recordMovement` / `closeCycle` / `Widget.reloadAll` 更新。
- 小组件继续读取 state，懒归档过期周期，并按 `active_cycle` 计算刷新时间。
- AppIntent 行为保持不变。

### 5. 错误处理

本次不新增新的异步错误路径。主题模块只包含纯 UI token/helper，风险主要是类型不匹配或某些动态样式在特定属性中不被接受。处理策略：

- 用 TypeScript 诊断确认 `DynamicShapeStyle` 类型与 `background` / `foregroundStyle` 兼容。
- 如果某个位置不接受动态对象，则仅在该位置退回为系统语义色 keyword，如 `secondarySystemGroupedBackground`。
- 避免在主题模块中访问运行时全局 `colorScheme`，降低生命周期和刷新风险。

### 6. 验证计划

实施后执行：

1. TypeScript 项目诊断。
2. 主界面运行/预览，检查记录页和设置页深色模式可读性。
3. 小组件预览 `systemMedium`；如可行，再预览 `systemSmall` 和 `systemLarge`。
4. 检查主要文本：标题、说明、统计数字、按钮文字、危险操作文字、当前周期状态文字。
5. 如截图仍显示低对比区域，只对对应 token 做局部微调，不扩大到布局重构。

## 验收标准

- 深色模式下主界面所有截图中原本发白卡片上的文字可清晰阅读。
- 深色模式下小组件标题、摘要、状态行、按钮文字可清晰阅读。
- 浅色模式保留原本温柔浅色卡片风格，不出现明显视觉倒退。
- 主界面和小组件共用主题 token，新增硬编码浅色背景数量显著减少。
- TypeScript 诊断通过。
