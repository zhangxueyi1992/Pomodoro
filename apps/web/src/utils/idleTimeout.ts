import { ElMessage } from 'element-plus'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'

/** 空闲超时阈值（毫秒），默认 30 分钟：超过该时长无任何用户操作则自动退出登录 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

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
