import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Keypad from '../components/Keypad'
import NeedSupabase from '../components/NeedSupabase'
import QrCode, { joinUrl } from '../components/QrCode'
import Inbox from '../components/Inbox'
import RosterEditor from '../components/RosterEditor'
import TemplateEditor from '../components/TemplateEditor'
import { fn } from '../lib/api'
import { friendly, rpc, supabaseReady } from '../lib/supabase'
import { getKey, removeKey, setKey } from '../lib/teacherKeys'
import { Student, TeacherRoom as Room } from '../lib/types'

type Tab = 'room' | 'roster' | 'template' | 'inbox'

export default function TeacherRoom() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const key = getKey(id)
  const [room, setRoom] = useState<Room | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>(params.get('new') ? 'template' : 'room')
  const [bigQr, setBigQr] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [delPin, setDelPin] = useState('')
  const [delErr, setDelErr] = useState('')

  const load = useCallback(() => {
    if (!key) return
    rpc<Room>('get_teacher_room', { p_room: id, p_key: key }).then(setRoom).catch((e) => setErr(friendly(e)))
  }, [id, key])
  useEffect(load, [load])

  if (!supabaseReady) return <NeedSupabase />
  if (!key) return (
    <div className="center-card box">
      <p>이 기기에는 이 방의 선생님 열쇠가 없어요.</p>
      <Link className="btn primary" to="/teacher/recover">🔑 PIN으로 되찾기</Link>
    </div>
  )
  if (err) return <div className="center-card box"><p className="warn">{err}</p><Link className="btn" to="/teacher">내 방 목록</Link></div>
  if (!room) return <p className="center-card">불러오는 중이에요…</p>

  const patch = async (p: Partial<Pick<Room, 'name' | 'is_open' | 'retention_days' | 'settings'>>) => {
    setRoom({ ...room, ...p })
    try { await rpc('update_room', { p_room: id, p_key: key, p_patch: p }) } catch (e) { setErr(friendly(e)) }
  }
  const saveStudents = async (s: Student[]) => {
    const students = await rpc<Student[]>('save_students', { p_room: id, p_key: key, p_students: s })
    setRoom({ ...room, students })
  }
  const duplicate = async () => {
    const name = prompt('복제한 방 이름', `${room.name} (복사)`)
    if (name === null) return
    try {
      const r = await rpc<{ room_id: string }>('duplicate_room', { p_room: id, p_key: key, p_name: name })
      // 같은 열쇠가 새 방에도 등록됨
      setKey(r.room_id, key)
      nav(`/teacher/room/${r.room_id}`)
    } catch (e) { setErr(friendly(e)) }
  }
  const del = async () => {
    setDelErr('')
    try {
      const r = await fn<{ ok: boolean; error?: string }>('delete-room', { room: id, key, pin: delPin })
      if (!r.ok) { setDelErr(friendly(r.error)); setDelPin(''); return }
      removeKey(id)
      nav('/teacher')
    } catch (e) { setDelErr(friendly(e)) }
  }

  return (
    <div className="teacher">
      <div className="row-between">
        <h1>
          <Link to="/teacher" className="back">◀</Link> {room.name}
          <span className={`badge ${room.is_open ? 'open' : 'closed'}`}>{room.is_open ? '열림' : '닫힘'}</span>
        </h1>
        <div className="row">
          <button className={`btn ${tab === 'room' ? 'primary' : ''}`} onClick={() => setTab('room')}>🏫 방</button>
          <button className={`btn ${tab === 'roster' ? 'primary' : ''}`} onClick={() => setTab('roster')}>👧 명단 ({room.students.length})</button>
          <button className={`btn ${tab === 'template' ? 'primary' : ''}`} onClick={() => setTab('template')}>📚 템플릿</button>
          <button className={`btn ${tab === 'inbox' ? 'primary' : ''}`} onClick={() => setTab('inbox')}>📤 제출함</button>
        </div>
      </div>

      {params.get('new') && tab === 'template' && (
        <p className="msg">방을 만들었어요 🎉 이 기기에 선생님 열쇠가 저장됐어요. PIN을 꼭 기억해 주세요. 먼저 이야기 템플릿을 골라요.</p>
      )}

      {tab === 'room' && (
        <div className="room-info">
          <div className="box join-box">
            <QrCode text={joinUrl(room.code)} size={220} />
            <div>
              <p className="muted">방 번호</p>
              <p className="code big-code">{room.code}</p>
              <button className="btn primary" onClick={() => setBigQr(true)}>📺 크게 띄우기</button>
            </div>
          </div>

          <div className="box">
            <h3>방 설정</h3>
            <label className="field inline">
              <span>방 이름</span>
              <input defaultValue={room.name} maxLength={60} onBlur={(e) => e.target.value.trim() && e.target.value !== room.name && patch({ name: e.target.value.trim() })} />
            </label>
            <div className="field inline">
              <span>학생 들어오기</span>
              <button className={`btn ${room.is_open ? 'primary' : ''}`} onClick={() => patch({ is_open: true })}>열기</button>
              <button className={`btn ${!room.is_open ? 'primary' : ''}`} onClick={() => patch({ is_open: false })}>닫기</button>
            </div>
            <div className="field inline">
              <span>제출 영상 보관</span>
              {([7, 30, null] as const).map((d) => (
                <button key={String(d)} className={`btn ${room.retention_days === d ? 'primary' : ''}`} onClick={() => patch({ retention_days: d })}>
                  {d ? `${d}일` : '직접 지울 때까지'}
                </button>
              ))}
            </div>
          </div>

          <div className="box">
            <div className="field inline">
              <span>학생 한 명이 내는 영상</span>
              <button className={`btn ${!room.settings?.multiSubmit ? 'primary' : ''}`} onClick={() => patch({ settings: { ...room.settings, multiSubmit: false } })}>1개 (다시 내면 바꿔치기)</button>
              <button className={`btn ${room.settings?.multiSubmit ? 'primary' : ''}`} onClick={() => patch({ settings: { ...room.settings, multiSubmit: true } })}>여러 개</button>
            </div>
          </div>

          <div className="box">
            <h3>방 관리</h3>
            <button className="btn" onClick={duplicate}>📑 방 복제 (명단·템플릿 같이)</button>
            <button className="btn danger" onClick={() => setDelOpen(true)}>🗑 방 지우기</button>
            {delOpen && (
              <div className="del-box">
                <p>방을 지우면 명단·템플릿·제출 영상이 <b>모두</b> 지워져요. PIN을 눌러 주세요.</p>
                <Keypad value={delPin} length={4} onChange={setDelPin} masked />
                {delErr && <p className="warn">{delErr}</p>}
                <div className="row">
                  <button className="btn" onClick={() => { setDelOpen(false); setDelPin('') }}>그만두기</button>
                  <button className="btn danger" disabled={delPin.length !== 4} onClick={del}>정말 지우기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'roster' && <RosterEditor initial={room.students} onSave={saveStudents} />}
      {tab === 'template' && <TemplateEditor room={id} tkey={key} />}
      {tab === 'inbox' && <Inbox room={id} tkey={key} roomName={room.name} students={room.students} retentionDays={room.retention_days} />}

      {bigQr && (
        <div className="overlay" onClick={() => setBigQr(false)}>
          <p className="overlay-title">{room.name}</p>
          <QrCode text={joinUrl(room.code)} size={Math.min(innerHeight * 0.55, 520)} />
          <p className="code huge-code">{room.code}</p>
          <p className="muted">화면을 누르면 닫혀요</p>
        </div>
      )}
    </div>
  )
}
