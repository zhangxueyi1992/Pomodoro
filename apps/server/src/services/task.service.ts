import type { TaskStatus } from '@pomodoro/shared'
import { prisma } from '../lib/prisma.js'
import { notFound } from '../utils/http.js'

export interface CreateTaskInput {
  title: string
  description?: string
  estimatedPomodoros?: number
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  status?: TaskStatus
  estimatedPomodoros?: number | null
  sortOrder?: number
}

async function findOwned(userId: number, id: number) {
  const task = await prisma.task.findFirst({ where: { id, userId } })
  if (!task) {
    throw notFound('任务不存在')
  }
  return task
}

export function listTasks(userId: number) {
  return prisma.task.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function createTask(userId: number, input: CreateTaskInput) {
  return prisma.task.create({ data: { userId, ...input } })
}

export async function updateTask(userId: number, id: number, input: UpdateTaskInput) {
  await findOwned(userId, id)
  return prisma.task.update({ where: { id }, data: input })
}

export async function deleteTask(userId: number, id: number) {
  await findOwned(userId, id)
  await prisma.task.delete({ where: { id } })
  return { ok: true }
}
