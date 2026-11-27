// 公開沙盒的前端顯示邏輯（純函式，方便單元測試）。安全由 API 保證：這裡只決定「顯示什麼」，不決定「能做什麼」。
export type AccountKind = 'STAFF' | 'SANDBOX_SHARED' | 'SANDBOX_MFA_DEMO'
export interface SandboxConfig { quickDemo: boolean; mfaDemo: boolean; mfaDemoTtlMinutes?: number | null }
/** 正式環境（設定端點 404 或任何錯誤）一律視為沒有沙盒入口。 */
export const NO_SANDBOX: SandboxConfig = Object.freeze({ quickDemo: false, mfaDemo: false })

/** 只接受布林 true；其他型別（字串 "true"、數字）都不算，避免意外顯示入口。 */
export function normalizeConfig(raw: unknown): SandboxConfig {
  const d = (raw as { data?: unknown } | null)?.data as Partial<SandboxConfig> | undefined
  if (!d || typeof d !== 'object') return NO_SANDBOX
  const ttl = typeof d.mfaDemoTtlMinutes === 'number' && d.mfaDemoTtlMinutes > 0 ? d.mfaDemoTtlMinutes : null
  return { quickDemo: d.quickDemo === true, mfaDemo: d.mfaDemo === true, mfaDemoTtlMinutes: ttl }
}
export const hasSandboxEntries = (c: SandboxConfig) => c.quickDemo || c.mfaDemo

export function accountKind(raw: unknown): AccountKind {
  return raw === 'SANDBOX_SHARED' || raw === 'SANDBOX_MFA_DEMO' ? raw : 'STAFF'
}
/** 帳號安全頁：共用展示帳號隱藏所有安全設定操作。 */
export function securityView(kind: AccountKind) {
  return {
    canManage: kind !== 'SANDBOX_SHARED',
    sharedNotice: kind === 'SANDBOX_SHARED',
    showCountdown: kind === 'SANDBOX_MFA_DEMO',
  }
}
/** 剩餘時間（mm:ss 或 h:mm:ss）；已到期回傳 null。 */
export function remaining(expiresAt: string | undefined | null, now: number): string | null {
  if (!expiresAt) return null
  const end = Date.parse(expiresAt)
  if (Number.isNaN(end)) return null
  let s = Math.floor((end - now) / 1000)
  if (s <= 0) return null
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
