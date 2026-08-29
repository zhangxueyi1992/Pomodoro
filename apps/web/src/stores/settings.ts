import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@pomodoro/shared'
import { DEFAULT_SETTINGS } from '@pomodoro/shared'
import { fetchSettingsApi, updateSettingsApi } from '@/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  async function fetchSettings() {
    settings.value = { ...DEFAULT_SETTINGS, ...(await fetchSettingsApi()) }
    loaded.value = true
  }

  async function saveSettings() {
    settings.value = await updateSettingsApi(settings.value)
  }

  return { settings, loaded, fetchSettings, saveSettings }
})
