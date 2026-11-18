// 카메라·마이크 도우미

const CLIP_TYPES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
export function clipMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  return CLIP_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
export function audioMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  return AUDIO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export async function openCamera(facing: 'environment' | 'user', withAudio: boolean): Promise<MediaStream> {
  const video = { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: withAudio })
  } catch (e) {
    if (withAudio) return navigator.mediaDevices.getUserMedia({ video, audio: false })
    throw e
  }
}

/** 카메라 화면에서 사진 한 장 (가로 최대 1280) */
export async function snapPhoto(v: HTMLVideoElement): Promise<Blob> {
  const k = Math.min(1, 1280 / v.videoWidth)
  const c = document.createElement('canvas')
  c.width = Math.round(v.videoWidth * k)
  c.height = Math.round(v.videoHeight * k)
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('사진을 못 만들었어요'))), 'image/jpeg', 0.85))
}

/** 파일로 고른 사진을 가로 1280으로 줄이기 */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1280 / bmp.width)
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85))
}

export async function blobDuration(blob: Blob): Promise<number> {
  if (blob.type.startsWith('audio')) {
    try {
      const ac = new OfflineAudioContext(1, 1, 44100)
      return (await ac.decodeAudioData(await blob.arrayBuffer())).duration
    } catch { return 0 }
  }
  const v = document.createElement('video')
  const url = URL.createObjectURL(blob)
  v.preload = 'metadata'
  v.src = url
  const d = await new Promise<number>((res) => {
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return res(v.duration)
      v.ondurationchange = () => Number.isFinite(v.duration) && res(v.duration)
      v.currentTime = 1e6
    }
    v.onerror = () => res(0)
    setTimeout(() => res(0), 4000)
  })
  URL.revokeObjectURL(url)
  return d
}

/** 녹음기 (마이크) */
export class VoiceRecorder {
  private rec?: MediaRecorder
  private stream?: MediaStream
  private chunks: BlobPart[] = []
  startedAt = 0
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const mime = audioMime()
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined)
    this.chunks = []
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.rec.start()
    this.startedAt = Date.now()
  }
  stop(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((res) => {
      if (!this.rec) return res({ blob: new Blob(), duration: 0 })
      this.rec.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop())
        res({ blob: new Blob(this.chunks, { type: this.rec!.mimeType || 'audio/webm' }), duration: (Date.now() - this.startedAt) / 1000 })
      }
      this.rec.stop()
    })
  }
  cancel() {
    try { this.rec?.stop() } catch { /* 무시 */ }
    this.stream?.getTracks().forEach((t) => t.stop())
  }
}
