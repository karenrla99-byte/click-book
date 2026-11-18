import { pickMime } from './mp4'
import { Assets, H, Player, TScene, W } from './render'

export type Made = { blob: Blob; mime: string; ext: 'mp4' | 'webm'; duration: number }

/** 장면들을 실시간으로 그리며 녹화 (영상 길이만큼 걸림) */
export async function recordTimeline(
  tl: TScene[], assets: Assets, onProgress: (p: number) => void, videoBps = 1_500_000,
): Promise<Made> {
  const mime = pickMime()
  if (!mime) throw new Error('이 태블릿은 영상 만들기를 지원하지 않아요')
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const ac = new AudioContext()
  const dest = ac.createMediaStreamDestination()
  const player = new Player(tl, assets, ac, dest)

  const stream = canvas.captureStream(30)
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: videoBps, audioBitsPerSecond: 96_000 })
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const stopped = new Promise<void>((r) => { rec.onstop = () => r() })

  let wake: WakeLockSentinel | null = null
  try { wake = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* 무시 */ }

  player.frame(ctx, 0)
  rec.start(1000)
  await player.play(0)
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = player.time()
      if (t >= player.total) return resolve()
      player.frame(ctx, t)
      onProgress(t / player.total)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  player.frame(ctx, player.total)
  player.stop()
  rec.stop()
  await stopped
  stream.getTracks().forEach((t) => t.stop())
  await ac.close()
  await wake?.release().catch(() => {})
  onProgress(1)
  const type = mime.split(';')[0]
  return { blob: new Blob(chunks, { type }), mime, ext: type === 'video/mp4' ? 'mp4' : 'webm', duration: player.total }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
