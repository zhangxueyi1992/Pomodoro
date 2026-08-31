<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const settingsStore = useSettingsStore()
const tasksStore = useTasksStore()
const timer = useTimerStore()

const isPublic = computed(() => route.meta.public === true)
const isDark = ref(localStorage.getItem('pomodoro.dark') === '1')
/** 移动端折叠菜单开关 */
const menuOpen = ref(false)

// 路由变化（含链接点击、退出登录）时收起折叠菜单
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

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
  window.addEventListener('resize', onViewportChange)
  // 刷新页面场景：token 已在 localStorage，直接初始化
  if (auth.token) initApp()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange)
})

/** 窗口拉宽到桌面尺寸时，自动收起折叠菜单 */
function onViewportChange() {
  if (window.innerWidth > 768) menuOpen.value = false
}

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
      <header class="topbar" :class="{ open: menuOpen }">
        <div class="brand">
          <span class="brand-dot" />
          <span class="brand-name">番茄时钟</span>
        </div>
        <nav class="nav" aria-label="主导航">
          <router-link to="/" class="nav-link" :class="{ active: route.name === 'timer' }" @click="menuOpen = false">计时器</router-link>
          <router-link to="/tasks" class="nav-link" :class="{ active: route.name === 'tasks' }" @click="menuOpen = false">任务</router-link>
          <router-link to="/stats" class="nav-link" :class="{ active: route.name === 'stats' }" @click="menuOpen = false">统计</router-link>
          <router-link to="/settings" class="nav-link" :class="{ active: route.name === 'settings' }" @click="menuOpen = false">设置</router-link>
          <div class="mobile-account">
            <span v-if="auth.user" class="username">{{ auth.user.username }}</span>
            <el-button link type="danger" size="small" @click="logout">退出登录</el-button>
          </div>
        </nav>
        <div class="topbar-right">
          <button class="theme-btn" :title="isDark ? '切换到亮色模式' : '切换到深色模式'" @click="toggleDark">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
          <span v-if="auth.user" class="username desktop-only">{{ auth.user.username }}</span>
          <el-button link type="danger" class="desktop-only" @click="logout">退出</el-button>
          <button
            class="menu-btn"
            :class="{ active: menuOpen }"
            :aria-expanded="menuOpen"
            aria-label="切换菜单"
            @click="menuOpen = !menuOpen"
          >
            <span class="menu-icon" :class="{ open: menuOpen }"><i /><i /><i /></span>
          </button>
        </div>
        <div v-if="menuOpen" class="menu-backdrop" @click="menuOpen = false" />
      </header>
      <main class="content">
        <router-view />
      </main>
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
  flex-shrink: 0;
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
  white-space: nowrap;
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
  flex-shrink: 0;
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
}

.content {
  min-height: calc(100vh - 56px);
}

/* 汉堡按钮（默认隐藏，移动端显示） */
.menu-btn {
  display: none;
  border: none;
  background: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  align-items: center;
  justify-content: center;
}

.menu-btn:hover {
  background: var(--bg);
}

.menu-icon {
  display: flex;
  flex-direction: column;
}

.menu-icon i {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--text);
  border-radius: 2px;
  margin: 3px 0;
  transition: transform 0.25s, opacity 0.25s;
}

.menu-icon.open i:nth-child(1) {
  transform: translateY(5px) rotate(45deg);
}

.menu-icon.open i:nth-child(2) {
  opacity: 0;
}

.menu-icon.open i:nth-child(3) {
  transform: translateY(-5px) rotate(-45deg);
}

/* 菜单遮罩（点击关闭），仅在移动端菜单展开时渲染 */
.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
}

.mobile-account {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding: 12px 4px 4px;
  border-top: 1px solid var(--border);
}

/* ---------- 移动端（≤768px）：折叠式导航 ---------- */
@media (max-width: 768px) {
  .topbar {
    gap: 8px;
    padding: 0 12px;
  }

  .brand-name {
    font-size: 15px;
  }

  .nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    padding: 8px 12px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow);
  }

  .topbar.open .nav {
    display: flex;
  }

  .nav-link {
    padding: 11px 12px;
    border-radius: 8px;
    font-size: 15px;
  }

  .menu-btn {
    display: flex;
  }

  .desktop-only {
    display: none;
  }

  .mobile-account {
    display: flex;
  }
}
</style>
