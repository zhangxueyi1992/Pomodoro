<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import ProfileEditModal from '@/components/ProfileEditModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const settingsStore = useSettingsStore()
const tasksStore = useTasksStore()
const timer = useTimerStore()

const isPublic = computed(() => route.meta.public === true)
const isDark = ref(localStorage.getItem('pomodoro.dark') === '1')
const showProfile = ref(false)

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

function toggleDark() {
  isDark.value = !isDark.value
  applyDark(isDark.value)
  localStorage.setItem('pomodoro.dark', isDark.value ? '1' : '0')
}

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}

/** 初始化应用数据：拉取用户信息、设置与任务列表 */
async function initApp() {
  try {
    await auth.fetchMe()
    await Promise.all([settingsStore.fetchSettings(), tasksStore.loadTasks()])
    timer.restoreIfNeeded()
    timer.requestPermission()
  } catch {
    /* 401 由 axios 拦截器统一处理 */
  }
}

onMounted(() => {
  applyDark(isDark.value)
  // 刷新页面场景：token 已在 localStorage，直接初始化
  if (auth.token) initApp()
})

// 页面内完成登录场景：token 从无到有，同样初始化，
// 否则登录后首次进入任务/统计页会是空数据
watch(
  () => auth.token,
  (token) => {
    if (token) initApp()
  },
)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <template v-if="!isPublic">
      <header class="topbar">
        <div class="brand">
          <span class="brand-dot" />
          <span class="brand-name">番茄时钟</span>
        </div>
        <nav class="nav">
          <router-link to="/" class="nav-link" :class="{ active: route.name === 'timer' }">计时器</router-link>
          <router-link to="/tasks" class="nav-link" :class="{ active: route.name === 'tasks' }">任务</router-link>
          <router-link to="/stats" class="nav-link" :class="{ active: route.name === 'stats' }">统计</router-link>
          <router-link to="/settings" class="nav-link" :class="{ active: route.name === 'settings' }">设置</router-link>
        </nav>
        <div class="topbar-right">
          <button class="theme-btn" :title="isDark ? '切换到亮色模式' : '切换到深色模式'" @click="toggleDark">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
          <span v-if="auth.user" class="username" title="点击修改昵称 / 密码" @click="showProfile = true">
            {{ auth.user.username }}
          </span>
          <el-button link type="danger" @click="logout">退出</el-button>
        </div>
      </header>
      <main class="content">
        <router-view />
      </main>
      <ProfileEditModal v-model="showProfile" />
    </template>
    <router-view v-else />
  </el-config-provider>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 24px;
  height: 56px;
  padding: 0 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
}

.brand-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--work-color);
  box-shadow: 0 0 0 4px rgba(231, 76, 60, 0.15);
}

.nav {
  display: flex;
  gap: 4px;
  flex: 1;
}

.nav-link {
  padding: 6px 14px;
  border-radius: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--text);
  background: var(--bg);
}

.nav-link.active {
  color: var(--work-color);
  background: rgba(231, 76, 60, 0.1);
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-btn {
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.theme-btn:hover {
  background: var(--bg);
}

.username {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.content {
  min-height: calc(100vh - 56px);
}
</style>
