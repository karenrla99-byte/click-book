import { useEffect, useRef, useState } from 'react'
import { assetUrls, fn, uploadAsset } from '../lib/api'
import { ping } from '../lib/realtime'
import { downloadBlob } from '../lib/record'
import { speak } from '../lib/speak'
import { friendly, rpc } from '../lib/supabase'
import {
  Card, Chapter, MEDIA_LABEL, MediaKind, PLACES, Template, emptyTemplate, exportTemplate, importTemplate,
  newCard, newChapter, yuchoTemplate,
} from '../lib/template'
import TeacherAudio from './TeacherAudio'

type Props = { room: string; tkey: string }

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const n = [...arr]
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

export default function TemplateEditor({ room, tkey }: Props) {
  const [t, setT] = useState<Template | null | undefined>(undefined)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [openUrl, setOpenUrl] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)
  const openRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    rpc<Template | null>('get_teacher_template', { p_room: room, p_key: tkey }).then(setT).catch((e) => setMsg(friendly(e)))
  }, [room, tkey])

  const opening = t?.data.opening
  useEffect(() => {
    setOpenUrl(undefined)
    if (opening) assetUrls({ room, key: tkey }, [opening.path]).then((u) => setOpenUrl(u[opening.path]))
  }, [opening, room, tkey])

  const change = (next: Template) => { setT(next); setDirty(true); setMsg('') }
  const save = async (tpl = t) => {
    if (!tpl) return
    setBusy(true)
    try {
      await rpc('save_template', { p_room: room, p_key: tkey, p_title: tpl.title, p_data: tpl.data })
      setDirty(false)
      setMsg('저장했어요 ✅ 학생 태블릿에도 바로 바뀌어요')
      ping(room, 'template')
    } catch (e) { setMsg(friendly(e)) }
    setBusy(false)
  }
  const start = (tpl: Template) => { setT(tpl); save(tpl) }

  if (t === undefined) return <p>불러오는 중이에요…</p>
  if (t === null) return (
    <div className="box">
      <h2>이야기 템플릿 고르기</h2>
      <p className="muted">학생이 카드마다 사진·영상을 찍어 그림책을 만들어요.</p>
      <button className="btn big primary" onClick={() => start(yuchoTemplate())}>🏫 유초이음 학교생활 (기본)</button>
      <button className="btn" onClick={() => start(emptyTemplate())}>📄 빈 이야기</button>
      <button className="btn" onClick={() => fileRef.current?.click()}>📂 파일 불러오기</button>
      <input ref={fileRef} hidden type="file" accept=".json,application/json"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) try { start(importTemplate(await f.text())) } catch (er) { setMsg((er as Error).message) } }} />
      {msg && <p className="warn">{msg}</p>}
    </div>
  )

  const d = t.data
  const setData = (patch: Partial<Template['data']>) => change({ ...t, data: { ...d, ...patch } })
  const setChapters = (chapters: Chapter[]) => setData({ chapters })
  const setChapter = (ci: number, patch: Partial<Chapter>) => setChapters(d.chapters.map((c, i) => (i === ci ? { ...c, ...patch } : c)))
  const setCard = (ci: number, ki: number, patch: Partial<Card>) =>
    setChapter(ci, { cards: d.chapters[ci].cards.map((c, i) => (i === ki ? { ...c, ...patch } : c)) })

  const uploadOpening = async (f: File) => {
    setBusy(true)
    setMsg('여는 장면을 올리는 중이에요…')
    try {
      const ext = (f.name.split('.').pop() || (f.type.startsWith('video') ? 'mp4' : 'jpg')).toLowerCase()
      const path = await uploadAsset(room, tkey, f, ext)
      if (opening) fn('delete-asset', { room, key: tkey, path: opening.path }).catch(() => {})
      const next = { ...t, data: { ...d, opening: { path, kind: f.type.startsWith('video') ? 'video' as const : 'image' as const } } }
      setT(next)
      await save(next)
    } catch (e) { setMsg(friendly(e)) }
    setBusy(false)
  }

  return (
    <div className="tpl">
      <div className="row-between sticky-bar">
        <input className="tpl-title" value={t.title} onChange={(e) => change({ ...t, title: e.target.value })} />
        <div className="row">
          <button className="btn" onClick={() => downloadBlob(new Blob([exportTemplate(t)], { type: 'application/json' }), `${t.title}.json`)}>📤 파일로 내보내기</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>📂 불러오기</button>
          <button className="btn primary" disabled={!dirty || busy} onClick={() => save()}>{dirty ? '💾 저장' : '저장됨'}</button>
        </div>
        <input ref={fileRef} hidden type="file" accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || !confirm('지금 템플릿을 불러온 것으로 바꿀까요? (학생이 이미 연결한 사진은 다시 연결해야 해요)')) return
            try { change(importTemplate(await f.text())) } catch (er) { setMsg((er as Error).message) }
          }} />
      </div>
      {msg && <p className="msg">{msg}</p>}

      <div className="box">
        <h3>🎬 여는 장면 (영상·사진 파일)</h3>
        {opening && openUrl && (opening.kind === 'video'
          ? <video src={openUrl} controls className="opening small" />
          : <img src={openUrl} alt="" className="opening small" />)}
        <button className="btn" disabled={busy} onClick={() => openRef.current?.click()}>{opening ? '🔁 바꾸기' : '📁 올리기'}</button>
        {opening && <button className="btn icon" onClick={() => { fn('delete-asset', { room, key: tkey, path: opening.path }).catch(() => {}); const n = { ...t, data: { ...d, opening: null } }; setT(n); save(n) }} aria-label="여는 장면 지우기">🗑</button>}
        <input ref={openRef} hidden type="file" accept="video/*,image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadOpening(f) }} />
        <p className="muted">유튜브 링크는 영상에 넣을 수 없어서 파일만 올려요. 유치원생 얼굴이 나오면 수업 뒤 지워 주세요.</p>
      </div>

      {d.chapters.map((ch, ci) => (
        <div key={ch.id} className="box chapter">
          <div className="row-between full">
            <input className="ch-title" value={ch.title} onChange={(e) => setChapter(ci, { title: e.target.value })} />
            <div className="row">
              <button className="btn icon" onClick={() => setChapters(move(d.chapters, ci, -1))} aria-label="장 위로">▲</button>
              <button className="btn icon" onClick={() => setChapters(move(d.chapters, ci, 1))} aria-label="장 아래로">▼</button>
              <button className="btn icon" onClick={() => confirm(`'${ch.title}' 장을 지울까요?`) && setChapters(d.chapters.filter((_, i) => i !== ci))} aria-label="장 지우기">🗑</button>
            </div>
          </div>
          {ch.cards.map((c, ki) => (
            <div key={c.id} className="card-edit">
              <div className="row full">
                <textarea rows={2} value={c.text} placeholder="질문이나 이야기 문장" onChange={(e) => setCard(ci, ki, { text: e.target.value })} />
                <div className="col">
                  <button className="btn icon" onClick={() => setChapter(ci, { cards: move(ch.cards, ki, -1) })} aria-label="카드 위로">▲</button>
                  <button className="btn icon" onClick={() => setChapter(ci, { cards: move(ch.cards, ki, 1) })} aria-label="카드 아래로">▼</button>
                  <button className="btn icon" onClick={() => confirm('카드를 지울까요?') && setChapter(ci, { cards: ch.cards.filter((_, i) => i !== ki) })} aria-label="카드 지우기">🗑</button>
                </div>
              </div>
              <div className="row">
                <span className="label">🔊 읽어 주기</span>
                <button className="btn" onClick={() => speak(c.text)}>자동 읽기 듣기</button>
                <TeacherAudio room={room} tkey={tkey} path={c.audioPath} onChange={(p) => {
                  if (c.audioPath && c.audioPath !== p) fn('delete-asset', { room, key: tkey, path: c.audioPath }).catch(() => {})
                  setCard(ci, ki, { audioPath: p })
                }} />
              </div>
              <div className="row">
                <span className="label">넣을 것</span>
                {(['photo', 'video', 'both'] as MediaKind[]).map((m) => (
                  <button key={m} className={`btn ${c.media === m ? 'primary' : ''}`} onClick={() => setCard(ci, ki, { media: m })}>{MEDIA_LABEL[m]}</button>
                ))}
              </div>
              <div className="row">
                <span className="label">장소 힌트</span>
                <button className={`btn small-chip ${!c.place ? 'primary' : ''}`} onClick={() => setCard(ci, ki, { place: null })}>없음</button>
                {PLACES.map((p) => (
                  <button key={p.id} className={`btn small-chip ${c.place === p.id ? 'primary' : ''}`} onClick={() => setCard(ci, ki, { place: p.id })} title={p.label}>
                    {p.icon} {p.label}
                  </button>
                ))}
                <label className="check"><input type="checkbox" checked={c.placeLowOnly ?? true} onChange={(e) => setCard(ci, ki, { placeLowOnly: e.target.checked })} /> 하 수준만 보이기</label>
              </div>
              <div className="row">
                <span className="label">단어 카드</span>
                <input className="grow" defaultValue={c.words.join(', ')} placeholder="쉼표로 나눠요: 휠체어, 엘리베이터"
                  onBlur={(e) => setCard(ci, ki, { words: e.target.value.split(/[,，]/).map((w) => w.trim()).filter(Boolean).slice(0, 8) })} />
              </div>
            </div>
          ))}
          <button className="btn" onClick={() => setChapter(ci, { cards: [...ch.cards, newCard()] })}>➕ 카드 더하기</button>
        </div>
      ))}
      <button className="btn" onClick={() => setChapters([...d.chapters, newChapter(d.chapters.length + 1)])}>➕ 장 더하기</button>

      <div className="box">
        <h3>👋 마지막 인사 문구</h3>
        <input className="grow" value={d.greeting} onChange={(e) => setData({ greeting: e.target.value })} />
      </div>
      <div className="row end">
        <button className="btn" onClick={() => confirm('유초이음 기본 템플릿으로 바꿀까요? 지금 카드는 사라져요.') && change(yuchoTemplate())}>🏫 유초이음 기본으로 바꾸기</button>
        <button className="btn big primary" disabled={!dirty || busy} onClick={() => save()}>{dirty ? '💾 저장' : '저장됨'}</button>
      </div>
    </div>
  )
}
