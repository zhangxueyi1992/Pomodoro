import { ElMessage } from 'element-plus'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'

/** 空闲超时阈值（毫秒），默认 30 分钟：超过该时长无任何用户操作则自动退出登录 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** 勾选“下次自动登录”时的空闲超时阈值：7 天 */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** localStorage 中保存空闲超时时长（毫秒，字符串）的键名 */
export const IDLE_MS_KEY = 'pomodoro.idleMs'

/** 读取空闲超时时长：优先取 localStorage 中保存的值，无效则回退默认 30 分钟 */
export function readIdleMs(): number {
  const raw = localStorage.getItem(IDLE_MS_KEY)
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return IDLE_TIMEOUT_MS
}

/** 当前空闲检测实例的停止函数（供 restartIdleTimeout 复用） */
let stopCurrent: (() => void) | undefined

/** 以 localStorage 中保存的最新时长（重新）启动空闲检测；登录勾选状态变化后调用即可立即生效 */
export function restartIdleTimeout(): void {
  stopCurrent?.()
  stopCurrent = startIdleTimeout(readIdleMs())
}

/** 停止当前空闲检测（应用卸载时调用） */
export function stopIdleTimeout(): void {
  stopCurrent?.()
  stopCurrent = undefined
}

/** 视为“用户操作”的浏览器事件，任一触发都会重置空闲计时 */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

/**
 * 启动全局空闲检测：超过 idleMs 无任何用户操作 → 暂停计时器并登出跳转登录页。
 * 返回停止函数（组件卸载时调用）。
 */
export function startIdleTimeout(idleMs: number = IDLE_TIMEOUT_MS): () => void {
  const auth = useAuthStore()
  const timer = useTimerStore()

  let timerId: number | undefined

  function onIdle() {
    if (!auth.token) return
    // 倒计时进行中先暂停，避免人离开后番茄自动结束并被记录
    if (timer.isRunning) timer.pause()
    auth.logout()
    ElMessage.warning('长时间未操作，已自动退出登录')
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  }

  function schedule() {
    if (timerId != null) window.clearTimeout(timerId)
    timerId = window.setTimeout(onIdle, idleMs)
  }

  schedule()
  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, schedule, { passive: true })
  }

  return () => {
    if (timerId != null) window.clearTimeout(timerId)
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, schedule)
    }
  }
}
