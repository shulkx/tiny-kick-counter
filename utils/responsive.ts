import { Widget } from "scripting"

const vmin = (n: number) => {
  const { width, height } = Widget.displaySize
  return (n * Math.min(width, height, 155)) / 100
}

export const rpt = (n: number) => vmin((n * 100) / 155)
