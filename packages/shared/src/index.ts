/** 计时模式 */
export type TimerMode = 'work' | 'shortBreak' | 'longBreak'

/** 计时状态 */
export type TimerStatus = 'idle' | 'running' | 'paused'

/** 会话类型 */
export type SessionType = TimerMode

/** 任务状态 */
export type TaskStatus = 'TODO' | 'DOING' | 'DONE'

/** 会话记录（前后端共享） */
export interface PomodoroSession {
  id: number
  taskId: number | null
  type: SessionType
  startedAt: string
  endedAt: string
  plannedDurationSeconds: number
  completed: boolean
}

/** 任务（前后端共享） */
export interface Task {
  id: number
  title: string
  description: string | null
  status: TaskStatus
  estimatedPomodoros: number | null
  completedPomodoros: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** 用户设置（前后端共享） */
export interface Settings {
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartNext: boolean
  soundEnabled: boolean
  notificationEnabled: boolean
}

/** 当前用户（前后端共享） */
export interface UserInfo {
  id: number
  email: string
  username: string
}

/** 统计区间 */
export type StatsRange = 'day' | 'week' | 'month'

/** 统计接口响应 */
export interface StatsSummary {
  range: StatsRange
  totalPomodoros: number
  totalFocusMinutes: number
  daily: { date: string; pomodoros: number; focusMinutes: number }[]
}

/** 通用 API 错误响应 */
export interface ApiError {
  code: string
  message: string
}

/** 默认设置常量 */
export const DEFAULT_SETTINGS: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
  soundEnabled: true,
  notificationEnabled: true,
}
