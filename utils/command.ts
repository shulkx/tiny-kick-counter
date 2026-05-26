import { Command, CommandInput, FUTURE_TOLERANCE_MS, Source } from "../common/types"

export function isValidEventTs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function normalizeSource(value: unknown): Source {
  if (value === "shortcut" || value === "widget" || value === "app" || value === "unknown") {
    return value
  }
  return "unknown"
}

export function normalizeCommand(value: unknown): Command {
  if (value === "close_cycle" || value === "status" || value === "export" || value === "reset") {
    return value
  }
  return "record"
}

export function parseCommandParameter(raw: unknown, nowTs = Date.now()): CommandInput {
  let warning: string | undefined
  let command: Command = "record"
  let event_ts = nowTs
  let source: Source = "unknown"

  const rawValue = typeof raw === "object" && raw !== null && "value" in raw
    ? (raw as { value: unknown }).value
    : raw

  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue) as Record<string, unknown>
      command = normalizeCommand(parsed.command)
      source = normalizeSource(parsed.source)
      if (isValidEventTs(parsed.event_ts)) {
        event_ts = parsed.event_ts
      } else {
        warning = "event_ts 缺失或非法，已使用当前时间。"
      }
    } catch {
      command = normalizeCommand(rawValue.trim())
      warning = "参数不是 JSON，已按纯文本命令处理。"
    }
  } else if (typeof rawValue === "object" && rawValue !== null) {
    const parsed = rawValue as Record<string, unknown>
    command = normalizeCommand(parsed.command)
    source = normalizeSource(parsed.source)
    if (isValidEventTs(parsed.event_ts)) {
      event_ts = parsed.event_ts
    } else {
      warning = "event_ts 缺失或非法，已使用当前时间。"
    }
  } else if (rawValue != null) {
    warning = "参数类型无法识别，已按 record 处理。"
  }

  return { command, event_ts, source, warning }
}

export function isFutureRejected(eventTs: number, nowTs = Date.now()): boolean {
  return eventTs > nowTs + FUTURE_TOLERANCE_MS
}
