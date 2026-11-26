import axios from 'axios'
import request from '@/api/api.ts'
import { NO_SANDBOX, normalizeConfig, type SandboxConfig } from '@/utils/sandbox'

/** 沙盒設定：正式環境回 404，這裡安靜地視為「沒有沙盒入口」（不顯示錯誤訊息）。 */
export async function sandboxConfig(): Promise<SandboxConfig> {
  try { return normalizeConfig((await axios.get('/api/sandbox/config', { withCredentials: true, timeout: 5000 })).data) }
  catch { return NO_SANDBOX }
}
/** MFA 展示臨時帳號：帳號、密碼只在這次回應出現一次（只放在頁面記憶體）。 */
export interface MfaDemoAccount { username: string; password: string; expiresAt: string; ttlMinutes: number }
export const createMfaDemoAccount = async () => (await request.post<any, { data: MfaDemoAccount }>('/sandbox/mfa-demo/accounts')).data
