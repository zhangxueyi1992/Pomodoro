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

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  return { token, user, login, register, fetchMe, updateProfile, logout }
})
