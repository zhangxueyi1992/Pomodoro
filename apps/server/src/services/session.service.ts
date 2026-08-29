import type { SessionType } from '@pomodoro/shared'
import { prisma } from '../lib/prisma.js'
import { notFound } from '../utils/http.js'

export interface CreateSessionInput {
  taskId?: number | null
  type: SessionType
  startedAt: string
  endedAt: string
  plannedDurationSeconds: number
  completed: boolean
}

export interface ListSessionsQuery {
  from?: string
  to?: string
}

/** 上报一个结束的会话；完成的工作番茄若关联任务，累加任务完成数 */
export async function createSession(userId: number, input: CreateSessionInput) {
  if (input.taskId != null) {
    const task = await prisma.task.findFirst({ where: { id: input.taskId, userId } })
    if (!task) {
      throw notFound('任务不存在')
    }
  }
  const session = await prisma.pomodoroSession.create({
    data: {
      userId,
      taskId: input.taskId ?? null,
      type: input.type,
      startedAt: new Date(input.startedAt),
      endedAt: new Date(input.endedAt),
      plannedDurationSeconds: input.plannedDurationSeconds,
      completed: input.completed,
    },
  })
  if (input.completed && input.type === 'work' && input.taskId != null) {
    await prisma.task.update({
      where: { id: input.taskId },
      data: { completedPomodoros: { increment: 1 } },
    })
  }
  return session
}

export function listSessions(userId: number, query: ListSessionsQuery) {
  const where: Record<string, unknown> = { userId }
  if (query.from || query.to) {
    where.startedAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    }
  }
  return prisma.pomodoroSession.findMany({
    where,
    orderBy: { startedAt: 'desc' },
  })
}
