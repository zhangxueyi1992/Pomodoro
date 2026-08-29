import dayjs from 'dayjs'
import type { StatsRange, StatsSummary } from '@pomodoro/shared'
import { prisma } from '../lib/prisma.js'
import { badRequest } from '../utils/http.js'

function startOfRange(range: StatsRange): Date {
  const now = dayjs()
  switch (range) {
    case 'day':
      return now.startOf('day').toDate()
    case 'week':
      return now.startOf('week').toDate()
    case 'month':
      return now.startOf('month').toDate()
    default:
      throw badRequest('不支持的统计区间')
  }
}

/** 统计：仅统计 completed=true 的 work 会话 */
export async function summary(userId: number, range: StatsRange): Promise<StatsSummary> {
  const from = startOfRange(range)
  const sessions = await prisma.pomodoroSession.findMany({
    where: { userId, type: 'work', completed: true, endedAt: { gte: from } },
    select: { endedAt: true, plannedDurationSeconds: true },
  })

  const dailyMap = new Map<string, { pomodoros: number; focusMinutes: number }>()
  for (const s of sessions) {
    const key = dayjs(s.endedAt).format('YYYY-MM-DD')
    const entry = dailyMap.get(key) ?? { pomodoros: 0, focusMinutes: 0 }
    entry.pomodoros += 1
    entry.focusMinutes += Math.round(s.plannedDurationSeconds / 60)
    dailyMap.set(key, entry)
  }

  const daily = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }))

  const totalPomodoros = daily.reduce((sum, d) => sum + d.pomodoros, 0)
  const totalFocusMinutes = daily.reduce((sum, d) => sum + d.focusMinutes, 0)

  return { range, totalPomodoros, totalFocusMinutes, daily }
}
