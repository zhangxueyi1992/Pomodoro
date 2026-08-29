import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// .env 位于 monorepo 根目录；基于文件位置解析，与启动时的 cwd 无关
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'mysql://root:123456@127.0.0.1:3309/pomodoro',
  databaseUrlTest: process.env.DATABASE_URL_TEST ?? 'mysql://root:123456@127.0.0.1:3309/pomodoro_test',
}
