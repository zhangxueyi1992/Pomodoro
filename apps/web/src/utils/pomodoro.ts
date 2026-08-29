import type { TimerMode } from '@pomodoro/shared'

export interface CompletionResult {
  nextMode: TimerMode
  completedInCycle: number
}

/**
 * 工作阶段完整结束后，决定进入短休息还是长休息。
 * 每完成 longBreakInterval 个工作番茄进入一次长休息。
 */
export function nextModeAfterCompletedWork(
  completedInCycle: number,
  longBreakInterval: number,
): CompletionResult {
  const next = completedInCycle + 1
  if (next >= longBreakInterval) {
    return { nextMode: 'longBreak', completedInCycle: 0 }
  }
  return { nextMode: 'shortBreak', completedInCycle: next }
}

/** 休息阶段结束后回到工作模式 */
export function nextModeAfterBreak(): TimerMode {
  return 'work'
}
