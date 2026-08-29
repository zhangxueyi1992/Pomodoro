import type { Settings } from '@pomodoro/shared'
import { prisma } from '../lib/prisma.js'

export function getSettings(userId: number) {
  return prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

export async function updateSettings(userId: number, input: Partial<Settings>) {
  return prisma.settings.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  })
}
