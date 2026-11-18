import { useRef, useState } from 'react'
import { assetUrls, uploadAsset } from '../lib/api'
import { VoiceRecorder } from '../lib/media'

type Props = { room: string; tkey: string; path?: string | null; onChange: (p: string | null) => void }

/** 카드 읽어 주기용 교사 녹음 */
export default function TeacherAudio({ room, tkey, path, onChange }: Props) {
  const rec = useRef<VoiceRecorder | null>(null)
  const [state, setState] = useState<'idle' | 'rec' | 'up'>('idle')
  const [err, setErr] = useState('')

  const start = async () => {
    setErr('')
    try { const r = new VoiceRecorder(); await r.start(); rec.current = r; setState('rec') } catch { setErr('마이크를 쓸 수 없어요') }
  }
  const stop = async () => {
    const r = rec.current
    if (!r) return
    rec.current = null
    setState('up')
    try {
      const { blob } = await r.stop()
      onChange(await uploadAsset(room, tkey, blob, blob.type.includes('mp4') ? 'm4a' : 'webm'))
    } catch (e) { setErr((e as Error).message) }
    setState('idle')
  }
  const play = async () => {
    if (!path) return
    const u = (await assetUrls({ room, key: tkey }, [path]))[path]
    if (u) new Audio(u).play().catch(() => {})
  }

  if (state === 'rec') return <button className="btn rec" onClick={stop}>⏹ 녹음 멈추기</button>
  if (state === 'up') return <span className="muted">올리는 중…</span>
  return (
    <span className="row">
      {path ? (
        <>
          <button className="btn" onClick={play}>▶ 내 녹음</button>
          <button className="btn icon" onClick={() => onChange(null)} aria-label="녹음 지우기">🗑</button>
        </>
      ) : <button className="btn" onClick={start}>🎤 선생님 녹음</button>}
      {err && <span className="warn">{err}</span>}
    </span>
  )
}
