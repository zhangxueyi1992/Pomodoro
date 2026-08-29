<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const form = reactive({
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
  soundEnabled: true,
  notificationEnabled: true,
})
const saving = ref(false)

onMounted(async () => {
  if (!settingsStore.loaded) {
    await settingsStore.fetchSettings()
  }
  Object.assign(form, settingsStore.settings)
})

async function onSave() {
  saving.value = true
  try {
    Object.assign(settingsStore.settings, form)
    await settingsStore.saveSettings()
    ElMessage.success('设置已保存')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page settings-page">
    <h2 class="page-title">设置</h2>
    <el-card shadow="never" class="settings-card">
      <template #header>时长设置（分钟）</template>
      <div class="form-grid">
        <div class="field">
          <label>工作时长</label>
          <el-input-number v-model="form.workMinutes" :min="1" :max="120" />
        </div>
        <div class="field">
          <label>短休息时长</label>
          <el-input-number v-model="form.shortBreakMinutes" :min="1" :max="60" />
        </div>
        <div class="field">
          <label>长休息时长</label>
          <el-input-number v-model="form.longBreakMinutes" :min="1" :max="120" />
        </div>
        <div class="field">
          <label>长休息间隔（番茄数）</label>
          <el-input-number v-model="form.longBreakInterval" :min="2" :max="12" />
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="settings-card">
      <template #header>行为设置</template>
      <div class="switch-list">
        <div class="switch-row">
          <div>
            <div class="switch-title">自动开始下一个阶段</div>
            <div class="switch-desc">阶段结束后自动开始倒计时，无需手动点击</div>
          </div>
          <el-switch v-model="form.autoStartNext" />
        </div>
        <div class="switch-row">
          <div>
            <div class="switch-title">提示音</div>
            <div class="switch-desc">阶段结束时播放提示音</div>
          </div>
          <el-switch v-model="form.soundEnabled" />
        </div>
        <div class="switch-row">
          <div>
            <div class="switch-title">浏览器通知</div>
            <div class="switch-desc">阶段结束时弹出系统通知（需授权）</div>
          </div>
          <el-switch v-model="form.notificationEnabled" />
        </div>
      </div>
    </el-card>

    <div class="save-bar">
      <el-button type="primary" size="large" :loading="saving" @click="onSave">保存设置</el-button>
      <span class="save-tip">修改时长后，空闲状态的计时器会自动刷新</span>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 720px;
}

.settings-card {
  margin-bottom: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-size: 13px;
  color: var(--text-secondary);
}

.switch-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.switch-row:last-child {
  border-bottom: none;
}

.switch-title {
  font-size: 14px;
  font-weight: 600;
}

.switch-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
}

.save-tip {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
