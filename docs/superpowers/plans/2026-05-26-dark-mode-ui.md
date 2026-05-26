# Tiny Kick Counter Dark Mode UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode readability for the main app UI and interactive widget while preserving the current soft card design.

**Architecture:** Add a focused shared theme module that exposes Scripting-standard dynamic shape styles, semantic foreground tokens, rounded background helpers, and shadow helpers. Then update `index.tsx` and `widget.tsx` to consume those tokens instead of hard-coded light rgba/hex backgrounds, without changing business logic or AppIntent behavior.

**Tech Stack:** Scripting TypeScript/TSX, SwiftUI-like components from `scripting`, `DynamicShapeStyle`, semantic `Color` keywords, `Widget.present`, existing AppIntent buttons.

---

## File Structure

- Create: `common/theme.ts`
  - Owns UI-only theme constants and helpers shared by the main app and widget.
  - Exports dynamic style tokens compatible with Scripting `background` and `foregroundStyle`.
  - Does not import model/stat/storage code and does not read runtime `colorScheme`.

- Modify: `index.tsx`
  - Remove local radius/background/shadow constants.
  - Import theme helpers and tokens from `./common/theme`.
  - Replace hard-coded light card backgrounds with dynamic theme backgrounds.
  - Add explicit semantic foreground styles where text currently depends on defaults inside tinted cards.

- Modify: `widget.tsx`
  - Import theme helpers and tokens from `./common/theme`.
  - Replace hard-coded widget card and button backgrounds with dynamic theme backgrounds.
  - Add explicit semantic foreground styles for summary, status, and button text.
  - Preserve current `Widget.family` layout and AppIntent button wiring.

- Test/verify:
  - TypeScript diagnostics for the whole project.
  - `scripting_project` main app run/preview.
  - `scripting_project` widget previews for `systemMedium`; optionally `systemSmall` and `systemLarge`.

---

### Task 1: Create shared dynamic theme module

**Files:**
- Create: `common/theme.ts`

- [ ] **Step 1: Add `common/theme.ts` with Scripting-standard dynamic tokens**

Create `common/theme.ts` with the following content:

```ts
import type { Color, DynamicShapeStyle, ShapeStyle } from "scripting"

export const cardRadius = 22
export const smallCardRadius = 16
export const widgetCardRadius = 14

export type ThemeShapeStyle = ShapeStyle | DynamicShapeStyle

export function roundedBackground(
  style: ThemeShapeStyle,
  radius = cardRadius,
): { style: ThemeShapeStyle; shape: { type: "rect"; cornerRadius: number } } {
  return {
    style,
    shape: { type: "rect", cornerRadius: radius },
  }
}

export function cardShadow() {
  return {
    color: "rgba(0,0,0,0.12)" as Color,
    radius: 12,
    x: 0,
    y: 6,
  }
}

export const themeColors = {
  pageBackground: {
    light: "systemGroupedBackground",
    dark: "systemGroupedBackground",
  } as DynamicShapeStyle,

  heroCardBackground: {
    light: "rgba(255,244,238,0.96)",
    dark: "rgba(48,39,36,0.96)",
  } as DynamicShapeStyle,

  cardBackground: {
    light: "rgba(255,250,247,0.86)",
    dark: "rgba(36,34,33,0.94)",
  } as DynamicShapeStyle,

  groupedCardBackground: {
    light: "rgba(255,255,255,0.56)",
    dark: "rgba(44,44,46,0.78)",
  } as DynamicShapeStyle,

  pillBackground: {
    light: "rgba(255,255,255,0.68)",
    dark: "rgba(58,58,60,0.84)",
  } as DynamicShapeStyle,

  emptyStateBackground: {
    light: "rgba(255,244,238,0.82)",
    dark: "rgba(48,39,36,0.88)",
  } as DynamicShapeStyle,

  activeCycleBackground: {
    light: "rgba(240,253,244,0.92)",
    dark: "rgba(20,83,45,0.34)",
  } as DynamicShapeStyle,

  destructiveBackground: {
    light: "rgba(255,59,48,0.08)",
    dark: "rgba(255,69,58,0.18)",
  } as DynamicShapeStyle,

  widgetNeutralCardBackground: {
    light: "#F4F7FB",
    dark: "rgba(58,58,60,0.86)",
  } as DynamicShapeStyle,

  widgetActiveCardBackground: {
    light: "#EAF5FF",
    dark: "rgba(10,84,140,0.42)",
  } as DynamicShapeStyle,

  primaryButtonBackground: {
    light: "#EAF5FF",
    dark: "rgba(10,132,255,0.24)",
  } as DynamicShapeStyle,

  secondaryButtonBackground: {
    light: "#F2F2F7",
    dark: "rgba(72,72,74,0.88)",
  } as DynamicShapeStyle,

  activeStatusText: {
    light: "#166534",
    dark: "#8FE5A3",
  } as DynamicShapeStyle,

  activeStatusDot: {
    light: "#22C55E",
    dark: "#63D471",
  } as DynamicShapeStyle,

  activeSubtitle: {
    light: "#15803D",
    dark: "#8FE5A3",
  } as DynamicShapeStyle,

  widgetAccentText: {
    light: "#2C7BD0",
    dark: "#8EC5FF",
  } as DynamicShapeStyle,

  label: "label" as Color,
  secondaryLabel: "secondaryLabel" as Color,
  tertiaryLabel: "tertiaryLabel" as Color,
  systemBlue: "systemBlue" as Color,
  systemGreen: "systemGreen" as Color,
  systemRed: "systemRed" as Color,
}
```

