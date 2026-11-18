export const W = 1280
export const H = 720
export const FPS = 30
export const VIDEO_BPS = 1_500_000

const CANDIDATES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export function supportReport() {
  if (typeof MediaRecorder === 'undefined') return []
  return CANDIDATES.map((t) => ({ type: t, ok: MediaRecorder.isTypeSupported(t) }))
}

export function pickMime(): string | null {
  return supportReport().find((r) => r.ok)?.type ?? null
}

export type Source = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement

export type Scene = {
  dur: number
  source: Source
  isVideo?: boolean
  audio?: AudioBuffer
}

/** 가운데 맞춰 꽉 채우기(cover) + 천천히 확대 */
export function drawCover(ctx: CanvasRenderingContext2D, src: Source, zoom = 1) {
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src instanceof HTMLVideoElement ? src.videoWidth : src.width
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src instanceof HTMLVideoElement ? src.videoHeight : src.height
  if (!sw || !sh) return
  const s = Math.max(W / sw, H / sh) * zoom
  const dw = sw * s
  const dh = sh * s
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

/** 사진이 없을 때 쓰는 그림 */
export function placeholder(label: string, hue: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, `hsl(${hue},80%,70%)`)
  grad.addColorStop(1, `hsl(${hue + 60},80%,55%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(255,255,255,.9)'
  g.font = 'bold 120px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, W / 2, H / 2)
  return c
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = URL.createObjectURL(file)
  })
}

export function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement('video')
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => res(v)
    v.onerror = rej
    v.src = URL.createObjectURL(file)
  })
}

export async function decodeAudio(ac: AudioContext, blob: Blob) {
  return ac.decodeAudioData(await blob.arrayBuffer())
}

/** 시험용 짧은 멜로디 */
export function melody(ac: AudioContext, seconds: number): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate)
  const d = buf.getChannelData(0)
  const notes = [262, 294, 330, 349, 392, 349, 330, 294]
  for (let i = 0; i < d.length; i++) {
    const t = i / ac.sampleRate
    const n = notes[Math.floor(t * 2) % notes.length]
    const env = 1 - ((t * 2) % 1)
    d[i] = Math.sin(2 * Math.PI * n * t) * 0.2 * env
  }
  return buf
}

export type Result = {
  blob: Blob
  mime: string
  sizeMB: number
  seconds: number
  tookSec: number
}

/**
 * 장면들을 하나의 캔버스에 그리며 실시간 녹화한다.
 * (Phase 6의 renderFrame과 같은 구조로 키울 시험용 버전)
 */
export async function recordScenes(
  scenes: Scene[],
  bgAudio: AudioBuffer | null,
  onProgress: (p: number) => void,
  videoBps = VIDEO_BPS,
): Promise<Result> {
  const mime = pickMime()
  if (!mime) throw new Error('이 태블릿은 영상 녹화(MediaRecorder)를 지원하지 않아요')

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const ac = new AudioContext()
  await ac.resume()
  const dest = ac.createMediaStreamDestination()

  const total = scenes.reduce((a, s) => a + s.dur, 0)
  const stream = canvas.captureStream(FPS)
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: videoBps,
    audioBitsPerSecond: 128_000,
  })
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()))

  let wake: WakeLockSentinel | null = null
  try { wake = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* 무시 */ }

  // 장면별 소리 예약
  const t0 = ac.currentTime + 0.2
  let acc = 0
  const videoNodes = new Map<HTMLVideoElement, boolean>()
  for (const s of scenes) {
    if (s.audio) {
      const n = ac.createBufferSource()
      n.buffer = s.audio
      n.connect(dest)
      n.start(t0 + acc)
    }
    if (s.isVideo && s.source instanceof HTMLVideoElement && !videoNodes.has(s.source)) {
      try { ac.createMediaElementSource(s.source).connect(dest) } catch { /* 이미 연결됨 */ }
      videoNodes.set(s.source, true)
    }
    acc += s.dur
  }
  if (bgAudio) {
    const n = ac.createBufferSource()
    n.buffer = bgAudio
    n.connect(dest)
    n.start(t0)
  }

  const started = performance.now()
  rec.start(1000)
  let started_scene = -1

  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - started) / 1000
      if (t >= total) return resolve()
      let a = 0
      let idx = 0
      for (; idx < scenes.length; idx++) {
        if (t < a + scenes[idx].dur) break
        a += scenes[idx].dur
      }
      const s = scenes[idx]
      const local = t - a
      if (idx !== started_scene) {
        started_scene = idx
        if (s.isVideo && s.source instanceof HTMLVideoElement) {
          s.source.currentTime = 0
          s.source.muted = false
          s.source.play().catch(() => {})
        }
      }
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      drawCover(ctx, s.source, s.isVideo ? 1 : 1 + 0.06 * (local / s.dur))
      // 장면 사이 0.6초 페이드(책장 넘김의 시험용 대체)
      if (local < 0.6 && idx > 0) {
        ctx.fillStyle = `rgba(255,255,255,${1 - local / 0.6})`
        ctx.fillRect(0, 0, W, H)
      }
      onProgress(t / total)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  scenes.forEach((s) => s.source instanceof HTMLVideoElement && s.source.pause())
  rec.stop()
  await stopped
  stream.getTracks().forEach((t) => t.stop())
  await ac.close()
  await wake?.release().catch(() => {})
  onProgress(1)

  const blob = new Blob(chunks, { type: mime.split(';')[0] })
  return {
    blob,
    mime,
    sizeMB: blob.size / 1024 / 1024,
    seconds: total,
    tookSec: (performance.now() - started) / 1000,
  }
}
