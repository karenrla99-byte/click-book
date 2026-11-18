// 움직이는 그림책 렌더러 — 미리보기와 MP4가 똑같이 보이도록 이 파일 하나로 그린다.
import { FlatCard, Template, flatCards, placeOf } from './template'
import { Greeting, MediaItem, Project, SceneEdit, Sticker, getBlob } from './store'

export const W = 1280
export const H = 720
export const TURN = 0.6 // 책장 넘김 전환(초)
export const COPYRIGHT = '© 2026 특수교사 은티 · @special_eun_t'
const FONT = '"SchoolSafetyRoundedSmile", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
const DISPLAY = '"SchoolSafetyFreeTime", "SchoolSafetyRoundedSmile", sans-serif'
const C = { paper: '#fffcf5', ink: '#4a4239', soft: '#9a8f82', line: 'rgba(176,190,204,.28)', hi: 'rgba(244,226,180,.9)' }

/** 캔버스는 글꼴이 다 받아진 뒤에 그려야 해서 미리 불러 둔다 */
export async function loadFonts() {
  if (!document.fonts?.load) return
  const t = new Promise((r) => setTimeout(r, 5000))
  await Promise.race([t, Promise.all([
    document.fonts.load('40px "SchoolSafetyRoundedSmile"'),
    document.fonts.load('bold 40px "SchoolSafetyRoundedSmile"'),
    document.fonts.load('40px "SchoolSafetyFreeTime"'),
  ]).catch(() => {})])
}

let noise: HTMLCanvasElement | null = null
/** 종이 바탕 (크림색 + 잔 무늬) */
function paper(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, W, H)
  if (!noise) {
    noise = document.createElement('canvas')
    noise.width = noise.height = 160
    const g = noise.getContext('2d')!
    const d = g.createImageData(160, 160)
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 90 + Math.random() * 60
      d.data[i] = v; d.data[i + 1] = v * 0.9; d.data[i + 2] = v * 0.75; d.data[i + 3] = Math.random() * 12
    }
    g.putImageData(d, 0, 0)
  }
  ctx.fillStyle = ctx.createPattern(noise, 'repeat')!
  ctx.fillRect(0, 0, W, H)
  // 일기장 줄
  ctx.fillStyle = C.line
  for (let y = 70; y < H; y += 56) ctx.fillRect(0, y, W, 1.5)
}

/** 형광펜 밑줄 */
function highlight(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number) {
  const w = ctx.measureText(text).width
  ctx.fillStyle = C.hi
  ctx.fillRect(cx - w / 2 - 8, cy + size * 0.05, w + 16, size * 0.38)
}


type Img = ImageBitmap | HTMLImageElement | HTMLCanvasElement

export type Assets = {
  images: Map<string, Img>
  videos: Map<string, HTMLVideoElement>
  audio: Map<string, AudioBuffer>
  urls: string[]
}

export type TScene =
  | { kind: 'opening'; dur: number; mediaKey: string; isVideo: boolean }
  | { kind: 'title'; dur: number; title: string; name: string }
  | { kind: 'card'; dur: number; card: FlatCard; edit: SceneEdit; media?: MediaItem }
  | { kind: 'greeting'; dur: number; prompt: string; greeting: Greeting; name: string }
  | { kind: 'credits'; dur: number; title: string; byline: string; thumbs: string[] }

export function disposeAssets(a: Assets | null | undefined) {
  if (!a) return
  a.videos.forEach((v) => { v.pause(); v.removeAttribute('src'); v.load() })
  a.urls.forEach((u) => URL.revokeObjectURL(u))
  a.images.forEach((i) => { if ('close' in i) i.close() })
}

async function toImage(blob: Blob): Promise<Img> {
  let bmp = await createImageBitmap(blob)
  if (bmp.width > 1600) {
    const w = 1600
    const h = Math.round((bmp.height / bmp.width) * w)
    bmp.close()
    bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
  }
  return bmp
}

