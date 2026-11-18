import JSZip from 'jszip'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fn } from '../lib/api'
import { listen } from '../lib/realtime'
import { downloadBlob } from '../lib/record'
import { friendly, rpc } from '../lib/supabase'
import { Student } from '../lib/types'

type Sub = { id: string; student_id: string; status: 'uploading' | 'done'; size_bytes: number | null; duration_sec: number | null; created_at: string; expires_at: string | null; file_path: string }
type Props = { room: string; tkey: string; roomName: string; students: Student[]; retentionDays: number | null }

const FREE = 1024 * 1024 * 1024
const mb = (b: number) => (b / 1024 / 1024).toFixed(1) + 'MB'
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000) : null)
const extOf = (s: Sub) => (s.file_path.endsWith('.webm') ? 'webm' : 'mp4')

export default function Inbox({ room, tkey, roomName, students, retentionDays }: Props) {
  const [subs, setSubs] = useState<Sub[]>([])
  const [err, setErr] = useState('')
  const [show, setShow] = useState<{ student: Student; url: string; sub: Sub } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [zip, setZip] = useState('')
  const [playlist, setPlaylist] = useState<{ s: Student; sub: Sub }[] | null>(null)

  const load = useCallback(() => {
    rpc<Sub[]>('list_submissions', { p_room: room, p_key: tkey }).then(setSubs).catch((e) => setErr(friendly(e)))
  }, [room, tkey])
  useEffect(() => {
    load()
    const stop = listen(room, 'submission', () => load())
    const t = setInterval(load, 20_000)
    return () => { stop(); clearInterval(t) }
  }, [load, room])

  const latest = (sid: string) => subs.find((s) => s.student_id === sid && s.status === 'done') ?? subs.find((s) => s.student_id === sid)
  const done = students.map((s) => ({ s, sub: latest(s.id!) })).filter((x): x is { s: Student; sub: Sub } => x.sub?.status === 'done')
  const used = subs.reduce((a, s) => a + (s.size_bytes ?? 0), 0)

  const sign = async (ids: string[], download = false) =>
    (await fn<{ urls: Record<string, string> }>('sign', { room, key: tkey, ids, download })).urls

  const open = async (student: Student, sub: Sub) => {
    try {
      const u = await sign([sub.id])
      if (!u[sub.id]) return setErr(`${student.name}: 아직 영상 파일이 없어요 (보내는 중이거나 실패했어요)`)
      setShow({ student, sub, url: u[sub.id] })
    } catch (e) { setErr(friendly(e)) }
  }
  const downloadOne = async (student: Student, sub: Sub) => {
    const u = (await sign([sub.id]))[sub.id]
    downloadBlob(await (await fetch(u)).blob(), `${student.name}.${extOf(sub)}`)
  }
  const remove = async (ids: string[]) => {
    if (!ids.length || !confirm(`영상 ${ids.length}개를 지울까요? 되돌릴 수 없어요.`)) return
    try { await fn('delete-submissions', { room, key: tkey, ids }); setChecked(new Set()); setShow(null); load() } catch (e) { setErr(friendly(e)) }
  }
  const zipAll = async () => {
    if (!done.length) return
    try {
      setZip('주소 받는 중…')
      const urls = await sign(done.map((d) => d.sub.id))
      const z = new JSZip()
      for (let i = 0; i < done.length; i++) {
        const { s, sub } = done[i]
        setZip(`내려받는 중 ${i + 1}/${done.length}`)
        z.file(`${String(i + 1).padStart(2, '0')}_${s.name}.${extOf(sub)}`, await (await fetch(urls[sub.id])).blob())
      }
      setZip('묶는 중…')
      downloadBlob(await z.generateAsync({ type: 'blob' }), `${roomName}_제출영상.zip`)
    } catch (e) { setErr(friendly(e)) }
    setZip('')
  }

  return (
    <div className="inbox">
      <div className="row-between">
        <h2>제출함 ({done.length}/{students.length})</h2>
        <div className="row">
          <button className="btn primary" disabled={!done.length} onClick={() => setPlaylist(done)}>▶ 연속 재생</button>
          <button className="btn" disabled={!done.length || !!zip} onClick={zipAll}>{zip || '🗜 전체 ZIP'}</button>
          <button className="btn danger" disabled={!checked.size} onClick={() => remove([...checked])}>🗑 고른 것 지우기 ({checked.size})</button>
          <button className="btn icon" onClick={load} aria-label="새로고침">🔄</button>
        </div>
      </div>
      {err && <p className="warn">{err}</p>}
      <div className="usage">
        <div className="bar thin"><div style={{ width: `${Math.min(100, (used / FREE) * 100)}%` }} /></div>
        <span className="muted">이 방이 쓰는 공간 {mb(used)} / 무료 1GB · 보관: {retentionDays ? `${retentionDays}일 뒤 자동 삭제` : '직접 지울 때까지'}</span>
      </div>

      <div className="sub-grid">
        {students.map((s) => {
          const sub = latest(s.id!)
          const st = !sub ? 'none' : sub.status
          const left = sub?.status === 'done' ? daysLeft(sub.expires_at) : null
          return (
            <div key={s.id} className={`sub-card ${st}`} onClick={() => sub && open(s, sub)}>
              {sub?.status === 'done' && (
                <input type="checkbox" className="sub-check" checked={checked.has(sub.id)} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(sub.id); else n.delete(sub.id); setChecked(n) }} />
              )}
              <span className="sub-icon">{st === 'done' ? '✅' : st === 'uploading' ? '⏳' : '⬜'}</span>
              <strong>{s.name}</strong>
              <span className="muted">
                {st === 'done' ? `${new Date(sub!.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · ${mb(sub!.size_bytes ?? 0)}` : st === 'uploading' ? '보내는 중' : '아직'}
              </span>
              {st === 'uploading' && <span className="muted small">눌러서 확인해 봐요</span>}
              {left !== null && left <= 3 && <span className="warn small">{left <= 0 ? '오늘' : `${left}일 뒤`} 지워져요</span>}
            </div>
          )
        })}
      </div>

      {show && (
        <div className="modal" onClick={() => setShow(null)}>
          <div className="modal-body wide" onClick={(e) => e.stopPropagation()}>
            <h2>{show.student.name}</h2>
            <video src={show.url} controls autoPlay playsInline className="big-video" />
            <div className="row end">
              <button className="btn" onClick={() => downloadOne(show.student, show.sub)}>⬇ 내려받기</button>
              <button className="btn danger" onClick={() => remove([show.sub.id])}>🗑 지우기</button>
              <button className="btn primary" onClick={() => setShow(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
      {playlist && <Playlist items={playlist} sign={sign} onClose={() => setPlaylist(null)} />}
    </div>
  )
}

function Playlist({ items: initial, sign, onClose }: {
  items: { s: Student; sub: Sub }[]; sign: (ids: string[]) => Promise<Record<string, string>>; onClose: () => void
}) {
  const [items, setItems] = useState(initial)
  const [playing, setPlaying] = useState<number | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const dragFrom = useRef<number | null>(null)

  const move = (i: number, j: number) => {
    if (j < 0 || j >= items.length) return
    const n = [...items]
    const [x] = n.splice(i, 1)
    n.splice(j, 0, x)
    setItems(n)
  }
  const start = async () => {
    setUrls(await sign(items.map((x) => x.sub.id)))
    setPlaying(0)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const stop = () => { setPlaying(null); if (document.fullscreenElement) document.exitFullscreen() }

  if (playing !== null) {
    const cur = items[playing]
    return (
      <div className="playlist-stage">
        <div className="pl-title">{playing + 1} / {items.length} · {cur.s.name}</div>
        <video key={cur.sub.id} src={urls[cur.sub.id]} autoPlay controls playsInline
          onEnded={() => (playing + 1 < items.length ? setPlaying(playing + 1) : stop())} />
        <div className="pl-controls">
          <button className="btn" disabled={playing === 0} onClick={() => setPlaying(playing - 1)}>◀ 앞</button>
          <button className="btn" onClick={stop}>✕ 끝내기</button>
          <button className="btn" disabled={playing + 1 >= items.length} onClick={() => setPlaying(playing + 1)}>다음 ▶</button>
        </div>
      </div>
    )
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <h2>▶ 연속 재생 순서 (끌어서 바꿔요)</h2>
        <ol className="pl-order">
          {items.map((x, i) => (
            <li key={x.sub.id} draggable onDragStart={() => { dragFrom.current = i }} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null }}>
              <span className="grow">☰ {x.s.name}</span>
              <button className="btn icon" onClick={() => move(i, i - 1)} aria-label="위로">▲</button>
              <button className="btn icon" onClick={() => move(i, i + 1)} aria-label="아래로">▼</button>
            </li>
          ))}
        </ol>
        <div className="row end">
          <button className="btn" onClick={onClose}>닫기</button>
          <button className="btn big primary" onClick={start}>▶ 전체화면으로 시작</button>
        </div>
      </div>
    </div>
  )
}
