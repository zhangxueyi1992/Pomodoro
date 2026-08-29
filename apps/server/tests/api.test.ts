import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

const app = createApp()

let token = ''
let otherToken = ''
let taskId = 0

const userA = { email: 'alice@test.com', username: 'alice', password: 'secret123' }
const userB = { email: 'bob@test.com', username: 'bob', password: 'secret456' }

beforeAll(async () => {
  // 清空测试库（按外键依赖顺序）
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0')
  await prisma.pomodoroSession.deleteMany()
  await prisma.task.deleteMany()
  await prisma.settings.deleteMany()
  await prisma.user.deleteMany()
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1')

  // 注册并登录两个用户
  await request(app).post('/api/auth/register').send(userA).expect(201)
  const loginA = await request(app).post('/api/auth/login').send({ email: userA.email, password: userA.password }).expect(200)
  token = loginA.body.token
  expect(token).toBeTruthy()

  await request(app).post('/api/auth/register').send(userB).expect(201)
  const loginB = await request(app).post('/api/auth/login').send({ email: userB.email, password: userB.password }).expect(200)
  otherToken = loginB.body.token
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('健康检查', () => {
  it('GET /api/health 返回 ok', async () => {
    const res = await request(app).get('/api/health').expect(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('认证', () => {
  it('重复注册返回 409', async () => {
    await request(app).post('/api/auth/register').send(userA).expect(409)
  })

  it('错误密码登录返回 401', async () => {
    await request(app).post('/api/auth/login').send({ email: userA.email, password: 'wrong-pass' }).expect(401)
  })

  it('参数校验失败返回 400', async () => {
    await request(app).post('/api/auth/register').send({ email: 'not-an-email', username: 'x', password: '123' }).expect(400)
  })

  it('无 token 访问 /me 返回 401', async () => {
    await request(app).get('/api/auth/me').expect(401)
  })

  it('携带 token 访问 /me 返回用户信息', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.email).toBe(userA.email)
  })

  it('伪造 token 返回 401', async () => {
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer fake.token.value').expect(401)
  })
})

describe('任务 CRUD', () => {
  it('创建任务', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '写周报', description: '本周工作总结', estimatedPomodoros: 2 })
      .expect(201)
    taskId = res.body.id
    expect(res.body.title).toBe('写周报')
    expect(res.body.completedPomodoros).toBe(0)
  })

  it('未登录创建任务返回 401', async () => {
    await request(app).post('/api/tasks').send({ title: 'x' }).expect(401)
  })

  it('任务标题为空返回 400', async () => {
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: '  ' }).expect(400)
  })

  it('列表包含刚创建的任务', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.some((t: { id: number }) => t.id === taskId)).toBe(true)
  })

  it('更新任务', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DOING' })
      .expect(200)
    expect(res.body.status).toBe('DOING')
  })

  it('无权修改他人任务返回 404（归属校验）', async () => {
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'DONE' })
      .expect(404)
  })

  it('删除任务', async () => {
    await request(app).delete(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).expect(200)
  })
})

describe('会话上报与统计', () => {
  let workTaskId = 0

  it('准备一个任务并上报 2 个完成的工作会话 + 1 个跳过会话', async () => {
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '深度工作', estimatedPomodoros: 4 })
      .expect(201)
    workTaskId = taskRes.body.id

    const base = {
      type: 'work',
      taskId: workTaskId,
      plannedDurationSeconds: 25 * 60,
    }
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...base, startedAt: new Date(Date.now() - 3600_000 * (i + 1)).toISOString(), endedAt: new Date(Date.now() - 3600_000 * i - 60_000).toISOString(), completed: true })
        .expect(201)
    }
    // 跳过：不计入统计，也不累加任务番茄数
    await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), completed: false })
      .expect(201)

    const taskAfter = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`).expect(200)
    const found = taskAfter.body.find((t: { id: number }) => t.id === workTaskId)
    expect(found.completedPomodoros).toBe(2)
  })

  it('上报会话时引用不存在的任务返回 404', async () => {
    await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'work',
        taskId: 999999,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        plannedDurationSeconds: 60,
        completed: true,
      })
      .expect(404)
  })

  it('stats/summary 仅统计完成的 work 会话', async () => {
    const res = await request(app)
      .get('/api/stats/summary?range=day')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.totalPomodoros).toBe(2)
    expect(res.body.totalFocusMinutes).toBe(50)
    expect(res.body.daily.length).toBeGreaterThanOrEqual(1)
  })

  it('不同用户的统计数据相互隔离', async () => {
    const res = await request(app)
      .get('/api/stats/summary?range=day')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200)
    expect(res.body.totalPomodoros).toBe(0)
  })
})

describe('设置', () => {
  it('默认设置符合预期', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.workMinutes).toBe(25)
    expect(res.body.longBreakInterval).toBe(4)
  })

  it('更新设置并生效', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workMinutes: 30,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 3,
        autoStartNext: true,
        soundEnabled: false,
        notificationEnabled: false,
      })
      .expect(200)
    expect(res.body.workMinutes).toBe(30)
    expect(res.body.autoStartNext).toBe(true)

    const after = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`).expect(200)
    expect(after.body.workMinutes).toBe(30)
  })

  it('非法时长返回 400', async () => {
    await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ workMinutes: 0, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakInterval: 4, autoStartNext: false, soundEnabled: true, notificationEnabled: true })
      .expect(400)
  })
})
