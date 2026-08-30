import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { getMe, login, register, updateProfile } from '../services/auth.service.js'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z.string().trim().min(2, '用户名至少 2 个字符').max(30, '用户名最多 30 个字符'),
  password: z.string().min(6, '密码至少 6 位').max(72, '密码最多 72 位'),
})

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

const updateProfileSchema = z.object({
  username: z.string().trim().min(2, '昵称至少 2 个字符').max(30, '昵称最多 30 个字符').optional(),
  currentPassword: z.string().min(1, '请输入原密码').optional(),
  newPassword: z.string().min(6, '新密码至少 6 位').max(72, '新密码最多 72 位').optional(),
})

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const user = await register(req.body)
  res.status(201).json(user)
})

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const result = await login(req.body)
  res.json(result)
})

router.get('/me', requireAuth, async (req, res) => {
  res.json(await getMe(req.userId!))
})

router.patch('/me', requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  res.json(await updateProfile(req.userId!, req.body))
})

export const authRouter = router
