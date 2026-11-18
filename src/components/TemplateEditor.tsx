import { useEffect, useRef, useState } from 'react'
import { assetUrls, fn, uploadAsset } from '../lib/api'
import { ping } from '../lib/realtime'
import { shrinkImage } from '../lib/media'
import { downloadBlob } from '../lib/record'
import { speak } from '../lib/speak'
import { friendly, rpc } from '../lib/supabase'
import {
  Card, Chapter, DEFAULT_FREE_TEXT, DEFAULT_GUIDES, Guide, Level, MEDIA_LABEL, MediaKind, PLACES, STEP_INFO, StepKey, Template,
  emptyTemplate, exportTemplate, importTemplate, newCard, newChapter, yuchoTemplate,
} from '../lib/template'
import FramePreview from './FramePreview'
import TeacherAudio from './TeacherAudio'

type Props = { room: string; tkey: string; roomName: string }

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const n = [...arr]
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

export default function TemplateEditor({ room, tkey, roomName }: Props) {
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

  // 선생님 사진 미리보기 주소
  const tRef = useRef(t)
  tRef.current = t
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const photoKey = (t?.data.chapters ?? []).flatMap((ch) => ch.cards.flatMap((c) => c.photos ?? [])).join('|')
  useEffect(() => {
    const paths = photoKey ? photoKey.split('|') : []
    const need = paths.filter((p) => !photoUrls[p])
    if (need.length) assetUrls({ room, key: tkey }, need).then((u) => setPhotoUrls((o) => ({ ...o, ...u }))).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey, room, tkey])

  const withCardPhotos = (tpl: Template, ci: number, ki: number, fnc: (photos: string[]) => string[]): Template => ({
    ...tpl,
    data: {
      ...tpl.data,
      chapters: tpl.data.chapters.map((ch, i) => (i !== ci ? ch : {
        ...ch, cards: ch.cards.map((c, j) => (j !== ki ? c : { ...c, photos: fnc(c.photos ?? []) })),
      })),
    },
  })
  const addPhotos = async (ci: number, ki: number, files: File[]) => {
    if (!files.length) return
    setBusy(true)
    setMsg('사진을 올리는 중이에요…')
    try {
      const paths: string[] = []
      for (const f of files.slice(0, 6)) paths.push(await uploadAsset(room, tkey, await shrinkImage(f), 'jpg'))
      const next = withCardPhotos(tRef.current!, ci, ki, (ps) => [...ps, ...paths].slice(0, 6))
      setT(next)
      await save(next)
    } catch (e) { setMsg(friendly(e)) }
    setBusy(false)
  }
  const removePhoto = async (ci: number, ki: number, path: string) => {
    if (!confirm('이 사진을 뺄까요?')) return
    fn('delete-asset', { room, key: tkey, path }).catch(() => {})
    const next = withCardPhotos(tRef.current!, ci, ki, (ps) => ps.filter((p) => p !== path))
    setT(next)
    await save(next)
  }

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

  const setGuide = (step: StepKey, patch: Guide) =>
    setData({ guides: { ...(d.guides ?? {}), [step]: { ...(d.guides?.[step] ?? {}), ...patch } } })
  const freeText = d.freeText ?? DEFAULT_FREE_TEXT
  const LEVELS: Level[] = ['상', '중', '하']

  return (
    <div className="tpl">
      <div className="row-between sticky-bar">
        <span className="tpl-title">📚 {t.title || '이야기'}</span>
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
      <p className="hint">학생 영상에 나오는 순서와 모습 그대로예요. 장면 위 글씨를 눌러 바로 고쳐요.</p>

      <div className="box">
        <h3>🎬 여는 장면</h3>
        <p className="muted">영상 맨 앞에 나와요. 영상이나 사진 <b>파일</b>을 올려요. (유튜브 주소는 넣을 수 없어요)</p>
        {opening && openUrl && (opening.kind === 'video'
          ? <video src={openUrl} controls className="opening small" />
          : <img src={openUrl} alt="" className="opening small" />)}
        <button className="btn" disabled={busy} onClick={() => openRef.current?.click()}>{opening ? '🔁 바꾸기' : '📁 파일 올리기'}</button>
        {opening && <button className="btn icon" onClick={() => { fn('delete-asset', { room, key: tkey, path: opening.path }).catch(() => {}); const n = { ...t, data: { ...d, opening: null } }; setT(n); save(n) }} aria-label="여는 장면 지우기">🗑</button>}
        <input ref={openRef} hidden type="file" accept="video/*,image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadOpening(f) }} />
        <p className="muted">유치원생 얼굴이 나오면 수업 뒤 지워 주세요.</p>
      </div>

      <h3 className="scene-label">📖 시작 장면 — 이야기 제목</h3>
      <div className="scene-row">
        <FramePreview kind="title" value={t.title} placeholder="이야기 제목" onChange={(v) => change({ ...t, title: v })} />
        <p className="hint">학생 이름은 영상에서 저절로 들어가요.</p>
      </div>

      {d.chapters.map((ch, ci) => (
        <div key={ch.id} className="box chapter">
          <div className="row-between full">
            <input className="ch-title" value={ch.title} placeholder="장 이름 (예: 등교)" onChange={(e) => setChapter(ci, { title: e.target.value })} />
            <div className="row">
              <button className="btn icon" onClick={() => setChapters(move(d.chapters, ci, -1))} aria-label="장 위로">▲</button>
              <button className="btn icon" onClick={() => setChapters(move(d.chapters, ci, 1))} aria-label="장 아래로">▼</button>
              <button className="btn icon" onClick={() => confirm(`'${ch.title}' 장을 지울까요?`) && setChapters(d.chapters.filter((_, i) => i !== ci))} aria-label="장 지우기">🗑</button>
            </div>
          </div>
          {ch.cards.map((c, ki) => (
            <div key={c.id} className="card-edit scene-row">
              <FramePreview kind="card" card={c} value={c.text} placeholder="질문이나 이야기 문장" onChange={(v) => setCard(ci, ki, { text: v })} />
              <div className="scene-side">
                <div className="row-between">
                  <span className="label">카드 {ki + 1}</span>
                  <div className="row">
                    <button className="btn icon" onClick={() => setChapter(ci, { cards: move(ch.cards, ki, -1) })} aria-label="카드 위로">▲</button>
                    <button className="btn icon" onClick={() => setChapter(ci, { cards: move(ch.cards, ki, 1) })} aria-label="카드 아래로">▼</button>
                    <button className="btn icon" onClick={() => confirm('카드를 지울까요?') && setChapter(ci, { cards: ch.cards.filter((_, i) => i !== ki) })} aria-label="카드 지우기">🗑</button>
                  </div>
                </div>
                <div className="row">
                  <span className="label">🔊 읽어 주기</span>
                  <button className="btn small" onClick={() => speak(c.text)}>자동 읽기</button>
                  <TeacherAudio room={room} tkey={tkey} path={c.audioPath} onChange={(p) => {
                    if (c.audioPath && c.audioPath !== p) fn('delete-asset', { room, key: tkey, path: c.audioPath }).catch(() => {})
                    setCard(ci, ki, { audioPath: p })
                  }} />
                </div>
                <div className="row">
                  <span className="label">넣을 것</span>
                  {(['photo', 'video', 'both'] as MediaKind[]).map((m) => (
                    <button key={m} className={`btn small ${c.media === m ? 'primary' : ''}`} onClick={() => setCard(ci, ki, { media: m })}>{MEDIA_LABEL[m]}</button>
                  ))}
                </div>
                <div className="row">
                  <span className="label">장소 힌트</span>
                  <button className={`btn small-chip ${!c.place ? 'primary' : ''}`} onClick={() => setCard(ci, ki, { place: null })}>없음</button>
                  {PLACES.map((p) => (
                    <button key={p.id} className={`btn small-chip ${c.place === p.id ? 'primary' : ''}`} onClick={() => setCard(ci, ki, { place: p.id })} title={p.label}>{p.icon} {p.label}</button>
                  ))}
                  <label className="check"><input type="checkbox" checked={c.placeLowOnly ?? true} onChange={(e) => setCard(ci, ki, { placeLowOnly: e.target.checked })} /> 하 수준만 보이기</label>
                </div>
                <div className="col">
                  <span className="label">🧑‍🏫 선생님 사진 (학생 사진함에 나와요, 최대 6장)</span>
                  <div className="teacher-photos">
                    {(c.photos ?? []).map((p) => (
                      <div key={p} className="tp">
                        {photoUrls[p] && <img src={photoUrls[p]} alt="" />}
                        <button className="thumb-del" onClick={() => removePhoto(ci, ki, p)} aria-label="사진 빼기">✕</button>
                      </div>
                    ))}
                    {(c.photos?.length ?? 0) < 6 && (
                      <label className={`btn small ${busy ? 'disabled' : ''}`}>
                        ➕ 사진 올리기
                        <input hidden type="file" accept="image/*" multiple disabled={busy}
                          onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; addPhotos(ci, ki, fs) }} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="col">
                  <span className="label">단어 카드 (중 수준)</span>
                  <input defaultValue={c.words.join(', ')} placeholder="쉼표로 나눠요: 휠체어, 엘리베이터"
                    onBlur={(e) => setCard(ci, ki, { words: e.target.value.split(/[,，]/).map((w) => w.trim()).filter(Boolean).slice(0, 8) })} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn" onClick={() => setChapter(ci, { cards: [...ch.cards, newCard()] })}>➕ 카드 더하기</button>
        </div>
      ))}
      <button className="btn" onClick={() => setChapters([...d.chapters, newChapter(d.chapters.length + 1)])}>➕ 장 더하기</button>

      <h3 className="scene-label">👋 인사 장면</h3>
      <div className="scene-row">
        <FramePreview kind="greeting" value={d.greeting} placeholder="마지막 인사 문구" onChange={(v) => setData({ greeting: v })} />
        <p className="hint">학생이 영상이나 목소리로 인사를 넣어요. 영상이면 그 영상 위에 이 문구가 나와요.</p>
      </div>

      <h3 className="scene-label">🎞 엔딩</h3>
      <div className="scene-row">
        <FramePreview kind="credits" title={t.title} roomName={roomName} />
        <p className="hint">만든 사람, 학생이 찍은 사진, 저작권이 저절로 들어가요.</p>
      </div>

      <div className="box">
        <h3>🗒 단계별 안내 문구</h3>
        <p className="muted">학생 화면 위에 나오고 🔊로 읽어 줘요. 비워 두면 기본 문구가 나와요.</p>
        {STEP_INFO.map(({ key, label }) => {
          const g = d.guides?.[key] ?? {}
          const def = DEFAULT_GUIDES[key]
          const perLevel = LEVELS.some((l) => g[l]) || def.하 !== undefined
          return (
            <div key={key} className="guide-row">
              <strong>{label}</strong>
              <div>
                <textarea rows={1} value={g.all ?? ''} placeholder={def.all} onChange={(e) => setGuide(key, { all: e.target.value })} />
                <details open={perLevel}>
                  <summary className="muted">수준별로 다르게</summary>
                  <div className="guide-levels">
                    {LEVELS.map((l) => (
                      <label key={l} style={{ display: 'contents' }}>
                        <span className="label">{l}</span>
                        <input value={g[l] ?? ''} placeholder={def[l] ?? (g.all || def.all)} onChange={(e) => setGuide(key, { [l]: e.target.value })} />
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )
        })}
      </div>

      <div className="box">
        <h3>✏️ 꾸미기에서 자막 직접 쓰기</h3>
        <p className="muted">켜면 학생이 자막을 직접 써요. 중 수준은 단어 카드를 누르면 자막 칸에 들어가고 고쳐 쓸 수 있어요.</p>
        {LEVELS.map((l) => (
          <button key={l} className={`btn ${freeText[l] ? 'primary' : ''}`} onClick={() => setData({ freeText: { ...freeText, [l]: !freeText[l] } })}>
            {l} {freeText[l] ? '켜짐' : '꺼짐'}
          </button>
        ))}
      </div>

      <div className="row end">
        <button className="btn" onClick={() => confirm('유초이음 기본 템플릿으로 바꿀까요? 지금 카드는 사라져요.') && change(yuchoTemplate())}>🏫 유초이음 기본으로 바꾸기</button>
        <button className="btn big primary" disabled={!dirty || busy} onClick={() => save()}>{dirty ? '💾 저장' : '저장됨'}</button>
      </div>
    </div>
  )
}
