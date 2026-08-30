<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { PASSWORD_HINT, PASSWORD_PATTERN, PASSWORD_PLACEHOLDER } from '@pomodoro/shared'
import { useAuthStore } from '@/stores/auth'
import { forgotPasswordApi, resetPasswordApi } from '@/api'

const props = defineProps<{ modelValue: boolean; prefillEmail?: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  /** 密码重置成功（父弹窗应一并关闭，避免登录后残留打开） */
  (e: 'success'): void
}>()

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const countdown = ref(0)
const sending = ref(false)
const submitting = ref(false)
let ticker: ReturnType<typeof setInterval> | null = null

function reset() {
  email.value = props.prefillEmail ?? auth.user?.email ?? ''
  code.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) reset()
  },
)

function clearTicker() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function close() {
  clearTicker()
  emit('update:modelValue', false)
}

function onDialogValue(v: boolean) {
  emit('update:modelValue', v)
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

async function onSendCode() {
  const e = email.value.trim()
  if (!isEmail(e)) {
    ElMessage.warning('请输入正确的邮箱')
    return
  }
  if (countdown.value > 0) return
  sending.value = true
  try {
    await forgotPasswordApi(e)
    ElMessage.success('验证码已发送到邮箱，10 分钟内有效')
    countdown.value = 60
    clearTicker()
    ticker = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) {
        countdown.value = 0
        clearTicker()
      }
    }, 1000)
  } finally {
    sending.value = false
  }
}

async function onSubmit() {
  const e = email.value.trim()
  if (!isEmail(e)) {
    ElMessage.warning('请输入正确的邮箱')
    return
  }
  if (!/^\d{6}$/.test(code.value)) {
    ElMessage.warning('请输入 6 位验证码')
    return
  }
  if (!PASSWORD_PATTERN.test(newPassword.value)) {
    ElMessage.warning(PASSWORD_HINT)
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  submitting.value = true
  try {
    await resetPasswordApi(e, code.value, newPassword.value)
    emit('success')
    close()
    ElMessage.success('密码已重置，请重新登录')
    auth.logout()
    router.push({ name: 'login' })
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(clearTicker)
</script>

<template>
  <el-dialog :model-value="modelValue" title="忘记密码" width="440px" @update:model-value="onDialogValue">
    <el-form label-position="top">
      <el-form-item label="账号邮箱">
        <el-input v-model="email" placeholder="请输入注册邮箱" />
        <div class="email-tip">验证码将发送至该邮箱</div>
      </el-form-item>
      <el-form-item label="验证码">
        <div class="code-row">
          <el-input v-model="code" maxlength="6" placeholder="6 位数字验证码" />
          <el-button :loading="sending" :disabled="countdown > 0" @click="onSendCode">
            {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="newPassword" type="password" show-password :placeholder="PASSWORD_PLACEHOLDER" />
      </el-form-item>
      <el-form-item label="确认新密码">
        <el-input v-model="confirmPassword" type="password" show-password placeholder="再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">重置密码</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-row .el-input {
  flex: 1;
}

.email-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
