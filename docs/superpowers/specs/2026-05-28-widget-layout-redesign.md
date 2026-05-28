# Widget Layout Redesign

**Date:** 2026-05-28
**Status:** Approved

## Problem

1. **systemSmall 布局不可用** — 155×155pt 的空间塞入 Summary + StatusCard + ActionButton 三个区块，内容挤在一起无法阅读。
2. **固定 padding 不适配多分辨率** — 硬编码 `padding: { horizontal: 18 }` 在 iPhone Air 上正常，但在其他手机分辨率（如 iPhone SE、iPhone 16 Pro Max）上边距比例失调。
3. **所有尺寸共用同一布局** — systemSmall / systemMedium / systemLarge 渲染同样的三段式结构，没有针对各尺寸的空间特点做差异化设计。

## Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| systemSmall 内容优先级 | 当前周期状态 + 记录按钮 | 去掉每日汇总（推算总数），突出操作性 |
| 多分辨率适配策略 | rpt() 等比缩放 | 代码简单、Epical 项目已验证、自动覆盖所有设备 |
| systemLarge 额外内容 | 显示多个周期行列表 | 利用额外空间展示今日全部周期，selectWidgetRows 已支持 |

## Design

### 响应式缩放工具函数

从 Epical 项目移植 `rpt()` 函数，以 155pt（systemSmall 短边 / systemMedium 高度）为基准做等比缩放。所有尺寸值（字号、padding、间距、圆角、按钮高度）通过 `rpt()` 换算。

```typescript
import { Widget } from "scripting"

const vmin = (n: number) => {
  const { width, height } = Widget.displaySize
  return (n * Math.min(width, height)) / 100
}

export const rpt = (n: number) => vmin((n * 100) / 155)
```

放置位置：`utils/responsive.ts`（新文件），widget.tsx 中导入使用。

### systemSmall 布局

精简为三个区域，垂直排列：

1. **标题行** — "胎动记录"，`font: rpt(10)`，`fontWeight: "bold"`
2. **状态卡片**（flex 占据剩余空间）
   - **有活跃周期时**：
     - 背景色 `widgetActiveCardBackground`
     - 顶部行：左"进行中" / 右"剩 XX 分"，`font: rpt(9)`
     - 中间：有效次数大号数字 `font: rpt(22)` + "次有效" `font: rpt(10)`
     - 底部行：时间范围 + 点击次数，`font: rpt(8)`
   - **无活跃周期时**：
     - 背景色 `widgetNeutralCardBackground`
     - "准备开始" `font: rpt(9)`
     - "点击下方按钮开始 1 小时计数" `font: rpt(8)`
   - **已完成最近一轮（无活跃周期但有今日已完成周期）**：
     - 背景色 `widgetNeutralCardBackground`
     - 顶部行：左"最近一轮" / 右"已完成"，`font: rpt(9)`
     - 中间：有效次数大号数字 `font: rpt(22)` + "次有效" `font: rpt(10)`
     - 底部行：时间范围 + 点击次数，`font: rpt(8)`
3. **记录按钮** — 全宽，`font: rpt(12)`，高度 `rpt(28)`，圆角 `rpt(14)`

不展示 Summary 区域（推算总数）。

Padding：`rpt(14)` 水平和顶部，`rpt(12)` 底部。
间距：标题到卡片 `rpt(8)`，卡片到按钮 `rpt(8)`。

### systemMedium 布局

保持现有三段式结构，将硬编码值替换为 rpt()：

1. **Summary** — "今日胎动" + 统计文字 + 推算总数
2. **StatusCard** — 和当前逻辑一致，区分有活跃周期/无活跃周期
3. **ActionButtons** — "记录胎动"按钮

关键尺寸值变更：

| 属性 | 旧值 | 新值 |
|------|------|------|
| contentPadding horizontal | 18 | rpt(16) |
| contentPadding vertical | 12 | rpt(12) |
| contentSpacing | 9 | rpt(8) |
| Summary 标题字号 | headline | rpt(13) |
| Summary 副标题字号 | caption | rpt(10) |
| 推算数字字号 | title | rpt(20) |
| StatusCard padding horizontal | 10 | rpt(10) |
| StatusCard padding vertical | 8 | rpt(7) |
| StatusCard 字号 | caption | rpt(10) |
| 按钮字号 | 16 | rpt(14) |
| 按钮高度 | 32 | rpt(28) |
| 按钮宽度 | 112 | rpt(120) |

无活跃周期时 StatusCard 内容左对齐（`alignment: "leading"`），与有活跃周期时保持一致。

### systemLarge 布局

上半部分 = systemMedium 的完整内容，下半部分新增周期列表：

1. **Summary + StatusCard + ActionButtons**（同 medium）
2. **分隔线** — 1pt 高，颜色 `tertiaryLabel`，水平 margin `rpt(4)`
3. **周期列表标题** — "今日周期记录"，`font: rpt(9)`，`foregroundStyle: secondaryLabel`
4. **周期行列表** — 使用 `selectWidgetRows` 返回的全部 rows（去掉当前的 2 行限制，改为按可用空间尽量多显示），每行结构：
   - 背景色 `widgetNeutralCardBackground`，圆角 `rpt(10)`
   - 顶部行：左"第 N 轮" / 右"已完成"
   - 底部行：时间范围 + 有效次数 + 点击次数
   - 字号 `rpt(9)`

Large 特有的尺寸值：

| 属性 | 值 |
|------|-----|
| contentPadding horizontal | rpt(18) |
| contentPadding vertical | rpt(16) |
| contentSpacing | rpt(8) |
| 按钮字号 | rpt(14) |
| 按钮高度 | rpt(32) |
| 按钮宽度 | rpt(140) |

Spacer 放在周期列表底部，将内容推向顶部。

### systemExtraLarge 布局

与 systemLarge 相同，不做额外处理。

### selectWidgetRows 调整

当前 `selectWidgetRows` 限制最多返回 2 行。为支持 systemLarge 显示更多周期，改为接受一个 `maxRows` 参数：

```typescript
export function selectWidgetRows(card: DayCard | null, maxRows = 2): { rows: WidgetCycleRow[]; hiddenCount: number }
```

widget.tsx 中 systemLarge 调用时传入更大的值（如 6）。

## File Changes

| 文件 | 变更 |
|------|------|
| `utils/responsive.ts` | 新增 `vmin()` 和 `rpt()` 函数 |
| `widget.tsx` | 重构为按 Widget.family 分发不同布局组件；所有硬编码尺寸改用 rpt() |
| `common/stats.ts` | `selectWidgetRows` 增加 `maxRows` 参数 |

## Out of Scope

- 不调整 app 内页面（index.tsx、pages/）的布局
- 不新增 widget 配置项（Widget.parameter）
- 不支持 accessoryCircular / accessoryRectangular 等锁屏小组件
