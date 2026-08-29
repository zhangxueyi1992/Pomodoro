import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { createTask, deleteTask, listTasks, updateTask } from '../services/task.service.js'

const router = Router()

const createSchema = z.object({
  title: z.string().trim().min(1, '任务标题不能为空').max(100, '任务标题最多 100 个字符'),
  description: z.string().trim().max(500, '描述最多 500 个字符').optional(),
  estimatedPomodoros: z.number().int().min(1).max(99).optional(),
})

const updateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['TODO', 'DOING', 'DONE']).optional(),
  estimatedPomodoros: z.number().int().min(1).max(99).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

router.use(requireAuth)

router.get('/', async (req, res) => {
  res.json(await listTasks(req.userId!))
})

router.post('/', validateBody(createSchema), async (req, res) => {
  res.status(201).json(await createTask(req.userId!, req.body))
})

router.patch('/:id', validateBody(updateSchema), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  res.json(await updateTask(req.userId!, id, req.body))
})

router.delete('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  res.json(await deleteTask(req.userId!, id))
})

export const taskRouter = router
