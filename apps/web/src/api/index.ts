import type { PomodoroSession, Settings, StatsRange, StatsSummary, Task, TaskStatus, UserInfo } from '@pomodoro/shared'
import http from './http'

/* ---------- 认证 ---------- */
export function loginApi(email: string, password: string) {
  return http.post<{ token: string; user: UserInfo }>('/auth/login', { email, password }).then((r) => r.data)
}

export function registerApi(email: string, username: string, password: string) {
  return http
    .post<{ id: number; email: string; username: string }>('/auth/register', { email, username, password })
    .then((r) => r.data)
}

export function meApi() {
  return http.get<UserInfo>('/auth/me').then((r) => r.data)
}

/* 修改资料（昵称 / 密码） */
export interface ProfileUpdate {
  username?: string
  currentPassword?: string
  newPassword?: string
}

export function updateProfileApi(input: ProfileUpdate) {
  return http.patch<UserInfo>('/auth/me', input).then((r) => r.data)
}

/* 忘记密码（电子邮件验证码） */
export function forgotPasswordApi(email: string) {
  // SMTP 发信可能较慢（163 有时 >10s），放宽该请求超时，避免「邮件已发出却在客户端误报网络错误」
  return http
    .post<{ ok: boolean }>('/auth/forgot-password', { email }, { timeout: 30000 })
    .then((r) => r.data)
}

export function resetPasswordApi(email: string, code: string, newPassword: string) {
  return http.post<{ ok: boolean }>('/auth/reset-password', { email, code, newPassword }).then((r) => r.data)
}

/* 更换主邮箱（需登录）：先向新邮箱发验证码，再确认 */
export function changeEmailApi(newEmail: string) {
  return http.post<{ ok: boolean }>('/auth/change-email', { newEmail }, { timeout: 30000 }).then((r) => r.data)
}

export function confirmChangeEmailApi(newEmail: string, code: string) {
  return http.post<{ token: string; user: UserInfo }>('/auth/change-email/confirm', { newEmail, code }).then((r) => r.data)
}

/* ---------- 任务 ---------- */
export interface TaskInput {
  title: string
  description?: string
  estimatedPomodoros?: number
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  status?: TaskStatus
  estimatedPomodoros?: number | null
  sortOrder?: number
}

export function fetchTasks() {
  return http.get<Task[]>('/tasks').then((r) => r.data)
}

export function createTaskApi(input: TaskInput) {
  return http.post<Task>('/tasks', input).then((r) => r.data)
}

export function updateTaskApi(id: number, input: TaskUpdate) {
  return http.patch<Task>(`/tasks/${id}`, input).then((r) => r.data)
}

export function deleteTaskApi(id: number) {
  return http.delete<{ ok: boolean }>(`/tasks/${id}`).then((r) => r.data)
}

/* ---------- 会话 ---------- */
export interface SessionInput {
  taskId?: number | null
  type: 'work' | 'shortBreak' | 'longBreak'
  startedAt: string
  endedAt: string
  plannedDurationSeconds: number
  completed: boolean
}

export function createSessionApi(input: SessionInput) {
  return http.post<PomodoroSession>('/sessions', input).then((r) => r.data)
}

export function fetchSessionsApi(from?: string, to?: string) {
  return http.get<PomodoroSession[]>('/sessions', { params: { from, to } }).then((r) => r.data)
}

/* ---------- 统计 ---------- */
export function fetchStatsApi(range: StatsRange) {
  return http.get<StatsSummary>('/stats/summary', { params: { range } }).then((r) => r.data)
}

/* ---------- 设置 ---------- */
export function fetchSettingsApi() {
  return http.get<Settings>('/settings').then((r) => r.data)
}

export function updateSettingsApi(input: Settings) {
  return http.patch<Settings>('/settings', input).then((r) => r.data)
}
