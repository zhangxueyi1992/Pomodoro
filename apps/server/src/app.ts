import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './routes/auth.routes.js'
import { sessionRouter } from './routes/session.routes.js'
import { settingsRouter } from './routes/settings.routes.js'
import { statsRouter } from './routes/stats.routes.js'
import { taskRouter } from './routes/task.routes.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/tasks', taskRouter)
  app.use('/api/sessions', sessionRouter)
  app.use('/api/stats', statsRouter)
  app.use('/api/settings', settingsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
