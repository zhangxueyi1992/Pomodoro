<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleClose } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import ForgotPasswordModal from '@/components/ForgotPasswordModal.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const forgotVisible = ref(false)

// 简单合理的邮箱格式校验
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailError = ref('')

// input 事件触发：持续输入时实时校验；为空时不提示，格式错误时显示红色小字
function validateEmail(): boolean {
  const value = form.email.trim()
  if (!value) {
    emailError.value = ''
    return true
  }
  const ok = EMAIL_RE.test(value)
  emailError.value = ok ? '' : '请输入正确的邮箱地址'
  return ok
}

// 一键清空邮箱输入
function clearEmail() {
  form.email = ''
  validateEmail()
}

async function onSubmit() {
  // 格式不正确：拦截提交
  if (!validateEmail()) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }
  if (!form.email || !form.password) {
    ElMessage.warning('请输入邮箱和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.email, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch {
    /* 错误提示由 axios 拦截器处理 */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="auth-dot" />
        <h1 class="auth-title">番茄时钟</h1>
      </div>
      <p class="auth-sub">专注工作，劳逸结合</p>
      <el-form label-position="top" size="large" @submit.prevent="onSubmit">
        <el-form-item label="邮箱">
          <el-input
            v-model="form.email"
            placeholder="you@example.com"
            autocomplete="email"
            @input="validateEmail"
          >
            <template #suffix>
              <el-icon v-if="form.email" class="email-clear" @click="clearEmail">
                <CircleClose />
              </el-icon>
            </template>
          </el-input>
          <span v-if="emailError" class="email-error">{{ emailError }}</span>
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" class="auth-submit" :loading="loading">登 录</el-button>
      </el-form>
      <div class="forgot-line">
        <el-button link type="primary" @click="forgotVisible = true">忘记密码？</el-button>
      </div>
      <p class="auth-foot">
        还没有账号？
        <router-link to="/register">立即注册</router-link>
      </p>
    </div>
    <ForgotPasswordModal v-model="forgotVisible" :prefill-email="form.email" />
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e74c3c22, #2980b922);
}

.auth-card {
  width: 380px;
  max-width: 92vw;
  background: var(--surface);
  border-radius: 16px;
  padding: 40px 36px 28px;
  box-shadow: var(--shadow);
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
}

.auth-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--work-color);
  box-shadow: 0 0 0 5px rgba(231, 76, 60, 0.15);
}

.auth-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.auth-sub {
  text-align: center;
  color: var(--text-secondary);
  margin: 8px 0 28px;
  font-size: 14px;
}

.auth-submit {
  width: 100%;
  margin-top: 4px;
}

.forgot-line {
  text-align: center;
  margin-top: 12px;
}

.forgot-line .el-button {
  font-size: 13px;
}

.email-error {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: #f56c6c;
}

.email-clear {
  cursor: pointer;
  color: var(--text-secondary);
}

.email-clear:hover {
  color: #f56c6c;
}

.auth-foot {
  text-align: center;
  margin: 18px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.auth-foot a {
  color: var(--work-color);
  text-decoration: none;
  font-weight: 600;
}
</style>
