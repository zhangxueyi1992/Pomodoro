import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../utils/http.js'

export interface AuthPayload {
  userId: number
  sessionVersion?: number
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number
    }
  }
}

/** JWT 鉴权中间件：解析 Bearer Token、注入 req.userId，并校验会话版本实现“单终端登录” */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'UNAUTHORIZED', '未登录'))
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload
    const rows = await prisma.$queryRaw<{ sessionVersion: number }[]>`
      SELECT \`sessionVersion\` FROM \`User\` WHERE id = ${payload.userId}`
    if (rows.length === 0) {
      next(new HttpError(401, 'UNAUTHORIZED', '用户不存在'))
      return
    }
    // token 中的版本号落后（账号已在其他设备重新登录）→ 强制下线
    if (rows[0].sessionVersion !== (payload.sessionVersion ?? 0)) {
      next(new HttpError(401, 'SESSION_REVOKED', '您的账号已在其他设备登录，已被强制下线'))
      return
    }
    req.userId = payload.userId
    next()
  } catch (err) {
    if (err instanceof HttpError) {
      next(err)
      return
    }
    next(new HttpError(401, 'UNAUTHORIZED', '登录已过期，请重新登录'))
  }
}
