import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomInt } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { config } from '../config.js'
import { HttpError } from '../utils/http.js'
import { sendMail } from '../utils/mailer.js'

export interface RegisterInput {
  email: string
  username: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw new HttpError(409, 'EMAIL_TAKEN', '该邮箱已被注册')
  }
  const nameTaken = await prisma.user.findFirst({ where: { username: input.username } })
  if (nameTaken) {
    throw new HttpError(409, 'USERNAME_TAKEN', '该昵称已被使用')
  }
  const passwordHash = await bcrypt.hash(input.password, 10)
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      settings: { create: {} },
    },
  })
  return { id: user.id, email: user.email, username: user.username }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  const passwordOk = user ? await bcrypt.compare(input.password, user.passwordHash) : false
  if (!user || !passwordOk) {
    throw new HttpError(401, 'BAD_CREDENTIALS', '用户名或密码错误')
  }

  // 单终端登录：每次登录递增会话版本号，作废此前所有设备的 token
  const [current] = await prisma.$queryRaw<{ sessionVersion: number }[]>`
    SELECT \`sessionVersion\` FROM \`User\` WHERE id = ${user.id}`
  const nextVersion = Number(current?.sessionVersion ?? 0) + 1
  await prisma.$executeRaw`
    UPDATE \`User\` SET \`sessionVersion\` = ${nextVersion} WHERE id = ${user.id}`

  const token = jwt.sign(
    { userId: user.id, sessionVersion: nextVersion },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  )
  return {
    token,
    user: { id: user.id, email: user.email, username: user.username },
  }
}

export async function getMe(userId: number) {
  const row = await findUserRow(userId)
  if (!row) {
    throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  }
  return row
}

export interface UpdateProfileInput {
  username?: string
  currentPassword?: string
  newPassword?: string
}

/** 修改昵称 / 密码（昵称需唯一，改密码需校验原密码） */
export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  }

  // 昵称唯一性（MySQL 默认不区分大小写；排除自己）
  if (input.username && input.username !== user.username) {
    const taken = await prisma.user.findFirst({
      where: { username: input.username, id: { not: userId } },
    })
    if (taken) {
      throw new HttpError(409, 'USERNAME_TAKEN', '该昵称已被使用')
    }
  }

  const data: { username?: string; passwordHash?: string } = {}
  if (input.username) data.username = input.username
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new HttpError(400, 'BAD_REQUEST', '请输入原密码')
    }
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash)
    if (!ok) {
      throw new HttpError(400, 'BAD_PASSWORD', '原密码不正确')
    }
    const sameAsOld = await bcrypt.compare(input.newPassword, user.passwordHash)
    if (sameAsOld) {
      throw new HttpError(400, 'SAME_AS_OLD', '新密码不能与原密码相同')
    }
    data.passwordHash = await bcrypt.hash(input.newPassword, 10)
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', '请至少修改一项')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, username: true },
  })
  return updated
}

/**
 * 确保验证码表存在，并升级为「同一邮箱最多一条待验证码」结构（沙箱无法跑 prisma migrate，用原生 SQL 幂等建表）。
 * 关键点：用 active + 生成列 activeEmail + UNIQUE 约束，从数据库层lock住「同邮箱至多一条待验证码」：
 *   - active=1 表示「当前唯一有效、待验证的验证码」；
 *   - activeEmail 为 STORED 生成列，active=1 时取 email，否则 NULL；
 *   - UNIQUE(activeEmail) 利用「NULL 不参与唯一约束」的特性，保证同一邮箱最多只能有一条 active=1 的记录。
 *     这样就不会出现同一个邮箱存在多条未使用验证码、任意一条都能通过的情况。
 */
