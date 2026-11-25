import request from '@/api/api.ts'
import type { UserInfo } from '@/types/user'
//登入
import type { LoginData } from '@/types/user.ts'
export const adminLoginService = function (loginData: LoginData) {
  const params = new URLSearchParams();
  params.append('username', loginData.username);
  params.append('password', loginData.password);
  params.append('rememberMe', loginData.rememberMe + "");
  params.append('deviceId', loginData.deviceId + "");
  return request.post('/admin/login', params);
}

//登出
export function adminLogoutService() {
  return request.post('/admin/logout');
}

//驗證是否登入
export function getUserInfoService() {
  return request.get('/auth/me');
}

//驗證是否登入
export function getBackendUser(username: string) {
  return request.get(`/admin/user/${username}`);
}

//更新用戶訊息
export const userInfoUpdateService = function (userInfoData: UserInfo) {
  return request.put('/admin/user/update', userInfoData)
}

//更新用戶頭像
export const userAvatarUpdateService = function (formData: FormData) {
  // const params = new URLSearchParams();
  // params.append('avatarUrl',avatarUrl)
  return request.patch('/upload/userAvatar', formData, {
      headers: {
          'Content-Type': 'multipart/form-data'
      }
  }
  )
}

// ---- 員工後台強制雙因素（TOTP）：未綁定者密碼正確後必須先綁定，完成前不發 session ----
export interface MfaStatus { available: boolean; enabled: boolean; backupCodesRemaining: number; backupAckPending: boolean; backupCodesRequired: boolean }
/** 新產生的備援碼：只在這次回應出現；伺服器只保存雜湊。 */
export interface BackupCodes { codes: string[]; username: string; generatedAt: string; required: boolean; batchId: string }
/** 已綁定：以 challenge＋6 位數驗證碼（或一次性備援碼）換取 session。 */
export const adminMfaLogin = (challenge: string, code: string) => request.post('/admin/login/mfa', { challenge, code })
/** 未綁定：以綁定 token 產生密鑰（重新呼叫會換一組）。 */
export const adminMfaSetup = async (setupToken: string) => (await request.post<any, { data: { secret: string; otpauthUri: string } }>('/admin/login/mfa/setup', { setupToken })).data
/** 未綁定：驗證碼正確後完成綁定並發 session，回傳只顯示一次的備援碼。 */
export const adminMfaEnroll = async (setupToken: string, code: string) => (await request.post<any, { data: { username?: string; backupCodes?: string[]; backupCodesRequired?: boolean; backupCodesGeneratedAt?: string; backupBatchId?: string } }>('/admin/login/mfa/enroll', { setupToken, code })).data
export const mfaStatus = async () => (await request.get<any, { data: MfaStatus }>('/admin/mfa')).data
export const mfaRegenerateBackupCodes = async (code: string) => (await request.post<any, { data: BackupCodes }>('/admin/mfa/backup-codes', { code })).data
/** 備援碼保存確認：downloaded＝頁面已觸發下載；confirmed＝使用者勾選已保存（伺服器無法驗證檔案確實保存）。 */
export const mfaBackupAck = async (batchId: string, downloaded: boolean, confirmed: boolean) => (await request.post<any, { data: MfaStatus }>('/admin/mfa/backup-codes/ack', { batchId, downloaded, confirmed })).data
/** 管理員重設其他員工的雙因素（對方 session 立即失效，下次登入重新綁定）。 */
export const staffMfaReset = async (staffId: number, note: string, requestId: string) => (await request.post<any, { data: { staffId: number; replayed: boolean } }>(`/admin/access/staff/${staffId}/mfa/reset`, { requestId, note })).data
