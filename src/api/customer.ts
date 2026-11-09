import { clearCsrfToken, getCsrfToken } from '@/api/csrf'
export interface CustomerView { id: string; username: string; displayName: string; createdAt: string }
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
export const updateCustomer = (displayName: string) => customerRequest<CustomerView>('/me','PATCH',{displayName})
export const registerCustomer = (data: {username:string;password:string;displayName:string}) => customerRequest<CustomerView>('/auth/register','POST',data)
export const loginCustomer = (data: {username:string;password:string;deviceId:string;rememberMe:boolean}) => customerRequest<CustomerView>('/auth/login','POST',data)
export const logoutCustomer = () => customerRequest<void>('/auth/logout','POST')
