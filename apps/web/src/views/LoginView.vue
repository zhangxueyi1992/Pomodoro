<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const loading = ref(false)

async function onSubmit() {
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
          <el-input v-model="form.email" type="email" placeholder="you@example.com" autocomplete="email" />
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
      <p class="auth-foot">
        还没有账号？
        <router-link to="/register">立即注册</router-link>
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
