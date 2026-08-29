import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const exists = await prisma.$queryRawUnsafe<{ COUNT: number }[]>(
    `SELECT COUNT(*) AS COUNT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'sessionVersion'`,
  )
  if (Number(exists[0]?.COUNT ?? 0) > 0) {
    console.log('[migrate] sessionVersion 已存在，跳过')
    return
  }
  await prisma.$executeRawUnsafe(
    'ALTER TABLE `User` ADD COLUMN `sessionVersion` INT NOT NULL DEFAULT 0;',
  )
  console.log('[migrate] 已为 User 添加 sessionVersion 列')
}

main()
  .catch((err) => {
    console.error('[migrate] 失败:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
