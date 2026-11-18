import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NeedSupabase from '../components/NeedSupabase'
import { friendly, rpc, supabaseReady } from '../lib/supabase'
import { keyList } from '../lib/teacherKeys'
import { RoomSummary } from '../lib/types'

export default function TeacherHome() {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!supabaseReady) return
    const keys = keyList()
    if (keys.length === 0) return setRooms([])
    rpc<RoomSummary[]>('list_my_rooms', { p_keys: keys }).then(setRooms).catch((e) => setErr(friendly(e)))
  }, [])

  if (!supabaseReady) return <NeedSupabase />

  return (
    <div className="teacher">
      <div className="row-between">
        <h1>내 방</h1>
        <div className="row">
          <Link className="btn" to="/teacher/recover">🔑 PIN으로 되찾기</Link>
          <Link className="btn primary" to="/teacher/new">➕ 새 방 만들기</Link>
        </div>
      </div>
      {err && <p className="warn">{err}</p>}
      {!rooms && !err && <p>불러오는 중이에요…</p>}
      {rooms?.length === 0 && (
        <div className="box">
          <p>이 기기에 저장된 방이 없어요. 새 방을 만들거나, 다른 기기에서 만든 방은 방 번호 + PIN으로 되찾아요.</p>
        </div>
      )}
      <div className="room-grid">
        {rooms?.map((r) => (
          <Link key={r.id} to={`/teacher/room/${r.id}`} className="room-card">
            <span className={`badge ${r.is_open ? 'open' : 'closed'}`}>{r.is_open ? '열림' : '닫힘'}</span>
            <strong>{r.name}</strong>
            <span className="code">{r.code}</span>
            <span className="muted">학생 {r.student_count}명 · {new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
