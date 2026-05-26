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
