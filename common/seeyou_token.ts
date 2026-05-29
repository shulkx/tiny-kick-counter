import { SEEYOU_KEYCHAIN_TOKEN_KEY } from "./seeyou_types"

export function getSeeyouToken(): string | null {
  const value = Keychain.get(SEEYOU_KEYCHAIN_TOKEN_KEY)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
  Keychain.remove(SEEYOU_KEYCHAIN_TOKEN_KEY)
}

export function hasSeeyouToken(): boolean {
  return getSeeyouToken() !== null
}
