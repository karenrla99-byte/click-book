import { useEffect, useRef, useState } from 'react'
import { VoiceRecorder } from '../lib/media'
import { useBlobUrl } from '../lib/blobUrl'
import { putBlob } from '../lib/store'

type Props = {
  ns: string
  blobId?: string | null
  label?: string
  maxSec?: number
  onChange: (id: string | null, duration: number) => void
}

export default function VoiceButton({ ns, blobId, label = '🎤 녹음하기', maxSec = 60, onChange }: Props) {
  const rec = useRef<VoiceRecorder | null>(null)
  const [sec, setSec] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const url = useBlobUrl(ns, blobId)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => rec.current?.cancel(), [])

  const start = async () => {
    setErr('')
    try {
      const r = new VoiceRecorder()
      await r.start()
      rec.current = r
      setSec(0)
      const timer = setInterval(() => {
        if (rec.current !== r) return clearInterval(timer)
        const s = (Date.now() - r.startedAt) / 1000
        setSec(Math.floor(s))
        if (s >= maxSec) { clearInterval(timer); stop() }
      }, 250)
    } catch {
      setErr('마이크를 쓸 수 없어요')
    }
  }
  const stop = async () => {
    const r = rec.current
    if (!r) return
    rec.current = null
    setSec(null)
    const { blob, duration } = await r.stop()
    if (blob.size) onChange(await putBlob(ns, blob), duration)
  }
  const play = () => {
    if (!url) return
    audio.current?.pause()
    audio.current = new Audio(url)
    audio.current.play().catch(() => {})
  }

  if (sec !== null) return <button className="btn big rec" onClick={stop}>⏹ 멈추기 ({sec}초)</button>
  return (
    <div className="row">
      {blobId ? (
        <>
          <button className="btn big primary" onClick={play}>▶ 들어요</button>
          <button className="btn" onClick={start}>🎤 다시</button>
          <button className="btn icon" onClick={() => onChange(null, 0)} aria-label="녹음 지우기">🗑</button>
        </>
      ) : (
        <button className="btn big" onClick={start}>{label}</button>
      )}
      {err && <span className="warn">{err}</span>}
    </div>
  )
}
