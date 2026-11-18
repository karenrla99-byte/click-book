import { useEffect, useRef, useState } from 'react'
import { blobDuration, clipMime, openCamera, shrinkImage, snapPhoto } from '../lib/media'

type Props = {
  mode: 'photo' | 'video' | 'both'
  facing?: 'environment' | 'user'
  maxSec?: number
  onPhoto?: (b: Blob) => void
  onVideo?: (b: Blob, duration: number) => void
}

export default function Camera({ mode, facing: initial = 'environment', maxSec = 10, onPhoto, onVideo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState(initial)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [failed, setFailed] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const rec = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    let live = true
    let s: MediaStream | null = null
    setFailed(false)
    openCamera(facing, mode !== 'photo')
      .then((st) => {
        if (!live) { st.getTracks().forEach((t) => t.stop()); return }
        s = st
        setStream(st)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
      try { rec.current?.stop() } catch { /* 무시 */ }
      s?.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [facing, mode])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  const photo = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
    onPhoto?.(await snapPhoto(v))
  }

  const startVideo = () => {
    if (!stream) return
    const mime = clipMime()
    const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000 })
    const chunks: BlobPart[] = []
    const t0 = Date.now()
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    r.onstop = () => {
      clearInterval(timer)
      setLeft(null)
      const dur = Math.min(maxSec, (Date.now() - t0) / 1000)
      onVideo?.(new Blob(chunks, { type: r.mimeType || 'video/webm' }), dur)
    }
    const timer = setInterval(() => {
      const l = Math.max(0, maxSec - (Date.now() - t0) / 1000)
      setLeft(Math.ceil(l))
      if (l <= 0 && r.state === 'recording') r.stop()
    }, 200)
    r.start(500)
    rec.current = r
    setLeft(maxSec)
  }
  const stopVideo = () => { if (rec.current?.state === 'recording') rec.current.stop() }

  const recording = left !== null

  if (failed) {
    return (
      <div className="camera fallback">
        <p>카메라 화면을 열 수 없어요. 아래 버튼으로 찍어요.</p>
        <div className="cam-buttons">
          {mode !== 'video' && (
            <label className="btn huge primary">📷 사진
              <input hidden type="file" accept="image/*" capture={facing}
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) onPhoto?.(await shrinkImage(f)); e.target.value = '' }} />
            </label>
          )}
          {mode !== 'photo' && (
            <label className="btn huge primary">🎥 영상
              <input hidden type="file" accept="video/*" capture={facing}
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) onVideo?.(f, Math.min(maxSec, await blobDuration(f) || maxSec)); e.target.value = '' }} />
            </label>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="camera">
      <div className="stage">
      <div className="cam-view">
        <video ref={videoRef} playsInline muted className={facing === 'user' ? 'mirror' : ''} />
        {flash && <div className="cam-flash" />}
        {recording && <div className="cam-rec">🔴 {left}초</div>}
        {!stream && <div className="cam-wait">카메라를 켜는 중이에요…</div>}
      </div>
      </div>
      <div className="cam-buttons">
        <button className="btn icon" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} disabled={recording} aria-label="앞/뒤 카메라 바꾸기">🔄</button>
        {mode !== 'video' && <button className="btn huge primary" onClick={photo} disabled={!stream || recording}>📷 사진</button>}
        {mode !== 'photo' && (recording
          ? <button className="btn huge rec" onClick={stopVideo}>⏹ 멈추기</button>
          : <button className="btn huge primary" onClick={startVideo} disabled={!stream}>🎥 영상</button>)}
      </div>
    </div>
  )
}
