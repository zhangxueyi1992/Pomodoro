import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/http.js'

/** 统一错误处理中间件 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: err.issues[0]?.message ?? '参数错误' })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message })
    return
  }
  console.error('[unhandled error]', err)
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务器内部错误' })
}

/** 404 兜底 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在' })
}
