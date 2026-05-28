export function pad(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

export function formatLocal(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatDayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatMinuteRemaining(nowTs: number, endTs: number): string {
  const remainingMs = Math.max(0, endTs - nowTs)
  return String(Math.ceil(remainingMs / 60000))
}

export function formatChineseDateFromDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number)
  return `${year}年${month}月${day}日`
}
