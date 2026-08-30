import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@pomodoro/shared'
import { loginApi, meApi, registerApi, updateProfileApi, type ProfileUpdate } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<UserInfo | null>(null)

  async function login(email: string, password: string) {
    const result = await loginApi(email, password)
    token.value = result.token
    user.value = result.user
    localStorage.setItem('token', result.token)
  }

  async function register(email: string, username: string, password: string) {
    await registerApi(email, username, password)
  }

  async function fetchMe() {
    if (!token.value) return
    user.value = await meApi()
  }

  async function updateProfile(input: ProfileUpdate) {
    user.value = await updateProfileApi(input)
  }

  /** 换主邮箱成功后替换整个会话（服务端已递增 sessionVersion，旧 token 失效） */
  function applySession(newToken: string, nextUser: UserInfo) {
    token.value = newToken
    user.value = nextUser
    localStorage.setItem('token', newToken)
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  return { token, user, login, register, fetchMe, updateProfile, applySession, logout }
})
