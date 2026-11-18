import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import NeedSupabase from '../components/NeedSupabase'
import { Scribble, Spread } from '../components/Paper'
import { friendly, rpc, supabaseReady } from '../lib/supabase'
import { speak } from '../lib/speak'
import { PublicRoom } from '../lib/types'

export const lastStudentKey = (roomId: string) => `cb.student.${roomId}`

export default function PickName() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState<PublicRoom | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!supabaseReady) return
    rpc<PublicRoom>('get_room_by_code', { p_code: code }).then(setData).catch((e) => setErr(friendly(e)))
  }, [code])

  if (!supabaseReady) return <NeedSupabase />
  if (err) return <Message text={err} />
  if (!data) return <Message text="방을 찾고 있어요…" loading />
  if (!data.ok) return <Message text={friendly(data.error)} />

  const last = localStorage.getItem(lastStudentKey(data.room.id))
  const choose = (id: string) => {
    try { localStorage.setItem(lastStudentKey(data.room.id), id) } catch { /* 무시 */ }
    nav(`/r/${code}/s/${id}`)
  }

  return (
    <Spread
      className="pick"
      left={
        <div className="page-stack">
          <p className="eyebrow">🏫 {data.room.name}</p>
          <h1 className="page-title big">내 <Scribble>이름</Scribble>을<br />눌러요</h1>
          <button className="btn icon big-icon" onClick={() => speak('내 이름을 눌러요')} aria-label="읽어 주기">🔊</button>
        </div>
      }
      right={
        data.students.length === 0 ? (
          <p className="hint">아직 명단이 없어요. 선생님께 말해 주세요.</p>
        ) : (
          <div className="name-grid">
            {data.students.map((s) => (
              <button
                key={s.id}
                className={`btn name-btn ${s.id === last ? 'primary' : ''}`}
                onClick={() => { speak(s.name); choose(s.id!) }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )
      }
    />
  )
}

function Message({ text, loading }: { text: string; loading?: boolean }) {
  return (
    <Spread
      left={<div className="page-stack"><p className="page-title big">{loading ? '⏳' : '😢'}</p></div>}
      right={<div className="page-stack"><p className="page-title">{text}</p>{!loading && <Link className="btn big" to="/join">다시 번호 누르기</Link>}</div>}
    />
  )
}