async function ensureResetCodeTable() {
  // 1) 幂等建表（若已存在则跳过）。新增 active + 生成列 activeEmail + 唯一索引：
  //    - active=1 表示「当前唯一有效、待验证的验证码」；
  //    - activeEmail 生成列：active=1 时取 email，否则 NULL；
  //    - UNIQUE(activeEmail) 利用「NULL 不参与唯一约束」的特性，保证同一邮箱最多只能有一条 active=1 的记录。
  //      这样就不会出现同一个邮箱存在多条未使用验证码、任意一条都能通过的情况。
  //    receiveEmail 记录「验证码实际发往的邮箱」：主邮箱失效时可发往该账号绑定的备用邮箱。
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`PasswordResetCode\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`email\` VARCHAR(255) NOT NULL,
      \`codeHash\` VARCHAR(64) NOT NULL,
      \`expiresAt\` DATETIME NOT NULL,
      \`used\` TINYINT(1) NOT NULL DEFAULT 0,
      \`active\` TINYINT(1) NOT NULL DEFAULT 0,
      \`activeEmail\` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN \`active\` = 1 THEN \`email\` END) STORED,
      \`receiveEmail\` VARCHAR(255) NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_email\` (\`email\`),
      UNIQUE KEY \`uq_active_email\` (\`activeEmail\`)
    )
  `)

  // 2) 兼容旧表：MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，先查询列是否存在再做增量迁移
  const [cols] = await prisma.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PasswordResetCode' AND COLUMN_NAME = 'active'`
  if (Number(cols.cnt) === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`PasswordResetCode\`
        ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN \`activeEmail\` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN \`active\` = 1 THEN \`email\` END) STORED,
        ADD UNIQUE KEY \`uq_active_email\` (\`activeEmail\`)
    `)
    // 3) 数据收敛：历史遗留的「未使用且未过期」代码里，仅保留每个邮箱最新一条为 active=1，其余保持作废
    await prisma.$executeRawUnsafe(`
      UPDATE \`PasswordResetCode\` t
      JOIN (
        SELECT \`email\`, MAX(\`id\`) AS maxId
        FROM \`PasswordResetCode\`
        WHERE \`used\` = 0 AND \`expiresAt\` > NOW()
        GROUP BY \`email\`
      ) k ON k.maxId = t.\`id\` AND k.\`email\` = t.\`email\`
      SET t.\`active\` = 1
    `)
  }

  // 4) 兼容旧表：补 receiveEmail 列（备用邮箱收码支持）
  const [recvCols] = await prisma.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PasswordResetCode' AND COLUMN_NAME = 'receiveEmail'`
  if (Number(recvCols.cnt) === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`PasswordResetCode\` ADD COLUMN \`receiveEmail\` VARCHAR(255) NULL
    `)
  }
}

