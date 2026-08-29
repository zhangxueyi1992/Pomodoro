import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { HttpError } from '../utils/http.js'

export interface AuthPayload {
  userId: number
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number
    }
  }
}

/** JWT 鉴权中间件：解析 Bearer Token 并注入 req.userId */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'UNAUTHORIZED', '未登录'))
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload
    req.userId = payload.userId
    next()
  } catch {
    next(new HttpError(401, 'UNAUTHORIZED', '登录已过期，请重新登录'))
  }
}
