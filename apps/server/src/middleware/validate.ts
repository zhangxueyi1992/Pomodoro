import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

/** 基于 zod 的请求体校验中间件 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body)
    next()
  }
}

/**
 * 基于 zod 的查询参数校验中间件。
 * 注意：Express 5 中 req.query 为只读 getter，此处仅校验；
 * 类型化数据请在 handler 中再次 parse 获取。
 */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    schema.parse(req.query)
    next()
  }
}
