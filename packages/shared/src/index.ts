/** 计时模式 */
export type TimerMode = 'work' | 'shortBreak' | 'longBreak'

/** 计时状态 */
export type TimerStatus = 'idle' | 'running' | 'paused'

/** 会话类型 */
export type SessionType = TimerMode

/** 任务状态 */
export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'DELETED'

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

/** 密码强度规则：至少 8 位，必须同时包含数字、大写字母、小写字母 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

/** bcrypt 密码长度上限（字节） */
export const PASSWORD_MAX = 72

/** 密码强度校验失败提示 */
export const PASSWORD_HINT = '密码至少 8 位，且需包含数字和大小写字母'

/** 密码输入框占位提示 */
export const PASSWORD_PLACEHOLDER = '8 位以上，含数字和大小写字母'

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
