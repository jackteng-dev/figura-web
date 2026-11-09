import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { clearCsrfToken, getCsrfToken, refreshSession } from '@/api/csrf'

const instance = axios.create({ baseURL: '/api', withCredentials: true })
let refreshing: Promise<boolean> | undefined
instance.interceptors.request.use(async config => {
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase()))
    config.headers.set('X-XSRF-TOKEN', await getCsrfToken())
  return config
})
instance.interceptors.response.use(response => {
  if (response.data.code === 0) {
    if (['/admin/login', '/admin/logout'].includes(response.config.url || '')) clearCsrfToken()
    return response.data
  }
  ElMessage.error(response.data.message || '操作失敗')
  return Promise.reject(response.data)
}, async error => {
  const config = error.config
  if (config && error.response?.status === 403 && error.response?.data?.errorCode === 'CSRF_INVALID' && !config._csrfRetry) {
    config._csrfRetry = true; clearCsrfToken(); return instance(config)
  }
  const sessionEndpoint = ['/admin/login', '/admin/logout', '/auth/refresh'].includes(config?.url)
  if (config && error.response?.status === 401 && !sessionEndpoint && !config._retry) {
    config._retry = true
    try {
      refreshing ??= refreshSession().finally(() => { refreshing = undefined })
      if (await refreshing) return instance(config)
    } catch { /* 服務故障交由下方顯示。 */ }
  }
  ElMessage.error(error.response?.data?.message || '服務暫時無法使用')
  if (error.response?.status === 401 && !sessionEndpoint) {
    const { useUserInfoStore } = await import('@/stores/userInfo')
    useUserInfoStore().removeInfo()
    if (router.currentRoute.value.path !== '/admin/login') await router.push('/admin/login')
  }
  return Promise.reject(error)
})
export default instance