/** 验证码哈希（email + code 加盐，避免明文落库） */
function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code}`).digest('hex')
}

/** 请求发送重置密码验证码：6 位随机码，10 分钟有效，同一邮箱 60 秒冷却。
 *  验证码始终发送至账号主邮箱。 */
export async function requestPasswordReset(email: string) {
  await ensureResetCodeTable()
  // 用户明确要求：未注册邮箱直接提示「该邮箱不存在」（放弃防枚举静默策略）
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!u) throw new HttpError(404, 'EMAIL_NOT_FOUND', '该邮箱不存在')

  // 冷却检查：在数据库端用 NOW()/TIMESTAMPDIFF 计算，绕开 Prisma 读写 MySQL DATETIME 的时区歧义
  const [last] = await prisma.$queryRaw<{ ageSeconds: number | null }[]>`
    SELECT TIMESTAMPDIFF(SECOND, MAX(\`createdAt\`), NOW()) AS ageSeconds
    FROM \`PasswordResetCode\` WHERE \`email\` = ${email}`
  if (last?.ageSeconds != null && Number(last.ageSeconds) < 60) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS', '请求过于频繁，请 60 秒后再试')
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0')
  const codeHash = hashCode(email, code)
  // 先作废该邮箱当前唯一有效码，释放 UNIQUE(activeEmail) 槽位，确保同邮箱始终只有一条待验证码
  await prisma.$executeRaw`
    UPDATE \`PasswordResetCode\` SET \`active\` = 0, \`used\` = 1
    WHERE \`email\` = ${email} AND \`active\` = 1`
  // expiresAt 由数据库生成（NOW()+10 分钟），与 createdAt 同源，避免时区错位；
  // receiveEmail 记录验证码实际发往的地址（当前恒等于账号邮箱）
  await prisma.$executeRaw`
    INSERT INTO \`PasswordResetCode\` (\`email\`, \`codeHash\`, \`expiresAt\`, \`used\`, \`active\`, \`receiveEmail\`)
    VALUES (${email}, ${codeHash}, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, 1, ${email})`

  try {
    await sendMail({
      to: email,
      subject: '番茄时钟 - 重置密码验证码',
      text: `您的验证码是：${code}，10 分钟内有效。若非本人操作请忽略。`,
    })
  } catch (err) {
    console.error('[mail] send failed', err)
    // 发信失败：回滚本邮箱最近一条验证码记录，释放 60s 冷却，允许立即重试。
    // 这样「邮件没发出去」的失败请求不会占用冷却时间（此前会误锁 60 秒）。
    try {
      await prisma.$executeRaw`
        DELETE FROM \`PasswordResetCode\` WHERE \`email\` = ${email} ORDER BY \`id\` DESC LIMIT 1`
    } catch (rollbackErr) {
      console.error('[mail] rollback failed', rollbackErr)
    }
    throw new HttpError(500, 'MAIL_FAILED', '邮件发送失败，请稍后重试')
  }
  return { ok: true }
}

/** 校验验证码并重置密码 */
export async function resetPassword(email: string, code: string, newPassword: string) {
  await ensureResetCodeTable()
  const codeHash = hashCode(email, code)
  const [row] = await prisma.$queryRaw<{ id: number; expiresInSeconds: number | null; used: number }[]>`
    SELECT \`id\`, \`used\`, TIMESTAMPDIFF(SECOND, \`expiresAt\`, NOW()) AS expiresInSeconds
    FROM \`PasswordResetCode\`
    WHERE \`email\` = ${email} AND \`codeHash\` = ${codeHash} AND \`active\` = 1
    ORDER BY \`id\` DESC LIMIT 1`
  if (!row) throw new HttpError(400, 'INVALID_CODE', '验证码错误')
  if (row.used) throw new HttpError(400, 'CODE_USED', '该验证码已被使用')
  // TIMESTAMPDIFF(SECOND, expiresAt, NOW()) = NOW - expiresAt：未过期时为负值，过期后 >= 0
  if (row.expiresInSeconds == null || Number(row.expiresInSeconds) >= 0) {
    throw new HttpError(400, 'CODE_EXPIRED', '验证码已过期')
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在')
  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash)
  if (sameAsOld) {
    throw new HttpError(400, 'SAME_AS_OLD', '新密码不能与原密码相同')
  }
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { email }, data: { passwordHash } })
  await prisma.$executeRaw`UPDATE \`PasswordResetCode\` SET \`used\` = 1, \`active\` = 0 WHERE \`id\` = ${row.id}`
  return { ok: true }
}

/* ===================== 邮箱所有权验证（换主邮箱 / 绑定备用邮箱共用） ===================== */

/** 确保 EmailVerifyCode 表存在（与 PasswordResetCode 相同的 active 唯一约束结构） */
async function ensureEmailVerifyTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`EmailVerifyCode\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`email\` VARCHAR(255) NOT NULL,
      \`codeHash\` VARCHAR(64) NOT NULL,
      \`expiresAt\` DATETIME NOT NULL,
      \`used\` TINYINT(1) NOT NULL DEFAULT 0,
      \`active\` TINYINT(1) NOT NULL DEFAULT 0,
      \`activeEmail\` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN \`active\` = 1 THEN \`email\` END) STORED,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_email\` (\`email\`),
      UNIQUE KEY \`uq_active_email\` (\`activeEmail\`)
    )
  `)
}

/** 向目标邮箱发送「所有权验证码」：6 位随机码，10 分钟有效，同一邮箱 60 秒冷却；发信失败回滚不占冷却 */
async function sendEmailVerifyCode(email: string) {
  await ensureEmailVerifyTable()
  const [last] = await prisma.$queryRaw<{ ageSeconds: number | null }[]>`
    SELECT TIMESTAMPDIFF(SECOND, MAX(\`createdAt\`), NOW()) AS ageSeconds
    FROM \`EmailVerifyCode\` WHERE \`email\` = ${email}`
  if (last?.ageSeconds != null && Number(last.ageSeconds) < 60) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS', '请求过于频繁，请 60 秒后再试')
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0')
  const codeHash = hashCode(email, code)
  // 作废旧码，保证同邮箱始终只有一条待验证码（与 PasswordResetCode 同策略）
  await prisma.$executeRaw`
    UPDATE \`EmailVerifyCode\` SET \`active\` = 0, \`used\` = 1
    WHERE \`email\` = ${email} AND \`active\` = 1`
  await prisma.$executeRaw`
    INSERT INTO \`EmailVerifyCode\` (\`email\`, \`codeHash\`, \`expiresAt\`, \`used\`, \`active\`)
    VALUES (${email}, ${codeHash}, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, 1)`

  try {
    await sendMail({
      to: email,
      subject: '番茄时钟 - 邮箱验证',
      text: `您的验证码是：${code}，10 分钟内有效。若非本人操作请忽略。`,
    })
  } catch (err) {
    console.error('[mail] verify-code send failed', err)
    try {
      await prisma.$executeRaw`
        DELETE FROM \`EmailVerifyCode\` WHERE \`email\` = ${email} ORDER BY \`id\` DESC LIMIT 1`
    } catch (rollbackErr) {
      console.error('[mail] verify-code rollback failed', rollbackErr)
    }
    throw new HttpError(500, 'MAIL_FAILED', '邮件发送失败，请稍后重试')
  }
}

