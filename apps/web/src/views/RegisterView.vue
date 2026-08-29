<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ email: '', username: '', password: '', confirm: '' })
const loading = ref(false)

async function onSubmit() {
  if (!form.email || !form.username || !form.password) {
    ElMessage.warning('请完整填写注册信息')
    return
  }
  if (form.password !== form.confirm) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    await auth.register(form.email, form.username, form.password)
    await auth.login(form.email, form.password)
    router.push('/')
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
        <h1 class="auth-title">创建账号</h1>
      </div>
      <p class="auth-sub">开始你的专注之旅</p>
      <el-form label-position="top" size="large" @submit.prevent="onSubmit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" type="email" placeholder="you@example.com" autocomplete="email" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="2-30 个字符" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="form.confirm"
            type="password"
            show-password
            placeholder="再次输入密码"
            autocomplete="new-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" class="auth-submit" :loading="loading">注 册</el-button>
      </el-form>
      <p class="auth-foot">
        已有账号？
        <router-link to="/login">去登录</router-link>
      </p>
    </div>
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
  padding: 36px 36px 24px;
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
  font-size: 24px;
  font-weight: 700;
}

.auth-sub {
  text-align: center;
  color: var(--text-secondary);
  margin: 8px 0 24px;
  font-size: 14px;
}

.auth-submit {
  width: 100%;
  margin-top: 4px;
}

.auth-foot {
  text-align: center;
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.auth-foot a {
  color: var(--work-color);
  text-decoration: none;
  font-weight: 600;
}
</style>
