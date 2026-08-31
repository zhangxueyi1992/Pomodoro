<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'
import { useAuthStore } from '@/stores/auth'
import { changeEmailApi, confirmChangeEmailApi } from '@/api'
import ProfileEditModal from '@/components/ProfileEditModal.vue'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()
const auth = useAuthStore()

/* 资料修改 */
const profileOpen = ref(false)

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

/* 更换主邮箱 */
const changeOpen = ref(false)
const changeForm = reactive({ newEmail: '', code: '' })
const changeSending = ref(false)
const changeConfirming = ref(false)
const changeCountdown = ref(0)
let changeTicker: ReturnType<typeof setInterval> | null = null

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

onMounted(async () => {
  if (!settingsStore.loaded) {
    await settingsStore.fetchSettings()
  }
  Object.assign(form, settingsStore.settings)
  // 刷新用户信息（主邮箱）
  await auth.fetchMe()
})

onBeforeUnmount(() => {
  if (changeTicker) clearInterval(changeTicker)
})

async function onSave() {
  saving.value = true
  try {
    Object.assign(settingsStore.settings, form)
    await settingsStore.saveSettings()
    timerStore.applySettingsChange()
    ElMessage.success('设置已保存，计时器已按新时长复位')
  } finally {
    saving.value = false
  }
}

/* ---------- 更换主邮箱 ---------- */
async function onSendChangeCode() {
  const e = changeForm.newEmail.trim()
  if (!isEmail(e)) {
    ElMessage.warning('请输入正确的邮箱')
    return
  }
  if (changeCountdown.value > 0) return
  changeSending.value = true
  try {
    await changeEmailApi(e)
    ElMessage.success('验证码已发送到新邮箱，10 分钟内有效')
    changeCountdown.value = 60
    if (changeTicker) clearInterval(changeTicker)
    changeTicker = setInterval(() => {
      changeCountdown.value -= 1
      if (changeCountdown.value <= 0) {
        changeCountdown.value = 0
        if (changeTicker) clearInterval(changeTicker)
      }
    }, 1000)
  } finally {
    changeSending.value = false
  }
}

async function onConfirmChange() {
  const e = changeForm.newEmail.trim()
  if (!isEmail(e)) {
    ElMessage.warning('请输入正确的邮箱')
    return
  }
  if (!/^\d{6}$/.test(changeForm.code)) {
    ElMessage.warning('请输入 6 位验证码')
    return
  }
  changeConfirming.value = true
  try {
    const r = await confirmChangeEmailApi(e, changeForm.code)
    auth.applySession(r.token, r.user)
    changeForm.newEmail = ''
    changeForm.code = ''
    changeOpen.value = false
    ElMessage.success('主邮箱已更换，其他设备已强制下线')
  } finally {
    changeConfirming.value = false
  }
}
</script>

<template>
  <div class="page settings-page">
    <h2 class="page-title">设置</h2>

    <el-card shadow="never" class="settings-card">
      <template #header>账号与邮箱</template>
      <div class="account-block">
        <div class="account-row">
          <div>
            <div class="switch-title">登录邮箱（主邮箱）</div>
            <div class="switch-desc">{{ auth.user?.email ?? '-' }}</div>
          </div>
          <div class="account-actions">
            <el-button link type="primary" @click="profileOpen = true">资料修改</el-button>
            <el-button link type="primary" @click="changeOpen = !changeOpen">
              {{ changeOpen ? '收起' : '更换邮箱' }}
            </el-button>
          </div>
        </div>
        <div v-if="changeOpen" class="inline-form">
          <el-input v-model="changeForm.newEmail" placeholder="新邮箱地址" clearable />
          <div class="code-row">
            <el-input v-model="changeForm.code" maxlength="6" placeholder="6 位验证码" />
            <el-button :loading="changeSending" :disabled="changeCountdown > 0" @click="onSendChangeCode">
              {{ changeCountdown > 0 ? `${changeCountdown}s` : '获取验证码' }}
            </el-button>
          </div>
          <div class="inline-actions">
            <el-button type="primary" :loading="changeConfirming" @click="onConfirmChange">确认更换</el-button>
          </div>
          <div class="inline-tip">验证码将发送至新邮箱；更换成功后所有设备需重新登录</div>
        </div>
      </div>
    </el-card>

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
      <span class="save-tip">保存后立即生效；若计时器正在运行，将停止并复位为新的时长</span>
    </div>

    <ProfileEditModal v-model="profileOpen" />
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

.switch-row,
.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.switch-row:last-child,
.account-row:last-child {
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

.inline-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0 14px;
}

.account-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-row .el-input {
  flex: 1;
}

.inline-actions {
  display: flex;
  justify-content: flex-end;
}

.inline-tip {
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

/* ---------- 移动端适配 ---------- */
@media (max-width: 640px) {
  .account-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .account-actions {
    flex-wrap: wrap;
  }

  .save-bar {
    flex-wrap: wrap;
  }

  .save-tip {
    width: 100%;
  }
}
</style>