async function toVideo(blob: Blob, urls: string[]): Promise<HTMLVideoElement> {
  const v = document.createElement('video')
  v.playsInline = true
  v.preload = 'auto'
  const url = URL.createObjectURL(blob)
  urls.push(url)
  v.src = url
  await new Promise<void>((res) => {
    const done = () => res()
    v.addEventListener('loadeddata', done, { once: true })
    v.addEventListener('error', done, { once: true })
    setTimeout(done, 8000)
  })
  // MediaRecorder로 찍은 webm은 길이가 Infinity로 나오는 경우가 있어 끝으로 한 번 이동해 길이를 알아낸다
  if (!Number.isFinite(v.duration)) {
    await new Promise<void>((res) => {
      const t = setTimeout(res, 3000)
      v.addEventListener('durationchange', () => { if (Number.isFinite(v.duration)) { clearTimeout(t); res() } })
      v.currentTime = 1e6
    })
    v.currentTime = 0
  }
  return v
}

export function videoDuration(v: HTMLVideoElement | undefined, fallback?: number) {
  if (v && Number.isFinite(v.duration) && v.duration > 0) return v.duration
  return fallback ?? 4
}

/** 학생 작업에 쓰인 사진·영상·녹음을 불러온다 (태블릿 안 IndexedDB에서만) */
export async function loadAssets(
  ns: string, project: Project, template: Template, ac: BaseAudioContext, opening?: Blob | null,
): Promise<Assets> {
  const a: Assets = { images: new Map(), videos: new Map(), audio: new Map(), urls: [] }
  await loadFonts()
  const cardIds = new Set(flatCards(template.data).map((c) => c.id))
  const jobs: Promise<void>[] = []
  const decode = async (id: string) => {
    const b = await getBlob(ns, id)
    if (!b) return
    try { a.audio.set(id, await ac.decodeAudioData(await b.arrayBuffer())) } catch { /* 소리 못 읽음 */ }
  }
  for (const [cardId, s] of Object.entries(project.scenes)) {
    if (!cardIds.has(cardId)) continue
    const m = project.media.find((x) => x.id === s.mediaId)
    if (m) jobs.push((async () => {
      const b = await getBlob(ns, m.id)
      if (!b) return
      if (m.kind === 'photo') a.images.set(m.id, await toImage(b))
      else a.videos.set(m.id, await toVideo(b, a.urls))
    })())
    if (s.voiceId) jobs.push(decode(s.voiceId))
    for (const st of s.stickers) if (st.kind === 'face' && st.blobId) {
      const id = st.blobId
      jobs.push((async () => { const b = await getBlob(ns, id); if (b) a.images.set(id, await toImage(b)) })())
    }
  }
  const g = project.greeting
  if (g) jobs.push((async () => {
    const b = await getBlob(ns, g.blobId)
    if (!b) return
    if (g.kind === 'video') a.videos.set(g.blobId, await toVideo(b, a.urls))
    else await decode(g.blobId)
  })())
  if (opening) jobs.push((async () => {
    if (opening.type.startsWith('video')) a.videos.set('opening', await toVideo(opening, a.urls))
    else a.images.set('opening', await toImage(opening))
  })())
  // 파일 하나가 깨져도 나머지로 계속 (그 장면만 빠짐)
  await Promise.all(jobs.map((j) => j.catch(() => {})))
  return a
}

export function sceneDuration(edit: SceneEdit, media: MediaItem | undefined, assets: Assets) {
  let d = 4
  if (media?.kind === 'video') d = Math.max(d, videoDuration(assets.videos.get(media.id), media.duration))
  const voice = edit.voiceId ? assets.audio.get(edit.voiceId) : undefined
  if (voice) d = Math.max(d, voice.duration + 0.5)
  return d
}