/** 校验邮箱所有权验证码（仅认 active=1 的最新一条），校验成功后立即作废 */
async function verifyEmailCode(email: string, code: string) {
  await ensureEmailVerifyTable()
  const codeHash = hashCode(email, code)
  const [row] = await prisma.$queryRaw<{ id: number; expiresInSeconds: number | null; used: number }[]>`
    SELECT \`id\`, \`used\`, TIMESTAMPDIFF(SECOND, \`expiresAt\`, NOW()) AS expiresInSeconds
    FROM \`EmailVerifyCode\`
    WHERE \`email\` = ${email} AND \`codeHash\` = ${codeHash} AND \`active\` = 1
    ORDER BY \`id\` DESC LIMIT 1`
  if (!row) throw new HttpError(400, 'INVALID_CODE', '验证码错误')
  if (row.used) throw new HttpError(400, 'CODE_USED', '该验证码已被使用')
  // TIMESTAMPDIFF(SECOND, expiresAt, NOW()) = NOW - expiresAt：未过期时为负值，过期后 >= 0
  if (row.expiresInSeconds == null || Number(row.expiresInSeconds) >= 0) {
    throw new HttpError(400, 'CODE_EXPIRED', '验证码已过期')
  }
  await prisma.$executeRaw`UPDATE \`EmailVerifyCode\` SET \`used\` = 1, \`active\` = 0 WHERE \`id\` = ${row.id}`
}

/* ===================== 主邮箱迁移 / 备用邮箱 ===================== */

/** 读取当前用户基本信息（主邮箱 / 昵称） */
async function findUserRow(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  })
}

/** 更换主邮箱 - 第一步：向新邮箱发送所有权验证码（需登录） */
export async function changeEmail(userId: number, newEmail: string) {
  const user = await findUserRow(userId)
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  const e = newEmail.trim()
  if (e === user.email) throw new HttpError(400, 'SAME_EMAIL', '新邮箱与当前邮箱相同')
  const taken = await prisma.user.findUnique({ where: { email: e } })
  if (taken && taken.id !== userId) throw new HttpError(409, 'EMAIL_TAKEN', '该邮箱已被使用')
  await sendEmailVerifyCode(e)
  return { ok: true }
}

/** 更换主邮箱 - 第二步：校验新邮箱验证码，更新主邮箱并递增会话版本（踢掉所有旧 token） */
export async function confirmChangeEmail(userId: number, newEmail: string, code: string) {
  const user = await findUserRow(userId)
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  const e = newEmail.trim()
  if (e === user.email) throw new HttpError(400, 'SAME_EMAIL', '新邮箱与当前邮箱相同')
  await verifyEmailCode(e, code)
  // 并发兜底：确认时再次检查新邮箱未被占用
  const taken = await prisma.user.findUnique({ where: { email: e } })
  if (taken && taken.id !== userId) throw new HttpError(409, 'EMAIL_TAKEN', '该邮箱已被使用')

  await prisma.$executeRaw`
    UPDATE \`User\` SET \`email\` = ${e}, \`sessionVersion\` = \`sessionVersion\` + 1 WHERE id = ${userId}`
  const [row] = await prisma.$queryRaw<{ sessionVersion: number }[]>`
    SELECT \`sessionVersion\` FROM \`User\` WHERE id = ${userId}`
  const nextVersion = Number(row?.sessionVersion ?? 0)
  // 签发新 token（携带新版本号），前端替换存储后无需重新登录
  const token = jwt.sign({ userId, sessionVersion: nextVersion }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  })
  const updated = await findUserRow(userId)
  return { token, user: updated }
}

