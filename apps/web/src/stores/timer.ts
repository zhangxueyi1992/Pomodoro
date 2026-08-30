import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { SessionType, TimerMode, TimerStatus } from '@pomodoro/shared'
import { createSessionApi } from '@/api'
import { useSettingsStore } from '@/stores/settings'
import { useTasksStore } from '@/stores/tasks'
import { alertModeFinished, requestNotificationPermission } from '@/utils/notify'
import { formatSeconds } from '@/utils/format'
import { nextModeAfterBreak, nextModeAfterCompletedWork } from '@/utils/pomodoro'

const STORAGE_KEY = 'pomodoro.timer.v1'

interface PersistedState {
  mode: TimerMode
  status: TimerStatus
  sessionStartedAt: number | null
  pausedElapsedSeconds: number
  completedInCycle: number
  currentTaskId: number | null
  plannedDurationSeconds: number
}

function loadPersisted(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

export const useTimerStore = defineStore('timer', () => {
  const settingsStore = useSettingsStore()
  const tasksStore = useTasksStore()
  const saved = loadPersisted()

  const mode = ref<TimerMode>(saved?.mode ?? 'work')
  const status = ref<TimerStatus>(saved?.status ?? 'idle')
  const sessionStartedAt = ref<number | null>(saved?.sessionStartedAt ?? null)
  const pausedElapsedSeconds = ref(saved?.pausedElapsedSeconds ?? 0)
  const completedInCycle = ref(saved?.completedInCycle ?? 0)
  const currentTaskId = ref<number | null>(saved?.currentTaskId ?? null)
  const plannedDurationSeconds = ref(saved?.plannedDurationSeconds ?? 0)
  const remainingSeconds = ref(0)

  let ticker: ReturnType<typeof setInterval> | null = null

  const isRunning = computed(() => status.value === 'running')

  /** 依据设置计算某模式的完整时长（秒） */
  function durationFor(m: TimerMode): number {
    const s = settingsStore.settings
    switch (m) {
      case 'work':
        return s.workMinutes * 60
      case 'shortBreak':
        return s.shortBreakMinutes * 60
      case 'longBreak':
        return s.longBreakMinutes * 60
    }
  }

  /** 已流逝秒数（基于时间戳差值，规避 setInterval 漂移与后台节流） */
  function elapsedSeconds(): number {
    if (sessionStartedAt.value == null) return pausedElapsedSeconds.value
    return (Date.now() - sessionStartedAt.value) / 1000 + pausedElapsedSeconds.value
  }

  function refreshRemaining() {
    const total = plannedDurationSeconds.value || durationFor(mode.value)
    remainingSeconds.value = Math.max(0, total - elapsedSeconds())
  }

  function startTicker() {
    if (ticker) return
    ticker = setInterval(() => {
      if (status.value !== 'running') return
      refreshRemaining()
      if (remainingSeconds.value <= 0) {
        void completeSession()
      }
    }, 250)
  }

  function stopTicker() {
    if (ticker) {
      clearInterval(ticker)
      ticker = null
    }
  }

  function persist() {
    const data: PersistedState = {
      mode: mode.value,
      status: status.value,
      sessionStartedAt: sessionStartedAt.value,
      pausedElapsedSeconds: pausedElapsedSeconds.value,
      completedInCycle: completedInCycle.value,
      currentTaskId: currentTaskId.value,
      plannedDurationSeconds: plannedDurationSeconds.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function switchMode(m: TimerMode) {
    mode.value = m
    stopTicker()
    status.value = 'idle'
    sessionStartedAt.value = null
    pausedElapsedSeconds.value = 0
    plannedDurationSeconds.value = 0
    remainingSeconds.value = durationFor(m)
    persist()
    // 离开工作阶段（进入短/长休息）时，结束「进行中」标记
    if (m !== 'work') void clearDoing()
  }

  function start() {
    if (status.value === 'running') return
    if (status.value === 'idle') {
      plannedDurationSeconds.value = durationFor(mode.value)
      sessionStartedAt.value = Date.now()
      pausedElapsedSeconds.value = 0
    } else {
      sessionStartedAt.value = Date.now()
    }
    status.value = 'running'
    refreshRemaining()
    startTicker()
    persist()
    // 在工作阶段开始倒计时且选中了任务 → 标记该任务为「进行中」。
    // 覆盖「从任务页设为进行中」之外的场景（计时器页下拉选任务后点「开始」）。
    if (mode.value === 'work' && currentTaskId.value != null) {
      markDoing(currentTaskId.value)
    }
  }

  function pause() {
    if (status.value !== 'running') return
    pausedElapsedSeconds.value = elapsedSeconds()
    sessionStartedAt.value = null
    status.value = 'paused'
    refreshRemaining()
    stopTicker()
    persist()
  }

  function reset() {
    stopTicker()
    status.value = 'idle'
    sessionStartedAt.value = null
    pausedElapsedSeconds.value = 0
    plannedDurationSeconds.value = 0
    remainingSeconds.value = durationFor(mode.value)
    persist()
    // 重置计时 = 放弃本次专注，结束「进行中」标记
    void clearDoing()
  }

  /**
   * 时长设置变更后调用：停止当前计时并复原为当前模式的「新」时长。
   * durationFor 读取的是最新设置，故运行中/暂停中的计时都会被停止并复位到新时长，
   * 保证回到计时器页无需刷新即可看到修改后的分钟数。
   */
  function applySettingsChange() {
    reset()
  }

  /**
   * 把所有「进行中」任务还原为待办（去掉进行中标签、恢复「设为进行中」按钮）。
   * 用于退出专注/切换当前专注任务等场景。
   */
  async function clearDoing() {
    const doing = tasksStore.tasks.filter((t) => t.status === 'DOING')
    if (doing.length === 0) return
    try {
      await Promise.all(doing.map((t) => tasksStore.updateTask(t.id, { status: 'TODO' })))
    } catch {
      /* 状态同步失败不阻塞计时流程 */
    }
  }

  /** 把指定任务标记为「进行中」（幂等：已是 DOING 或 DONE 则跳过） */
  function markDoing(taskId: number) {
    const t = tasksStore.tasks.find((x) => x.id === taskId)
    if (t && t.status !== 'DONE' && t.status !== 'DOING') {
      void tasksStore.updateTask(taskId, { status: 'DOING' })
    }
  }

  /** 任务是否为「当前专注」且正在工作倒计时/暂停中（即正在被计时器占用；休息阶段与任务无关，不算） */
  function isTaskActive(taskId: number): boolean {
    return mode.value === 'work' && currentTaskId.value === taskId && status.value !== 'idle'
  }

  /**
   * 把任务设为「进行中」并立即开始一个工作番茄：
   * 复位到工作阶段（停止其它阶段、防止正在倒计时）、选中当前专注任务、
   * 标记为进行中、开始倒计时。
   */
  async function startFocus(taskId: number) {
    await clearDoing()
    // 强制切回工作并复位其它阶段
    mode.value = 'work'
    stopTicker()
    status.value = 'idle'
    sessionStartedAt.value = null
    pausedElapsedSeconds.value = 0
    plannedDurationSeconds.value = 0
    currentTaskId.value = taskId
    remainingSeconds.value = durationFor('work')
    persist()
    try {
      await tasksStore.updateTask(taskId, { status: 'DOING' })
    } catch {
      /* 忽略 */
    }
    start()
  }

  /** 上报当前会话（completed 表示是否完整跑完） */
  async function reportSession(completed: boolean) {
    if (sessionStartedAt.value == null) return
    const total = plannedDurationSeconds.value || durationFor(mode.value)
    const endedAt = new Date()
    const startedAt = new Date(endedAt.getTime() - Math.round(elapsedSeconds()) * 1000)
    const type = mode.value as SessionType
    try {
      await createSessionApi({
        taskId: currentTaskId.value,
        type,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        plannedDurationSeconds: Math.round(total),
        completed,
      })
    } catch {
      /* 上报失败不阻塞计时流程 */
    }
    sessionStartedAt.value = null
    pausedElapsedSeconds.value = 0
  }

  async function completeSession() {
    const finishedMode = mode.value
    stopTicker()
    await reportSession(true)

    const s = settingsStore.settings
    if (finishedMode === 'work') {
      const result = nextModeAfterCompletedWork(completedInCycle.value, s.longBreakInterval)
      completedInCycle.value = result.completedInCycle
      const reachedLongBreak = result.nextMode === 'longBreak'
      const doneInCycle = reachedLongBreak ? s.longBreakInterval : result.completedInCycle
      switchMode(result.nextMode)
      if (s.notificationEnabled) {
        const title = reachedLongBreak ? '太棒了！长时间休息时间到 🎉' : '工作完成！'
        const body = reachedLongBreak
          ? `本轮 ${s.longBreakInterval} 个番茄已完成，好好放松一下吧`
          : `本轮已完成 ${doneInCycle}/${s.longBreakInterval} 个番茄，休息 ${s.shortBreakMinutes} 分钟`
        alertModeFinished(title, body, s.soundEnabled)
      }
    } else {
      switchMode(nextModeAfterBreak())
      if (s.notificationEnabled) {
        alertModeFinished('休息结束', '准备好开始下一个番茄了吗？', s.soundEnabled)
      }
    }

    if (s.autoStartNext) {
      start()
    } else {
      persist()
    }
  }

  async function skip() {
    stopTicker()
    await reportSession(false)
    if (mode.value === 'work') {
      switchMode('shortBreak')
    } else {
      switchMode('work')
    }
    // 跳过 = 放弃本次专注，结束「进行中」标记
    void clearDoing()
  }

  /** 页面刷新后恢复计时（若已超时则立即结算） */
  function restoreIfNeeded() {
    if (status.value === 'running' && sessionStartedAt.value != null) {
      const total = plannedDurationSeconds.value || durationFor(mode.value)
      if (elapsedSeconds() >= total) {
        void completeSession()
      } else {
        refreshRemaining()
        startTicker()
      }
    } else {
      remainingSeconds.value = plannedDurationSeconds.value || durationFor(mode.value)
    }
  }

  /* 当前专注任务被删除或标记完成后，自动清空选择（兜底，覆盖刷新等场景） */
  watch(
    () => tasksStore.tasks,
    (tasks) => {
      if (currentTaskId.value == null) return
      const t = tasks.find((x) => x.id === currentTaskId.value)
      if (!t || t.status === 'DONE') {
        currentTaskId.value = null
        persist()
      }
    },
    { deep: true },
  )

  /* 网页标题实时显示倒计时 */
  watch([mode, status, remainingSeconds], () => {
    document.title =
      status.value === 'running' ? `${formatSeconds(remainingSeconds.value)} · 番茄时钟` : '番茄时钟'
  })

  return {
    mode,
    status,
    remainingSeconds,
    completedInCycle,
    currentTaskId,
    isRunning,
    start,
    pause,
    reset,
    skip,
    switchMode,
    applySettingsChange,
    startFocus,
    clearDoing,
    isTaskActive,
    restoreIfNeeded,
    requestPermission: requestNotificationPermission,
  }
})