export function buildTimeline(o: {
  template: Template; project: Project; assets: Assets; studentName: string; roomName: string
}): TScene[] {
  const { template, project, assets } = o
  const tl: TScene[] = []
  if (assets.videos.has('opening')) tl.push({ kind: 'opening', dur: videoDuration(assets.videos.get('opening'), 5), mediaKey: 'opening', isVideo: true })
  else if (assets.images.has('opening')) tl.push({ kind: 'opening', dur: 4, mediaKey: 'opening', isVideo: false })
  tl.push({ kind: 'title', dur: 3, title: template.title, name: o.studentName })
  const thumbs: string[] = []
  for (const card of flatCards(template.data)) {
    const edit = project.scenes[card.id]
    if (!edit) continue
    const media = project.media.find((m) => m.id === edit.mediaId)
    const hasMedia = media && (assets.images.has(media.id) || assets.videos.has(media.id))
    const hasVoice = edit.voiceId && assets.audio.has(edit.voiceId)
    if (!hasMedia && !hasVoice) continue
    if (media?.kind === 'photo' && thumbs.length < 6) thumbs.push(media.id)
    tl.push({ kind: 'card', dur: sceneDuration(edit, hasMedia ? media : undefined, assets), card, edit, media: hasMedia ? media : undefined })
  }
  const g = project.greeting
  if (g && (assets.videos.has(g.blobId) || assets.audio.has(g.blobId))) {
    const dur = g.kind === 'video'
      ? videoDuration(assets.videos.get(g.blobId), g.duration) + 0.3
      : Math.max(4, (assets.audio.get(g.blobId)?.duration ?? 3) + 0.8)
    tl.push({ kind: 'greeting', dur, prompt: template.data.greeting, greeting: g, name: o.studentName })
  }
  tl.push({ kind: 'credits', dur: 5, title: template.title, byline: `만든 사람: ${o.roomName} ${o.studentName}`, thumbs })
  return tl
}

export const totalOf = (tl: TScene[]) => tl.reduce((s, x) => s + x.dur, 0)

export function locate(tl: TScene[], t: number) {
  let a = 0
  for (let i = 0; i < tl.length; i++) {
    if (t < a + tl[i].dur || i === tl.length - 1) return { idx: i, local: Math.max(0, Math.min(t - a, tl[i].dur)), start: a }
    a += tl[i].dur
  }
  return { idx: 0, local: 0, start: 0 }
}

// ───────── 그리기 도우미 ─────────
function srcSize(s: Img | HTMLVideoElement) {
  if (s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight]
  if (s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight]
  return [s.width, s.height]
}
export function drawCover(ctx: CanvasRenderingContext2D, s: Img | HTMLVideoElement, zoom = 1, panX = 0, panY = 0) {
  const [sw, sh] = srcSize(s)
  if (!sw || !sh) return
  const k = Math.max(W / sw, H / sh) * zoom
  const dw = sw * k
  const dh = sh * k
  ctx.drawImage(s, (W - dw) / 2 + panX, (H - dh) / 2 + panY, dw, dh)
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 3): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const tryLine = cur ? cur + ' ' + word : word
    if (ctx.measureText(tryLine).width <= maxW) { cur = tryLine; continue }
    if (cur) lines.push(cur)
    cur = word
    while (ctx.measureText(cur).width > maxW && cur.length > 1) {
      let i = cur.length
      while (i > 1 && ctx.measureText(cur.slice(0, i)).width > maxW) i--
      lines.push(cur.slice(0, i))
      cur = cur.slice(i)
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…' }
  return lines
}

function textBox(ctx: CanvasRenderingContext2D, text: string, opt: { y: number; size: number; bg: string; fg: string; anchor: 'top' | 'bottom'; maxLines?: number; display?: boolean; border?: string }) {
  if (!text) return
  ctx.font = opt.display ? `${opt.size}px ${DISPLAY}` : `bold ${opt.size}px ${FONT}`
  const lines = wrap(ctx, text, W - 200, opt.maxLines ?? 2)
  const lh = opt.size * 1.3
  const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64
  const bh = lines.length * lh + 36
  const bx = (W - bw) / 2
  const by = opt.anchor === 'top' ? opt.y : opt.y - bh
  ctx.fillStyle = opt.bg
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, [26, 12, 24, 14])
  ctx.fill()
  if (opt.border) { ctx.strokeStyle = opt.border; ctx.lineWidth = 4; ctx.stroke() }
  ctx.fillStyle = opt.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, W / 2, by + 18 + lh * i + lh / 2))
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeBack = (p: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2) }

