import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { STEP_LABELS } from '../../components/Steps'
import { assetUrls } from '../../lib/api'
import { listen } from '../../lib/realtime'
import { Project, loadProject, nsOf, persistStorage, saveProject } from '../../lib/store'
import { friendly, rpc } from '../../lib/supabase'
import { Template, flatCards } from '../../lib/template'
import { PublicRoom, Student } from '../../lib/types'
import { Ctx, STEPS, Step, StudentCtx } from './ctx'

const NUM = ['①', '②', '③', '④', '⑤', '⑥']

export default function Shell() {
  const { code = '', sid = '' } = useParams()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [room, setRoom] = useState<{ id: string; code: string; name: string } | null>(null)
  const [me, setMe] = useState<Student | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [err, setErr] = useState('')
  const urlCache = useRef(new Map<string, string>())

  const fetchRoom = useCallback(async () => {
    const d = await rpc<PublicRoom>('get_room_by_code', { p_code: code })
    if (!d.ok) throw new Error(d.error)
    const s = d.students.find((x) => x.id === sid)
    if (!s) throw new Error('명단에서 이름을 찾을 수 없어요.')
    setRoom(d.room)
    setMe(s)
    setTemplate(d.template ? { id: d.template.id, title: d.template.title, data: d.template.data as Template['data'] } : null)
    return d.room
  }, [code, sid])

  useEffect(() => {
    let stop = () => {}
    persistStorage()
    fetchRoom()
      .then(async (r) => {
        setProject(await loadProject(nsOf(r.id, sid)))
        stop = listen(r.id, 'template', () => { fetchRoom().catch(() => {}) })
      })
      .catch((e) => setErr(friendly(e)))
    return () => stop()
  }, [fetchRoom, sid])

  const ns = room ? nsOf(room.id, sid) : ''
  const update = useCallback((fn: (p: Project) => Project) => {
    setProject((p) => {
      if (!p) return p
      const next = fn(p)
      saveProject(ns, next)
      return next
    })
  }, [ns])

  const assetUrl = useCallback(async (path: string | null | undefined) => {
    if (!path) return undefined
    if (urlCache.current.has(path)) return urlCache.current.get(path)
    const urls = await assetUrls({ code }, [path])
    Object.entries(urls).forEach(([k, v]) => urlCache.current.set(k, v))
    return urls[path]
  }, [code])

  const cards = useMemo(() => flatCards(template?.data), [template])
  const go = useCallback((step: Step) => nav(`/r/${code}/s/${sid}/${step}`), [nav, code, sid])

  if (err) return (
    <div className="page-center">
      <p className="page-title">😢 {err}</p>
      <Link className="btn big" to={`/r/${code}`}>이름 다시 고르기</Link>
    </div>
  )
  if (!room || !me || !project) return <div className="page-center"><p className="page-title">⏳ 준비하고 있어요…</p></div>
  if (!template || cards.length === 0) return (
    <div className="page-center">
      <p className="page-title">👋 {me.name}, 반가워요!</p>
      <div className="box soon">선생님이 아직 이야기를 올리지 않았어요. 조금만 기다려요.</div>
      <button className="btn big" onClick={() => fetchRoom().catch((e) => setErr(friendly(e)))}>🔄 다시 보기</button>
    </div>
  )

  const ctx: StudentCtx = { code, room, me, template, cards, project, ns, update, assetUrl, go }
  const current = STEPS.findIndex((s) => pathname.endsWith('/' + s))

  return (
    <Ctx.Provider value={ctx}>
      <div className="student">
        <nav className="step-nav">
          <span className="me-chip">🙂 {me.name}</span>
          {STEPS.map((s, i) => (
            <button key={s} className={`step-btn ${current === i ? 'now' : ''} ${me.level === '하' && s === 'connect' ? 'optional' : ''}`} onClick={() => go(s)}>
              {NUM[i]} {STEP_LABELS[i]}
            </button>
          ))}
        </nav>
        <Outlet />
      </div>
    </Ctx.Provider>
  )
}
