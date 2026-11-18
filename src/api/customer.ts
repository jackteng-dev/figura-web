import { clearCsrfToken, getCsrfToken } from '@/api/csrf'
// email／phone／emailVerified 為 V19 新增；舊帳號（只有帳號名稱）可能為 null／false
/** 本人資料：會員 ID、Email、手機與驗證狀態（沒有帳號名稱或暱稱）。 */
export interface CustomerView { id: string; createdAt: string; email: string | null; phone: string | null; emailVerified: boolean }
/** 台灣手機正規化為 09xxxxxxxx，規則與後端 CustomerPayloads.normalizePhone、App identity.dart 相同；不合法回傳 null。 */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[\s\-()]/g, '')
  if (d.startsWith('+886')) d = d.slice(4)
  else if (d.startsWith('886') && d.length === 12) d = d.slice(3)
  if (/^9\d{8}$/.test(d)) d = '0' + d
  return /^09\d{8}$/.test(d) ? d : null
}
export class CustomerApiError extends Error { constructor(public status: number, message: string) { super(message) } }
let refreshing: Promise<boolean> | undefined
async function send(path: string, method: string, body?: unknown, csrfRetry = true): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!['GET','HEAD','OPTIONS'].includes(method)) headers['X-XSRF-TOKEN'] = await getCsrfToken()
  const response = await fetch('/api/customer' + path, { method, credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (response.status === 403 && csrfRetry) {
    const result = await response.clone().json()
    if (result.errorCode === 'CSRF_INVALID') { clearCsrfToken(); return send(path, method, body, false) }
  }
  return response
}
export async function customerRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response = await send(path,method,body)
  if (response.status === 401 && !path.startsWith('/auth/')) {
    refreshing ??= send('/auth/refresh','POST').then(r => r.ok).finally(() => { refreshing = undefined })
    if (await refreshing) response = await send(path,method,body)
  }
  const result = await response.json()
  if (!response.ok || result.code !== 0) throw new CustomerApiError(response.status,result.message || '操作失敗，請稍後再試')
  return result.data as T
}
export const getCustomer = () => customerRequest<CustomerView>('/me')
export const registerCustomer = (data: {email:string;phone:string;password:string}) => customerRequest<CustomerView>('/auth/register','POST',data)
export const verifyEmail = (token: string) => customerRequest<CustomerView>('/auth/email/verify','POST',{token})
export const forgotPassword = (email: string) => customerRequest<void>('/auth/password/forgot','POST',{email})
export const resetPassword = (token: string, password: string) => customerRequest<void>('/auth/password/reset','POST',{token,password})
export const resendVerification = () => customerRequest<void>('/email/verification','POST')
/** 登入：`username` 為後端沿用的欄位名稱，內容是手機或 Email。 */
export const loginCustomer = (data: {username:string;password:string;deviceId:string;rememberMe:boolean}) => customerRequest<CustomerView>('/auth/login','POST',data)
export const logoutCustomer = () => customerRequest<void>('/auth/logout','POST')
