/** 带 HTTP 状态码的业务错误，由统一错误中间件转换为 JSON 响应 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (message = '资源不存在') => new HttpError(404, 'NOT_FOUND', message)

export const unauthorized = (message = '未登录或登录已过期') => new HttpError(401, 'UNAUTHORIZED', message)

export const forbidden = (message = '无权操作该资源') => new HttpError(403, 'FORBIDDEN', message)

export const badRequest = (message = '参数错误') => new HttpError(400, 'BAD_REQUEST', message)