- [ ] **Step 2: Run TypeScript diagnostics after creating theme module**

Run diagnostics for the project.

Expected result: no TypeScript diagnostics. If diagnostics report that the `shadow.color` property does not accept a dynamic style, keep `cardShadow().color` as a plain `Color` string such as `"rgba(0,0,0,0.12)" as Color`; do not use `DynamicShapeStyle` for shadow color.

Do not change any UI files in this task.

---

### Task 2: Apply dynamic theme to the main app UI

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Replace local theme constants with shared imports**

In `index.tsx`, replace the import and local constants at the top.

Change:

```ts
import { Cycle, DayCard, FetalMovementState } from "./common/types"
import { formatDayKey, formatMinuteRemaining, formatTime } from "./utils"

const CARD_RADIUS = 22
const SMALL_CARD_RADIUS = 16
const ACTIVE_CYCLE_BACKGROUND = "rgba(240,253,244,0.92)" as Color
const ACTIVE_STATUS_COLOR = "#166534" as Color
const ACTIVE_STATUS_DOT_COLOR = "#22C55E" as Color
const ACTIVE_SUBTITLE_COLOR = "#15803D" as Color

function roundedBackground(style: Color, radius = CARD_RADIUS): { style: Color; shape: { type: "rect"; cornerRadius: number } } {
  return {
    style,
    shape: { type: "rect", cornerRadius: radius },
  }
}

function cardShadow() {
  return {
    color: "rgba(120,72,56,0.10)" as Color,
    radius: 12,
    x: 0,
    y: 6,
  }
}
```

To:

```ts
import { cardShadow, roundedBackground, smallCardRadius, themeColors } from "./common/theme"
import { Cycle, DayCard, FetalMovementState } from "./common/types"
import { formatDayKey, formatMinuteRemaining, formatTime } from "./utils"
```

- [ ] **Step 2: Update record page card backgrounds and foregrounds**

Make these replacements in `index.tsx`:

```ts
background={roundedBackground("rgba(255,244,238,0.96)")}
```

inside `RecordsHeroCard` becomes:

```ts
background={roundedBackground(themeColors.heroCardBackground)}
foregroundStyle={themeColors.label}
```

```ts
background={roundedBackground("rgba(255,255,255,0.68)", SMALL_CARD_RADIUS)}
```

inside `SummaryPill` becomes:

```ts
background={roundedBackground(themeColors.pillBackground, smallCardRadius)}
```

and the value text in `SummaryPill` changes from:

```tsx
<Text font="headline" fontWeight="medium">{value}</Text>
```

to:

```tsx
<Text font="headline" fontWeight="medium" foregroundStyle={themeColors.label}>{value}</Text>
```

```ts
background={roundedBackground(isActive ? ACTIVE_CYCLE_BACKGROUND : "rgba(255,255,255,0.54)", SMALL_CARD_RADIUS)}
```

