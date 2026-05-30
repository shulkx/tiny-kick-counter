import { SEEYOU_KEYCHAIN_TOKEN_KEY } from "./types"

export function getSeeyouToken(): string | null {
  try {
    const value = Keychain.get(SEEYOU_KEYCHAIN_TOKEN_KEY)
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export function setSeeyouToken(token: string): void {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    clearSeeyouToken()
    return
  }
  Keychain.set(SEEYOU_KEYCHAIN_TOKEN_KEY, trimmed)
}

export function clearSeeyouToken(): void {
  try { Keychain.remove(SEEYOU_KEYCHAIN_TOKEN_KEY) } catch { /* key may not exist */ }
}

export function hasSeeyouToken(): boolean {
  return getSeeyouToken() !== null
}
