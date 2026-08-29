import type { PomodoroSession, Settings, StatsRange, StatsSummary, Task, UserInfo } from '@pomodoro/shared'
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

/* ---------- 任务 ---------- */
export interface TaskInput {
  title: string
  description?: string
  estimatedPomodoros?: number
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  status?: 'TODO' | 'DOING' | 'DONE'
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
