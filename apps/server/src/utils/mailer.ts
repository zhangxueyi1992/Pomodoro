import { connect, type TLSSocket } from 'node:tls'
import { config } from '../config.js'

const CRLF = '\r\n'

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
}

/** RFC 2047 编码含中文的邮件头（Subject / 发件人名） */
function encodeHeader(name: string): string {
  return `=?UTF-8?B?${b64(name)}?=`
}

/** 构造待发送的邮件正文（base64 传输，支持中文） */
function buildMessage(from: string, to: string, subject: string, text: string): string {
  const encodedBody =
    b64(text)
      .match(/.{1,76}/g)
      ?.join(CRLF) ?? ''
  const headers = [
    `From: ${`${encodeHeader('番茄时钟')} <${from}>`}`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ]
  return headers.join(CRLF)
}

export interface MailOptions {
  to: string
  subject: string
  text: string
}

interface Waiter {
  resolve: (line: string) => void
  reject: (e: Error) => void
}

/** 基于原生 TLS 的简易 SMTP 客户端（163 465 隐式 SSL），无需额外依赖 */
export async function sendMail(opts: MailOptions): Promise<void> {
  const { smtp } = config
  if (!smtp.user || !smtp.pass) {
    throw new Error('SMTP 未配置：请在 .env 中设置 SMTP_USER（完整邮箱）与 SMTP_PASS（授权码）')
  }

  const socket: TLSSocket = await new Promise((resolve, reject) => {
    const s = connect({ host: smtp.host, port: smtp.port, servername: smtp.host }, () => resolve(s))
    s.once('error', reject)
  })

  let buffer = ''
  // 已解析但尚未被消费的行队列：多行响应（250-xxx）常在同一次 data 事件中一次性到达，
  // 若只靠等待者逐行匹配，第 2 行起的行会在等待者就绪前被丢弃，导致卡住直到超时。
  let pendingLines: string[] = []
  let waiters: Waiter[] = []
  let lastError: Error | null = null

  const rejectAll = (e: Error) => {
    lastError = e
    const pending = waiters
    waiters = []
    for (const w of pending) w.reject(e)
  }

  socket.on('error', (e) => rejectAll(e))
  socket.on('close', () => {
    if (waiters.length && lastError) rejectAll(lastError)
  })

  // 把排队中的行按序派发给等待者
  const deliver = () => {
    while (pendingLines.length && waiters.length) {
      const line = pendingLines.shift() as string
      const w = waiters.shift() as Waiter
      w.resolve(line)
    }
  }

  socket.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')
    while (buffer.includes('\n')) {
      const nl = buffer.indexOf('\n')
      const line = buffer.slice(0, nl).replace(/\r$/, '')
      buffer = buffer.slice(nl + 1)
      pendingLines.push(line)
    }
    deliver()
  })

  const nextLine = () =>
    new Promise<string>((resolve, reject) => {
      if (lastError) {
        reject(lastError)
        return
      }
      if (pendingLines.length) {
        resolve(pendingLines.shift() as string)
        return
      }
      waiters.push({ resolve, reject })
    })

  const send = (line: string) => socket.write(line + CRLF)

  const readUntil = async (): Promise<string[]> => {
    const lines: string[] = []
    let line = await nextLine()
    lines.push(line)
    while (line.length >= 4 && line[3] === '-') {
      line = await nextLine()
      lines.push(line)
    }
    return lines
  }

  const guard = setTimeout(() => {
    rejectAll(new Error('SMTP 连接超时'))
    socket.destroy()
  }, 20000)

  try {
    // 220 greeting
    const greeting = await nextLine()
    if (!greeting.startsWith('220')) throw new Error(`SMTP 握手失败: ${greeting}`)

    await send(`EHLO ${smtp.host}`)
    const ehloLines = await readUntil()
    if (!ehloLines[ehloLines.length - 1].startsWith('250')) {
      throw new Error(`EHLO 失败: ${ehloLines.join(' ')}`)
    }

    await send(`AUTH PLAIN ${b64(`\0${smtp.user}\0${smtp.pass}`)}`)
    const authLine = await nextLine()
    if (!authLine.startsWith('235')) throw new Error(`认证失败: ${authLine}`)

    await send(`MAIL FROM:<${smtp.user}>`)
    const mailFrom = await nextLine()
    if (!mailFrom.startsWith('250')) throw new Error(`MAIL FROM 失败: ${mailFrom}`)

    await send(`RCPT TO:<${opts.to}>`)
    const rcpt = await nextLine()
    if (!rcpt.startsWith('250')) throw new Error(`RCPT TO 失败: ${rcpt}`)

    await send('DATA')
    const data = await nextLine()
    if (!data.startsWith('354')) throw new Error(`DATA 失败: ${data}`)

    const message = buildMessage(smtp.from || smtp.user, opts.to, opts.subject, opts.text)
    socket.write(message + CRLF + '.' + CRLF)
    const queued = await nextLine()
    if (!queued.startsWith('250')) throw new Error(`邮件投递失败: ${queued}`)

    await send('QUIT')
    await nextLine()
  } finally {
    clearTimeout(guard)
    socket.destroy()
  }
}
