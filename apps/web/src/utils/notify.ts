let audioCtx: AudioContext | null = null

/** 播放提示音（Web Audio 合成双音，无需音频文件） */
export function playSound() {
  try {
    audioCtx ??= new AudioContext()
    const ctx = audioCtx
    const now = ctx.currentTime
    const notes = [880, 1174.66]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })
  } catch {
    /* 音频不可用时静默失败 */
  }
}

/** 请求浏览器通知权限 */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

/** 发送浏览器通知 */
export function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      /* 忽略通知失败 */
    }
  }
}

/** 番茄结束时的综合提醒 */
export function alertModeFinished(title: string, body: string, withSound: boolean) {
  if (withSound) playSound()
  notify(title, body)
}
