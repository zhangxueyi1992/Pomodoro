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
    throw new HttpError(401, 'BAD_CREDENTIALS', '邮箱或密码错误')
  }
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  })
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
