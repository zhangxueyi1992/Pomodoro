import axios, { AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

http.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ code?: string; message?: string }>) => {
    const status = error.response?.status
    const message = error.response?.data?.message ?? '网络请求失败，请稍后重试'
    if (status === 401) {
      const auth = useAuthStore()
      const code = error.response?.data?.code
      auth.logout()
      const revoked = code === 'SESSION_REVOKED'
      if (router.currentRoute.value.name !== 'login') {
        // 强制下线 / 会话过期：清空登录态并跳转登录页
        ElMessage.error(revoked ? '您的账号已在其他设备登录，已被强制下线' : message)
        router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
      } else if (revoked) {
        ElMessage.error('您的账号已在其他设备登录，已被强制下线')
      } else {
        // 已停留在登录页：本次登录凭据错误，直接提示用户
        ElMessage.error(message)
      }
    } else {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  },
)

export default http