inside `CycleRow` becomes:

```ts
background={roundedBackground(isActive ? themeColors.activeCycleBackground : themeColors.pillBackground, smallCardRadius)}
```

In `CycleRow`, change status and title foregrounds:

```tsx
<Text font="subheadline" fontWeight="medium">{isActive ? "当前周期" : "计数周期"}</Text>
<Text font="caption" foregroundStyle={ACTIVE_STATUS_DOT_COLOR}>●</Text>
<Text font="caption" foregroundStyle={ACTIVE_STATUS_COLOR}>{status}</Text>
<Text font="subheadline" fontWeight="medium">有效 {cycle.effective_count} 次</Text>
```

To:

```tsx
<Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>{isActive ? "当前周期" : "计数周期"}</Text>
<Text font="caption" foregroundStyle={themeColors.activeStatusDot}>●</Text>
<Text font="caption" foregroundStyle={themeColors.activeStatusText}>{status}</Text>
<Text font="subheadline" fontWeight="medium" foregroundStyle={themeColors.label}>有效 {cycle.effective_count} 次</Text>
```

```ts
background={roundedBackground("rgba(255,250,247,0.86)")}
```

inside `DayCardView` becomes:

```ts
background={roundedBackground(themeColors.cardBackground)}
foregroundStyle={themeColors.label}
```

In `DayCardView`, change:

```tsx
<Text font="caption" foregroundStyle={card.has_active_cycle ? ACTIVE_SUBTITLE_COLOR : "secondaryLabel"}>{card.has_active_cycle ? "● 含正在进行周期" : "已完成计数"}</Text>
```

to:

```tsx
<Text font="caption" foregroundStyle={card.has_active_cycle ? themeColors.activeSubtitle : themeColors.secondaryLabel}>{card.has_active_cycle ? "● 含正在进行周期" : "已完成计数"}</Text>
```

```ts
background={roundedBackground("rgba(255,244,238,0.82)")}
```

inside `EmptyState` becomes:

```ts
background={roundedBackground(themeColors.emptyStateBackground)}
foregroundStyle={themeColors.label}
```

- [ ] **Step 3: Update settings page card backgrounds and destructive row**

In `SettingsActionRow`, change:

```ts
const textColor = destructive ? "red" as Color : "label" as Color
```

To:

```ts
const textColor = destructive ? themeColors.systemRed : themeColors.label
```

Change:

```ts
background={roundedBackground(destructive ? "rgba(255,59,48,0.08)" : "rgba(255,255,255,0.62)", SMALL_CARD_RADIUS)}
```

To:

```ts
background={roundedBackground(destructive ? themeColors.destructiveBackground : themeColors.pillBackground, smallCardRadius)}
```

Change:

```ts
foregroundStyle={destructive ? "red" : "tertiaryLabel"}
```

To:

```ts
foregroundStyle={destructive ? themeColors.systemRed : themeColors.tertiaryLabel}
```

In `SettingsPage`, replace:

```ts
background={roundedBackground("rgba(255,244,238,0.96)")}
```

with:

```ts
background={roundedBackground(themeColors.heroCardBackground)}
foregroundStyle={themeColors.label}
```

Replace each of the three occurrences of:

```ts
background={roundedBackground("rgba(255,255,255,0.56)")}
```

with:

```ts
background={roundedBackground(themeColors.groupedCardBackground)}
foregroundStyle={themeColors.label}
```

- [ ] **Step 4: Add page-level background to tab scroll content**

For both `ScrollView` children in the record tab and settings tab, change the inner container from:

```tsx
<VStack alignment="leading" spacing={14} padding={12}>
```

to:

```tsx
<VStack alignment="leading" spacing={14} padding={12} background={themeColors.pageBackground}>
```

Do this in both tabs. Keep `ScrollView`, `NavigationStack`, and `TabView` unchanged.

- [ ] **Step 5: Run TypeScript diagnostics after main UI changes**

Run diagnostics for the project.

Expected result: no TypeScript diagnostics. If diagnostics report that `foregroundStyle` cannot accept a token, confirm that token is typed as `DynamicShapeStyle` or `Color` in `common/theme.ts` and adjust the token type there rather than inlining colors in `index.tsx`.

