import { Router } from 'express'
import { z } from 'zod'
import { PASSWORD_HINT, PASSWORD_MAX, PASSWORD_PATTERN } from '@pomodoro/shared'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import {
  changeEmail,
  confirmChangeEmail,
  getMe,
  login,
  register,
  requestPasswordReset,
  resetPassword,
  updateProfile,
} from '../services/auth.service.js'

const router = Router()

/** 密码强度校验（至少 8 位，含数字、大小写字母；bcrypt 上限 72） */
const passwordField = z
  .string()
  .regex(PASSWORD_PATTERN, PASSWORD_HINT)
  .max(PASSWORD_MAX, `密码最多 ${PASSWORD_MAX} 位`)

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z.string().trim().min(2, '用户名至少 2 个字符').max(30, '用户名最多 30 个字符'),
  password: passwordField,
})

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

const forgotSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
})

const resetSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  code: z.string().regex(/^\d{6}$/, '验证码为 6 位数字'),
  newPassword: passwordField,
})

const updateProfileSchema = z.object({
  username: z.string().trim().min(2, '昵称至少 2 个字符').max(30, '昵称最多 30 个字符').optional(),
  currentPassword: z.string().min(1, '请输入原密码').optional(),
  newPassword: passwordField.optional(),
})

const changeEmailSchema = z.object({
  newEmail: z.string().trim().email('邮箱格式不正确'),
})

const changeEmailConfirmSchema = z.object({
  newEmail: z.string().trim().email('邮箱格式不正确'),
  code: z.string().regex(/^\d{6}$/, '验证码为 6 位数字'),
})

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const user = await register(req.body)
  res.status(201).json(user)
})

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const result = await login(req.body)
  res.json(result)
})

router.post('/forgot-password', validateBody(forgotSchema), async (req, res) => {
  res.json(await requestPasswordReset(req.body.email))
})

router.post('/reset-password', validateBody(resetSchema), async (req, res) => {
  res.json(await resetPassword(req.body.email, req.body.code, req.body.newPassword))
})

router.get('/me', requireAuth, async (req, res) => {
  res.json(await getMe(req.userId!))
})

router.patch('/me', requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  res.json(await updateProfile(req.userId!, req.body))
})

/* 主邮箱迁移（验证新邮箱所有权后更换登录邮箱，成功后旧 token 失效并签发新 token） */
router.post('/change-email', requireAuth, validateBody(changeEmailSchema), async (req, res) => {
  res.json(await changeEmail(req.userId!, req.body.newEmail))
})

router.post('/change-email/confirm', requireAuth, validateBody(changeEmailConfirmSchema), async (req, res) => {
  res.json(await confirmChangeEmail(req.userId!, req.body.newEmail, req.body.code))
})

export const authRouter = router
