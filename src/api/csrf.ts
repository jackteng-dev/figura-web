let token: Promise<string> | undefined
export function clearCsrfToken() { token = undefined }
export function getCsrfToken(): Promise<string> {
  if (!token) token = fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(async response => {
    const result = await response.json()
    if (!response.ok || result.code !== 0 || !result.data?.token) throw new Error('無法取得操作驗證')
    return result.data.token as string
  }).catch(error => { token = undefined; throw error })
  return token
}
export async function refreshSession(): Promise<boolean> {
  const send = async () => fetch('/api/auth/refresh', {
    method: 'POST', credentials: 'same-origin', headers: { 'X-XSRF-TOKEN': await getCsrfToken() }
  })
  let response = await send()
  let result = await response.json()
  if (response.status === 403 && result.errorCode === 'CSRF_INVALID') {
    clearCsrfToken(); response = await send(); result = await response.json()
  }
  return response.ok && result.code === 0
}
