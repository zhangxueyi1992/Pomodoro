import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateQuery } from '../middleware/validate.js'
import { summary } from '../services/stats.service.js'

const router = Router()

const rangeQuerySchema = z.object({
  range: z.enum(['day', 'week', 'month']).default('week'),
})

router.use(requireAuth)

router.get('/summary', validateQuery(rangeQuerySchema), async (req, res) => {
  const { range } = rangeQuerySchema.parse(req.query)
  res.json(await summary(req.userId!, range))
})

export const statsRouter = router
