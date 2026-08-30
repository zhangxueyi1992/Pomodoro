import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { config } from '../config.js'
import { HttpError } from '../utils/http.js'

export interface RegisterInput {
  email: string
  username: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw new HttpError(409, 'EMAIL_TAKEN', '该邮箱已被注册')
  }
  const nameTaken = await prisma.user.findFirst({ where: { username: input.username } })
  if (nameTaken) {
    throw new HttpError(409, 'USERNAME_TAKEN', '该昵称已被使用')
  }
  const passwordHash = await bcrypt.hash(input.password, 10)
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      settings: { create: {} },
    },
  })
  return { id: user.id, email: user.email, username: user.username }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  const passwordOk = user ? await bcrypt.compare(input.password, user.passwordHash) : false
  if (!user || !passwordOk) {
    throw new HttpError(401, 'BAD_CREDENTIALS', '用户名或密码错误')
  }

  // 单终端登录：每次登录递增会话版本号，作废此前所有设备的 token
  const [current] = await prisma.$queryRaw<{ sessionVersion: number }[]>`
    SELECT \`sessionVersion\` FROM \`User\` WHERE id = ${user.id}`
  const nextVersion = Number(current?.sessionVersion ?? 0) + 1
  await prisma.$executeRaw`
    UPDATE \`User\` SET \`sessionVersion\` = ${nextVersion} WHERE id = ${user.id}`

  const token = jwt.sign(
    { userId: user.id, sessionVersion: nextVersion },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  )
  return {
    token,
    user: { id: user.id, email: user.email, username: user.username },
  }
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  })
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  }
  return user
}

export interface UpdateProfileInput {
  username?: string
  currentPassword?: string
  newPassword?: string
}

/** 修改昵称 / 密码（昵称需唯一，改密码需校验原密码） */
export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  }

  // 昵称唯一性（MySQL 默认不区分大小写；排除自己）
  if (input.username && input.username !== user.username) {
    const taken = await prisma.user.findFirst({
      where: { username: input.username, id: { not: userId } },
    })
    if (taken) {
      throw new HttpError(409, 'USERNAME_TAKEN', '该昵称已被使用')
    }
  }

  const data: { username?: string; passwordHash?: string } = {}
  if (input.username) data.username = input.username
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new HttpError(400, 'BAD_REQUEST', '请输入原密码')
    }
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash)
    if (!ok) {
      throw new HttpError(400, 'BAD_PASSWORD', '原密码不正确')
    }
    data.passwordHash = await bcrypt.hash(input.newPassword, 10)
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', '请至少修改一项')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, username: true },
  })
  return updated
}
