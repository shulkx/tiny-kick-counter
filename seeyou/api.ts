import {
  SEEYOU_API_URL,
  SEEYOU_FETCH_TIMEOUT_S,
  SeeyouApiResponse,
  SeeyouFetchResult,
} from "./types"

const QUERY_PARAMS: Record<string, string> = {
  app_id: "01",
  channelID: "AppStore",
  lang: "zh",
  mode: "1",
  platform: "ios",
  scale: "3.0",
  themeid: "0",
  v: "9.0.6",
  v1: "9.06.0.0",
  start: "0",
}

const STATIC_HEADERS: Record<string, string> = {
  appid: "01",
  scale: "3.0",
  accept: "*/*",
  buildv: "9.06.0.6",
  source: "SYCalendarViewController->IMYToolsMainFMCountingVC",
  "accept-language": "zh-Hans-CN;q=1, en-CN;q=0.9",
  myclient: "0120906000000000",
  myappinfo: "01-2-9.06.0.0-0000-0",
  "user-agent": "Seeyou/9.06.0 (iPhone; iOS 26.5; Scale/3.00)",
  sv: "KK77",
}

function buildUrl(): string {
  const qs = Object.keys(QUERY_PARAMS)
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(QUERY_PARAMS[k]))
    .join("&")
  return SEEYOU_API_URL + "?" + qs
}

function isValidListItem(item: unknown): boolean {
  if (!item || typeof item !== "object") return false
  const r = item as { id?: unknown; start_time?: unknown }
  return typeof r.id === "number" && typeof r.start_time === "number"
}

function isResponseShape(value: unknown): value is SeeyouApiResponse {
  if (!Array.isArray(value)) return false
  return value.every(group => {
    if (!group || typeof group !== "object") return false
    const g = group as { date?: unknown; list?: unknown }
    return typeof g.date === "number" && Array.isArray(g.list) && g.list.every(isValidListItem)
  })
}

export async function fetchSeeyouFetal(token: string): Promise<SeeyouFetchResult> {
  const url = buildUrl()
  const headers: Record<string, string> = { ...STATIC_HEADERS, authorization: token }

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      timeout: SEEYOU_FETCH_TIMEOUT_S,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: "network_error", message }
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: "token_invalid", message: `HTTP ${response.status}` }
  }
  if (!response.ok) {
    return { kind: "network_error", message: `HTTP ${response.status}` }
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: "parse_error", message }
  }

  if (!isResponseShape(parsed)) {
    return { kind: "parse_error", message: "返回结构与预期不符" }
  }

  return { kind: "ok", data: parsed }
}
