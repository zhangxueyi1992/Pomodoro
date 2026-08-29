import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { getSettings, updateSettings } from '../services/settings.service.js'

const router = Router()

const updateSchema = z.object({
  workMinutes: z.number().int().min(1).max(120),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  longBreakInterval: z.number().int().min(2).max(12),
  autoStartNext: z.boolean(),
  soundEnabled: z.boolean(),
  notificationEnabled: z.boolean(),
})

router.use(requireAuth)

router.get('/', async (req, res) => {
  res.json(await getSettings(req.userId!))
})

router.patch('/', validateBody(updateSchema), async (req, res) => {
  res.json(await updateSettings(req.userId!, req.body))
})

export const settingsRouter = router
