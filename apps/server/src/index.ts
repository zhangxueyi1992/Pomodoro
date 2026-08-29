import { createApp } from './app.js'
import { config } from './config.js'
import { prisma } from './lib/prisma.js'

const app = createApp()

const server = app.listen(config.port, async () => {
  try {
    await prisma.$connect()
    console.log(`[server] listening on http://localhost:${config.port}`)
    console.log(`[server] database connected`)
  } catch (err) {
    console.error('[server] database connection failed:', err)
    server.close()
    process.exit(1)
  }
})

async function shutdown() {
  console.log('[server] shutting down...')
  await prisma.$disconnect()
  server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