export function drawSticker(ctx: CanvasRenderingContext2D, s: Sticker, local: number, assets: Assets) {
  const size = s.size * H
  let cx = s.x * W
  let cy = s.y * H
  let rot = 0
  let scale = 1
  let alpha = 1
  switch (s.effect) {
    case 'bounce':
      cy -= Math.abs(Math.sin(local * Math.PI * 1.5)) * 0.07 * H
      break
    case 'walkIn': {
      const p = Math.min(1, local / 1.6)
      cx = -size + (cx + size) * easeOut(p)
      if (p < 1) { cy -= Math.abs(Math.sin(local * 9)) * 0.02 * H; rot = Math.sin(local * 9) * 0.1 }
      break
    }
    case 'sparkle': {
      const p = Math.min(1, local / 0.7)
      scale = Math.max(0.01, easeBack(p))
      alpha = Math.min(1, p * 2)
      break
    }
    case 'wiggle':
      rot = Math.sin(local * 7) * 0.2
      break
  }
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.scale(scale, scale)
  if (s.kind === 'emoji' && s.emoji) {
    ctx.font = `${size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.emoji, 0, size * 0.05)
  } else if (s.kind === 'face' && s.blobId) {
    const img = assets.images.get(s.blobId)
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, -size / 2, -size / 2, size, size)
      ctx.restore()
      ctx.lineWidth = Math.max(4, size * 0.04)
      ctx.strokeStyle = '#fff'
      ctx.beginPath()
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
  if (s.effect === 'sparkle') {
    ctx.save()
    ctx.font = `${size * 0.3}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 4; i++) {
      const a = local * 1.5 + (i * Math.PI) / 2
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(local * 6 + i)
      ctx.fillText('✨', s.x * W + Math.cos(a) * size * 0.7, s.y * H + Math.sin(a) * size * 0.7)
    }
    ctx.restore()
  }
}

