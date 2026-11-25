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

// ---- Commerce V2 Phase 7：員工雙因素（TOTP） ----
export interface MfaStatus { available: boolean; enabled: boolean; pendingSetup: boolean }
/** 雙因素第二步：密碼正確後以 challenge＋6 位數驗證碼換取 session。 */
export const adminMfaLogin = (challenge: string, code: string) => request.post('/admin/login/mfa', { challenge, code })
export const mfaStatus = async () => (await request.get<any, { data: MfaStatus }>('/admin/mfa')).data
export const mfaSetup = async () => (await request.post<any, { data: { secret: string; otpauthUri: string } }>('/admin/mfa/setup')).data
export const mfaConfirm = async (code: string) => (await request.post<any, { data: MfaStatus }>('/admin/mfa/confirm', { code })).data
export const mfaDisable = async (code: string) => (await request.post<any, { data: MfaStatus }>('/admin/mfa/disable', { code })).data
