import { describe, expect, it } from 'vitest'
import { formatMinutes, formatSeconds } from '../format'

describe('formatSeconds', () => {
  it('格式化 0 秒', () => {
    expect(formatSeconds(0)).toBe('00:00')
  })

  it('格式化 25 分钟', () => {
    expect(formatSeconds(25 * 60)).toBe('25:00')
  })

  it('格式化带秒的数', () => {
    expect(formatSeconds(65)).toBe('01:05')
  })

  it('负数按 0 处理', () => {
    expect(formatSeconds(-10)).toBe('00:00')
  })

  it('小数向下取整', () => {
    expect(formatSeconds(61.9)).toBe('01:01')
  })
})

describe('formatMinutes', () => {
  it('不足一小时', () => {
    expect(formatMinutes(45)).toBe('45 分钟')
  })

  it('整小时', () => {
    expect(formatMinutes(120)).toBe('2 小时')
  })

  it('小时加分钟', () => {
    expect(formatMinutes(125)).toBe('2 小时 5 分钟')
  })
})
