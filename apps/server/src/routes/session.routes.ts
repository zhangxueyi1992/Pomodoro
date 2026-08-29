import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateBody, validateQuery } from '../middleware/validate.js'
import { createSession, listSessions } from '../services/session.service.js'

const router = Router()

const createSchema = z.object({
  taskId: z.number().int().positive().nullable().optional(),
  type: z.enum(['work', 'shortBreak', 'longBreak']),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  plannedDurationSeconds: z.number().int().positive(),
  completed: z.boolean(),
})

const listQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

router.use(requireAuth)

router.post('/', validateBody(createSchema), async (req, res) => {
  res.status(201).json(await createSession(req.userId!, req.body))
})

router.get('/', validateQuery(listQuerySchema), async (req, res) => {
  const { from, to } = listQuerySchema.parse(req.query)
  res.json(await listSessions(req.userId!, { from, to }))
})

export const sessionRouter = router
