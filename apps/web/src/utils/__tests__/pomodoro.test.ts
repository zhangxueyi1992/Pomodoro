import { describe, expect, it } from 'vitest'
import { nextModeAfterBreak, nextModeAfterCompletedWork } from '../pomodoro'

describe('nextModeAfterCompletedWork', () => {
  it('完成第 1 个番茄进入短休息', () => {
    const r = nextModeAfterCompletedWork(0, 4)
    expect(r.nextMode).toBe('shortBreak')
    expect(r.completedInCycle).toBe(1)
  })

  it('完成第 3 个番茄仍进入短休息', () => {
    const r = nextModeAfterCompletedWork(2, 4)
    expect(r.nextMode).toBe('shortBreak')
    expect(r.completedInCycle).toBe(3)
  })

  it('完成第 4 个番茄进入长休息并重置计数', () => {
    const r = nextModeAfterCompletedWork(3, 4)
    expect(r.nextMode).toBe('longBreak')
    expect(r.completedInCycle).toBe(0)
  })

  it('自定义间隔 3 时第 3 个番茄进入长休息', () => {
    const r = nextModeAfterCompletedWork(2, 3)
    expect(r.nextMode).toBe('longBreak')
    expect(r.completedInCycle).toBe(0)
  })
})

describe('nextModeAfterBreak', () => {
  it('休息结束后回到工作', () => {
    expect(nextModeAfterBreak()).toBe('work')
  })
})
