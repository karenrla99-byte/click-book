import { useEffect, useRef, useState } from 'react'
import Guide from '../../components/Guide'
import { fn, uploadSigned, withTimeout } from '../../lib/api'
import { ping } from '../../lib/realtime'
import { downloadBlob, recordTimeline } from '../../lib/record'
import { disposeAssets } from '../../lib/render'
import { Pending, clearPending, getPending, setPending } from '../../lib/store'
import { useStudent } from './ctx'
import { prepare } from './useTimeline'

type Phase = 'idle' | 'making' | 'uploading' | 'done' | 'failed'
const MAX = 48 * 1024 * 1024
const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + 'MB'

/** ⑥ 선생님께 보내기 */
export default function Send() {
  const c = useStudent()
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [pending, setPend] = useState<Pending | null>(null)
  const [step, setStepState] = useState('')
  const stepRef = useRef('')
  const setStep = (v: string) => { stepRef.current = v; setStepState(v) }
  const [msg, setMsg] = useState('')
  const [detail, setDetail] = useState('')

  useEffect(() => { getPending(c.ns).then((p) => p && setPend(p)).catch(() => {}) }, [c.ns])

  const make = async (): Promise<Pending> => {
    setPhase('making')
    setProgress(0)
    let bps = 1_500_000
    for (let attempt = 0; attempt < 3; attempt++) {
      setStep('그림책 펼치는 중')
      const ac = new AudioContext()
      const { assets, tl } = await withTimeout(prepare(c, ac), 60_000, '준비')
      ac.close().catch(() => {})
      try {
        setStep('영상 만드는 중')
        const made = await recordTimeline(tl, assets, setProgress, bps)
        setStep(`다 만들었어요 (${mb(made.blob.size)})`)
        if (made.blob.size <= MAX || attempt === 2) {
          const p: Pending = { blob: made.blob, mime: made.mime, duration: made.duration, createdAt: Date.now() }
          setPend(p)
          // 태블릿에 남겨 두기 (실패해도 보내기는 계속)
          await withTimeout(setPending(c.ns, p), 15_000, '태블릿 저장').catch(() => {})
          return p
        }
        setMsg('영상이 너무 커서 조금 작게 다시 만들어요…')
        bps = Math.round(bps * 0.6)
      } finally {
        disposeAssets(assets)
      }
    }
    throw new Error('영상을 만들지 못했어요')
  }

  const upload = async (p: Pending) => {
    setPhase('uploading')
    const ext = p.blob.type === 'video/mp4' ? 'mp4' : 'webm'
    setStep('1/3 보낼 자리 받는 중')
    const r = await fn<{ id: string; path: string; token: string; room_id: string }>('create-upload', {
      code: c.code, student_id: c.me.id, ext, size: p.blob.size, duration: Math.round(p.duration),
    })
    ping(c.room.id, 'submission', { student_id: c.me.id })
    setStep(`2/3 영상 올리는 중 (${mb(p.blob.size)})`)
    await uploadSigned('submissions', r.path, r.token, p.blob, p.blob.type)
    setStep('3/3 선생님 제출함에 넣는 중')
    await fn('finish', { code: c.code, student_id: c.me.id, id: r.id, size: p.blob.size })
    ping(c.room.id, 'submission', { student_id: c.me.id })
    clearPending(c.ns).catch(() => {})
    setPend(null)
    c.update((proj) => ({ ...proj, sent: { at: Date.now(), id: r.id } }))
    setPhase('done')
  }

  const send = async (reuse?: Pending | null) => {
    setMsg('')
    setDetail('')
    let p = reuse ?? null
    try {
      if (!p) p = await make()
    } catch (e) {
      setMsg('영상을 만들지 못했어요. 다시 해 봐요.')
      setDetail((e as Error).message)
      setPhase('idle')
      return
    }
    try {
      await upload(p)
    } catch (e) {
      setDetail(`${stepRef.current} → ${(e as Error).message}`)
      setPhase('failed')
    }
  }

  const save = async () => {
    try {
      const p = pending ?? (await make())
      downloadBlob(p.blob, `${c.me.name}_그림책.${p.blob.type === 'video/mp4' ? 'mp4' : 'webm'}`)
      if (phase === 'making') setPhase('idle')
    } catch (e) {
      setMsg('저장하지 못했어요.')
      setDetail((e as Error).message)
      setPhase('idle')
    }
  }

  if (phase === 'making') return (
    <div className="page-center">
      <h1 className="page-title">🎬 만드는 중이에요…</h1>
      <div className="bar big"><div style={{ width: `${progress * 100}%` }} /></div>
      <p className="hint">{Math.round(progress * 100)}% · 화면을 끄거나 다른 앱으로 가지 말아요</p>
      <p className="muted">{step}</p>
      {msg && <p className="hint">{msg}</p>}
    </div>
  )
  if (phase === 'uploading') return (
    <div className="page-center">
      <h1 className="page-title">📤 선생님께 보내는 중이에요…</h1>
      <div className="spinner" />
      <p className="muted">{step}</p>
    </div>
  )
  if (phase === 'done') return (
    <div className="page-center">
      <div className="celebrate">🎉</div>
      <h1 className="page-title">선생님께 보냈어요!</h1>
      <button className="btn" onClick={save}>💾 내 태블릿에도 저장</button>
    </div>
  )

  return (
    <div className="page-center">
      <Guide step="send" />
      {phase === 'failed' && (
        <div className="box warn-box">
          <p>😢 보내지 못했어요. 와이파이를 확인하고 다시 보내요. (영상은 태블릿에 남아 있어요)</p>
        </div>
      )}
      {pending && phase !== 'failed' && <p className="hint">아직 못 보낸 영상이 있어요.</p>}
      {c.project.sent && !pending && <p className="hint">✅ {new Date(c.project.sent.at).toLocaleString('ko-KR')}에 보냈어요. 고쳤으면 다시 보내요.</p>}
      {pending ? (
        <button className="btn huge primary" onClick={() => send(pending)}>📤 다시 보내기</button>
      ) : (
        <button className="btn huge primary" onClick={() => send()}>📤 선생님께 보내기</button>
      )}
      {pending && <button className="btn" onClick={() => { clearPending(c.ns).catch(() => {}); setPend(null) }}>새로 만들어서 보내기</button>}
      <button className="btn" onClick={save}>💾 내 태블릿에 저장</button>
      {msg && <p className="warn">{msg}</p>}
      {detail && <p className="detail">선생님께 보여 주세요: {detail}</p>}
    </div>
  )
}