---

### Task 3: Apply dynamic theme to the widget UI

**Files:**
- Modify: `widget.tsx`

- [ ] **Step 1: Import shared theme helpers**

At the top of `widget.tsx`, add the theme import after the Scripting import:

```ts
import { roundedBackground, themeColors, widgetCardRadius } from "./common/theme"
```

- [ ] **Step 2: Update summary foreground styles**

In `Summary`, change:

```tsx
<Text font="headline">今日胎动</Text>
<Text font="caption" foregroundStyle="gray">
```

To:

```tsx
<Text font="headline" foregroundStyle={themeColors.label}>今日胎动</Text>
<Text font="caption" foregroundStyle={themeColors.secondaryLabel}>
```

Change:

```tsx
<Text font="caption" foregroundStyle="gray">推算</Text>
<Text font="title">{estimated}</Text>
```

To:

```tsx
<Text font="caption" foregroundStyle={themeColors.secondaryLabel}>推算</Text>
<Text font="title" foregroundStyle={themeColors.label}>{estimated}</Text>
```

- [ ] **Step 3: Update status card backgrounds and foregrounds**

For the no-row state, change:

```ts
background={{ style: "#F4F7FB", shape: { type: "rect", cornerRadius: 14 } }}
```

To:

```ts
background={roundedBackground(themeColors.widgetNeutralCardBackground, widgetCardRadius)}
```

Change the no-row texts from:

```tsx
<Text font="caption" foregroundStyle="#2C7BD0">准备开始</Text>
<Text font="caption" foregroundStyle="gray">点击下方按钮开始 1 小时计数</Text>
```

To:

```tsx
<Text font="caption" foregroundStyle={themeColors.widgetAccentText}>准备开始</Text>
<Text font="caption" foregroundStyle={themeColors.secondaryLabel}>点击下方按钮开始 1 小时计数</Text>
```

For the row state, change:

```ts
background={{ style: row.isActive ? "#EAF5FF" : "#F4F7FB", shape: { type: "rect", cornerRadius: 14 } }}
```

To:

```ts
background={roundedBackground(row.isActive ? themeColors.widgetActiveCardBackground : themeColors.widgetNeutralCardBackground, widgetCardRadius)}
```

Change:

```tsx
<Text font="caption" foregroundStyle="#2C7BD0">{title}</Text>
<Text font="caption" foregroundStyle="#2C7BD0">{trailing}</Text>
<Text font="caption">{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
```

To:

```tsx
<Text font="caption" foregroundStyle={themeColors.widgetAccentText}>{title}</Text>
<Text font="caption" foregroundStyle={themeColors.widgetAccentText}>{trailing}</Text>
<Text font="caption" foregroundStyle={themeColors.label}>{time} · 有效{cycle.effective_count}次 · 点击{cycle.total_count}次</Text>
```

- [ ] **Step 4: Update widget action button backgrounds and foregrounds**

In `ActionButtons`, change the primary button text props from:

```tsx
foregroundStyle="#0A84FF"
frame={{ width: primaryWidth, height: buttonHeight }}
background={{ style: "#EAF5FF", shape: { type: "rect", cornerRadius: buttonHeight / 2 } }}
```

To:

```tsx
foregroundStyle={themeColors.systemBlue}
frame={{ width: primaryWidth, height: buttonHeight }}
background={roundedBackground(themeColors.primaryButtonBackground, buttonHeight / 2)}
```

Change the secondary button text props from:

```tsx
foregroundStyle="#8E8E93"
frame={{ width: secondaryWidth, height: buttonHeight }}
background={{ style: "#F2F2F7", shape: { type: "rect", cornerRadius: buttonHeight / 2 } }}
```

To:

```tsx
foregroundStyle={themeColors.secondaryLabel}
frame={{ width: secondaryWidth, height: buttonHeight }}
background={roundedBackground(themeColors.secondaryButtonBackground, buttonHeight / 2)}
```

- [ ] **Step 5: Set widget root foreground style**

In `WidgetView`, change:

```tsx
return <VStack alignment="leading" spacing={contentSpacing} padding={contentPadding}>
```

To:

```tsx
return <VStack alignment="leading" spacing={contentSpacing} padding={contentPadding} foregroundStyle={themeColors.label}>
```

