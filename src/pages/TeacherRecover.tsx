import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Keypad from '../components/Keypad'
import NeedSupabase from '../components/NeedSupabase'
import { friendly, rpc, supabaseReady } from '../lib/supabase'
import { setKey } from '../lib/teacherKeys'

type R = { ok: boolean; error?: string; room_id?: string; teacher_key?: string }

export default function TeacherRecover() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (!supabaseReady) return <NeedSupabase />

  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      const r = await rpc<R>('recover_room', { p_code: code, p_pin: pin })
      if (!r.ok) { setErr(friendly(r.error)); setPin(''); return }
      setKey(r.room_id!, r.teacher_key!)
      nav(`/teacher/room/${r.room_id}`)
    } catch (e) {
      setErr(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="teacher">
      <h1>PIN으로 방 되찾기</h1>
      <div className="two-col">
        <div className="field"><span>방 번호 6자리</span><Keypad value={code} length={6} onChange={setCode} /></div>
        <div className="field"><span>PIN 4자리</span><Keypad value={pin} length={4} onChange={setPin} masked /></div>
      </div>
      {err && <p className="warn">{err}</p>}
      <button className="btn big primary" disabled={code.length !== 6 || pin.length !== 4 || busy} onClick={go}>되찾기</button>
    </div>
  )
}