/** 장면 하나 그리기 */
export function drawScene(ctx: CanvasRenderingContext2D, sc: TScene, local: number, assets: Assets) {
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  switch (sc.kind) {
    case 'opening': {
      const s = sc.isVideo ? assets.videos.get(sc.mediaKey) : assets.images.get(sc.mediaKey)
      if (s) drawCover(ctx, s, sc.isVideo ? 1 : 1 + 0.05 * (local / sc.dur))
      break
    }
    case 'title': {
      paper(ctx)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = C.soft
      ctx.font = `bold 28px ${FONT}`
      ctx.fillText('찰칵 그림책', W / 2, 140)
      ctx.font = `84px ${DISPLAY}`
      const lines = wrap(ctx, sc.title, W - 200, 2)
      lines.forEach((l, i) => {
        const y = 290 + i * 104 - (lines.length - 1) * 40
        highlight(ctx, l, W / 2, y, 84)
        ctx.fillStyle = C.ink
        ctx.fillText(l, W / 2, y)
      })
      ctx.fillStyle = C.soft
      ctx.font = `54px ${DISPLAY}`
      ctx.fillText(`${sc.name}의 그림책`, W / 2, 520)
      break
    }
    case 'card': {
      const m = sc.media
      if (m?.kind === 'photo') {
        const img = assets.images.get(m.id)
        const p = local / sc.dur
        if (img) sc.edit.kenBurns ? drawCover(ctx, img, 1.02 + 0.12 * p, -40 * p, -20 * p) : drawCover(ctx, img)
      } else if (m?.kind === 'video') {
        const v = assets.videos.get(m.id)
        if (v) drawCover(ctx, v)
      } else {
        paper(ctx)
        const pl = placeOf(sc.card.place)
        ctx.font = `260px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(pl?.icon ?? '🎤', W / 2, H / 2 + 20)
      }
      for (const st of sc.edit.stickers) drawSticker(ctx, st, local, assets)
      textBox(ctx, sc.card.text, { y: 24, size: 42, bg: 'rgba(255,252,245,.95)', fg: C.ink, anchor: 'top', display: true, border: '#d8cdbb' })
      const sub = (sc.edit.text?.trim() || sc.edit.words.join(' · '))
      textBox(ctx, sub, { y: H - 28, size: 50, bg: 'rgba(74,66,57,.78)', fg: '#fffcf5', anchor: 'bottom' })
      break
    }
    case 'greeting': {
      if (sc.greeting.kind === 'video') {
        const v = assets.videos.get(sc.greeting.blobId)
        if (v) drawCover(ctx, v)
      } else {
        paper(ctx)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const pulse = 1 + 0.08 * Math.sin(local * 5)
        ctx.font = `${200 * pulse}px ${FONT}`
        ctx.fillText('🎤', W / 2, H * 0.45)
        ctx.fillStyle = C.ink
        ctx.font = `60px ${DISPLAY}`
        ctx.fillText(`${sc.name}의 인사`, W / 2, H * 0.75)
      }
      textBox(ctx, sc.prompt, { y: 24, size: 42, bg: 'rgba(255,252,245,.95)', fg: C.ink, anchor: 'top', display: true, border: '#d8cdbb' })
      break
    }
    case 'credits': {
      paper(ctx)
      const a = Math.min(1, local / 0.8)
      ctx.globalAlpha = a
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = C.soft
      ctx.font = `bold 28px ${FONT}`
      ctx.fillText('찰칵 그림책', W / 2, 96)
      ctx.fillStyle = C.ink
      ctx.font = `50px ${DISPLAY}`
      ctx.fillText(sc.title, W / 2, 170)
      ctx.font = `60px ${DISPLAY}`
      highlight(ctx, sc.byline, W / 2, 255, 60)
      ctx.fillStyle = C.ink
      ctx.fillText(sc.byline, W / 2, 255)
      const n = sc.thumbs.length
      if (n) {
        const tw = 160
        const th = 110
        const gap = 26
        const x0 = (W - (n * tw + (n - 1) * gap)) / 2
        sc.thumbs.forEach((id, i) => {
          const img = assets.images.get(id)
          if (!img) return
          const x = x0 + i * (tw + gap)
          ctx.save()
          ctx.translate(x + tw / 2, 400)
          ctx.rotate((i % 2 ? 1 : -1) * 0.04)
          ctx.shadowColor = 'rgba(0,0,0,.2)'
          ctx.shadowBlur = 10
          ctx.fillStyle = '#fff'
          ctx.fillRect(-tw / 2 - 8, -th / 2 - 8, tw + 16, th + 16)
          ctx.shadowColor = 'transparent'
          ctx.beginPath()
          ctx.rect(-tw / 2, -th / 2, tw, th)
          ctx.clip()
          const [sw, sh] = srcSize(img)
          const k = Math.max(tw / sw, th / sh)
          ctx.drawImage(img, -sw * k / 2, -sh * k / 2, sw * k, sh * k)
          ctx.restore()
          ctx.save()
          ctx.fillStyle = 'rgba(232,218,186,.85)'
          ctx.translate(x + tw / 2, 400 - th / 2 - 10)
          ctx.rotate(-0.05)
          ctx.fillRect(-26, -9, 52, 18)
          ctx.restore()
        })
      }
      ctx.fillStyle = C.soft
      ctx.font = `26px ${FONT}`
      ctx.fillText(COPYRIGHT, W / 2, H - 60)
      break
    }
  }
  ctx.restore()
}

export type FrameCache = Map<number, HTMLCanvasElement>

/** t초의 화면 (책장 넘김 포함) */
export function renderFrame(ctx: CanvasRenderingContext2D, tl: TScene[], assets: Assets, t: number, cache: FrameCache) {
  const { idx, local } = locate(tl, t)
  drawScene(ctx, tl[idx], local, assets)
  if (idx === 0 || local >= TURN) return
  let prev = cache.get(idx - 1)
  if (!prev) {
    prev = document.createElement('canvas')
    prev.width = W
    prev.height = H
    drawScene(prev.getContext('2d')!, tl[idx - 1], tl[idx - 1].dur, assets)
    cache.clear()
    cache.set(idx - 1, prev)
  }
  // 오른쪽에서 왼쪽으로 책장이 넘어가는 모양
  const p = easeOut(local / TURN)
  const edge = W * (1 - p)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, edge, H)
  ctx.clip()
  ctx.drawImage(prev, 0, 0)
  ctx.restore()
  const curl = Math.min(140, W * p * 0.25 + 20)
  const g = ctx.createLinearGradient(edge - curl, 0, edge, 0)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.7, 'rgba(0,0,0,.18)')
  g.addColorStop(1, 'rgba(255,255,255,.85)')
  ctx.fillStyle = g
  ctx.fillRect(edge - curl, 0, curl, H)
  const s = ctx.createLinearGradient(edge, 0, edge + 60, 0)
  s.addColorStop(0, 'rgba(0,0,0,.35)')
  s.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = s
  ctx.fillRect(edge, 0, 60, H)
}

/** 소리·영상을 시계(AudioContext)에 맞춰 재생 — 미리보기와 MP4 녹화에 같이 씀 */
export class Player {
  readonly total: number
  private starts: number[] = []
  private sources: AudioBufferSourceNode[] = []
  private t0 = 0
  private pausedAt = 0
  playing = false
  cache: FrameCache = new Map()

  constructor(readonly tl: TScene[], readonly assets: Assets, readonly ac: AudioContext, readonly dest: AudioNode) {
    let a = 0
    for (const s of tl) { this.starts.push(a); a += s.dur }
    this.total = a
    assets.videos.forEach((v) => {
      try { ac.createMediaElementSource(v).connect(dest) } catch { /* 이미 연결됨 */ }
    })
  }

  private sceneAudio(sc: TScene): AudioBuffer | undefined {
    if (sc.kind === 'card' && sc.edit.voiceId) return this.assets.audio.get(sc.edit.voiceId)
    if (sc.kind === 'greeting' && sc.greeting.kind === 'audio') return this.assets.audio.get(sc.greeting.blobId)
    return undefined
  }
  private sceneVideo(sc: TScene): HTMLVideoElement | undefined {
    if (sc.kind === 'opening' && sc.isVideo) return this.assets.videos.get(sc.mediaKey)
    if (sc.kind === 'card' && sc.media?.kind === 'video') return this.assets.videos.get(sc.media.id)
    if (sc.kind === 'greeting' && sc.greeting.kind === 'video') return this.assets.videos.get(sc.greeting.blobId)
    return undefined
  }

  async play(from = this.pausedAt) {
    if (from >= this.total) from = 0
    await this.ac.resume()
    this.stopAudio()
    this.cache.clear()
    const now = this.ac.currentTime + 0.05
    this.t0 = now - from
    this.tl.forEach((sc, i) => {
      const buf = this.sceneAudio(sc)
      if (!buf) return
      const start = this.starts[i] + (sc.kind === 'greeting' ? 0.3 : 0.2)
      if (start + buf.duration <= from) return
      const n = this.ac.createBufferSource()
      n.buffer = buf
      n.connect(this.dest)
      if (from > start) n.start(now, from - start)
      else n.start(this.t0 + start)
      this.sources.push(n)
    })
    this.playing = true
  }

  time() {
    return this.playing ? Math.max(0, this.ac.currentTime - this.t0) : this.pausedAt
  }

  pause() {
    this.pausedAt = this.time()
    this.playing = false
    this.stopAudio()
    this.assets.videos.forEach((v) => v.pause())
  }

  private stopAudio() {
    this.sources.forEach((s) => { try { s.stop() } catch { /* 무시 */ } })
    this.sources = []
  }

  /** 지금 장면의 영상만 재생, 나머지는 멈춤 */
  syncVideos(t: number) {
    const { idx, local } = locate(this.tl, t)
    const active = this.playing ? this.sceneVideo(this.tl[idx]) : undefined
    this.assets.videos.forEach((v) => {
      if (v !== active) { if (!v.paused) v.pause(); return }
      const dur = Number.isFinite(v.duration) ? v.duration : Infinity
      if (local >= dur) return
      if (v.paused) {
        v.currentTime = local
        v.play().catch(() => {})
      } else if (Math.abs(v.currentTime - local) > 0.35) {
        v.currentTime = local
      }
    })
  }

  frame(ctx: CanvasRenderingContext2D, t = this.time()) {
    this.syncVideos(t)
    renderFrame(ctx, this.tl, this.assets, Math.min(t, this.total - 0.001), this.cache)
  }

  stop() {
    this.pause()
    this.pausedAt = 0
  }
}