- [ ] **Step 6: Run TypeScript diagnostics after widget changes**

Run diagnostics for the project.

Expected result: no TypeScript diagnostics. If diagnostics complain about `roundedBackground` return type in widget backgrounds, keep the helper return type in `common/theme.ts` aligned with `ForeAndBackgroundProps.background` by using `ShapeStyle | DynamicShapeStyle` for `style`.

- [ ] **Step 7: Add lifecycle cleanup to widget script if missing**

The Scripting Widget API documentation recommends calling `Script.exit()` at the end of widget scripts. If `widget.tsx` does not already import `Script`, change the first import from:

```ts
import { Button, HStack, Spacer, Text, VStack, Widget, WidgetFamily } from "scripting"
```

to:

```ts
import { Button, HStack, Script, Spacer, Text, VStack, Widget, WidgetFamily } from "scripting"
```

Then append this line immediately after the existing `Widget.present(...)` call:

```ts
Script.exit()
```

Run TypeScript diagnostics again after this change. Expected result: no diagnostics and no change to widget UI or AppIntent behavior.

---

### Task 4: Preview and final verification

**Files:**
- No code changes expected unless previews reveal a low-contrast token.

- [ ] **Step 1: Run full TypeScript diagnostics**

Run full project TypeScript diagnostics.

Expected result: no diagnostics.

- [ ] **Step 2: Preview main app UI**

Run the Scripting project main app preview/run for `index.tsx`.

Expected result:

- The app opens without runtime errors.
- Record tab still shows hero card, daily cards, summary pills, cycle rows, and buttons.
- Settings tab still shows data overview, data management, destructive reset row, and rules.
- Dark mode text is readable on all tinted cards.

- [ ] **Step 3: Preview widget systemMedium**

Run widget preview with family `systemMedium`.

Expected result:

- Widget renders without runtime errors.
- Summary title, secondary text, estimate number, status card, and action buttons are readable in dark mode.
- Existing button labels and intent wiring remain visible.

- [ ] **Step 4: Preview widget systemSmall and systemLarge if supported**

Run widget previews with family `systemSmall` and `systemLarge`.

Expected result:

- Small and large families render without layout-breaking text color regressions.
- Large family still uses larger button sizes and spacer behavior.

- [ ] **Step 5: Make token-only contrast adjustments if preview reveals a problem**

If a preview still shows low contrast, change only the relevant token in `common/theme.ts`. Examples:

```ts
widgetActiveCardBackground: {
  light: "#EAF5FF",
  dark: "rgba(10,84,140,0.56)",
} as DynamicShapeStyle,
```

or:

```ts
cardBackground: {
  light: "rgba(255,250,247,0.86)",
  dark: "rgba(30,30,32,0.96)",
} as DynamicShapeStyle,
```

After any token adjustment, rerun TypeScript diagnostics and the affected preview.

---

### Task 5: Completion review

**Files:**
- Modify only if review finds missed hard-coded light backgrounds in touched UI files.

- [ ] **Step 1: Search for remaining problematic hard-coded light backgrounds**

Search `index.tsx` and `widget.tsx` for these patterns:

```text
rgba(255
#EAF5FF
#F4F7FB
#F2F2F7
#8E8E93
foregroundStyle="gray"
```

Expected result:

- No problematic occurrences remain in `index.tsx` or `widget.tsx` outside `common/theme.ts`.
- Light colors may remain in `common/theme.ts` as the light-mode side of dynamic tokens.

- [ ] **Step 2: Confirm scope was preserved**

Review changes and confirm:

- No changes to `common/model.ts`, `common/stats.ts`, `common/storage.ts`, or `app_intents.tsx`.
- No changes to record/close/reset/export/restore behavior.
- No conversion of `ScrollView` to `List`.
- No hooks added to `widget.tsx`.

- [ ] **Step 3: Run final diagnostics**

Run final TypeScript diagnostics.

Expected result: no diagnostics.

- [ ] **Step 4: Summarize final verification evidence**

Prepare a concise completion note that includes:

- Files changed.
- Diagnostics result.
- Main app preview result.
- Widget preview result for each previewed family.
- Any token-only contrast adjustment made during verification.
