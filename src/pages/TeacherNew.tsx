import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Keypad from '../components/Keypad'
import NeedSupabase from '../components/NeedSupabase'
import { friendly, rpc, supabaseReady } from '../lib/supabase'
import { setKey } from '../lib/teacherKeys'

const NOTICE_KEY = 'cb.privacyNoticeSeen'

export default function TeacherNew() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [seen, setSeen] = useState(() => localStorage.getItem(NOTICE_KEY) === '1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!supabaseReady) return <NeedSupabase />

  if (!seen) {
    return (
      <div className="center-card box notice">
        <h2>📋 시작하기 전에</h2>
        <p>학생 촬영·영상 저장은 <b>학교 개인정보 지침</b>을 확인해 주세요.</p>
        <ul>
          <li>촬영 원본 사진·영상은 학생 태블릿 안에만 있어요.</li>
          <li>서버에는 완성 영상(MP4)만 올라가고, 선생님만 볼 수 있어요.</li>
          <li>제출 영상은 보관 기간(기본 30일)이 지나면 자동으로 지워져요.</li>
        </ul>
        <button className="btn primary" onClick={() => { localStorage.setItem(NOTICE_KEY, '1'); setSeen(true) }}>
          확인했어요
        </button>
      </div>
    )
  }

  const create = async () => {
    setBusy(true)
    setErr('')
    try {
      const r = await rpc<{ room_id: string; code: string; teacher_key: string }>('create_room', { p_name: name.trim(), p_pin: pin })
      setKey(r.room_id, r.teacher_key)
      nav(`/teacher/room/${r.room_id}?new=1`)
    } catch (e) {
      setErr(friendly(e))
      setBusy(false)
    }
  }

  return (
    <div className="teacher narrow">
      <h1>새 방 만들기</h1>
      <label className="field">
        <span>방 이름</span>
        <input value={name} maxLength={60} placeholder="예: 4-2 유초이음" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span>PIN 4자리 (다른 기기에서 방을 되찾을 때, 방 지울 때 써요)</span>
        <Keypad value={pin} length={4} onChange={setPin} masked />
      </div>
      {err && <p className="warn">{err}</p>}
      <button className="btn big primary" disabled={!name.trim() || pin.length !== 4 || busy} onClick={create}>
        {busy ? '만드는 중이에요…' : '방 만들기'}
      </button>
    </div>
  )
}
