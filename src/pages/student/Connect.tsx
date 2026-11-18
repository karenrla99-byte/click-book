import { useState } from 'react'
import FaceCrop from '../../components/FaceCrop'
import Guide from '../../components/Guide'
import ScenePreview from '../../components/ScenePreview'
import VoiceButton from '../../components/VoiceButton'
import { speak } from '../../lib/speak'
import { EFFECTS, Effect, SceneEdit, Sticker, emptyScene } from '../../lib/store'
import { FlatCard, freeTextOn } from '../../lib/template'
import { uid } from '../../lib/uid'
import { useStudent } from './ctx'
import { Thumb } from './Shoot'
import { useTeacherPhotos } from './useTeacherPhotos'

const EMOJIS = ['⭐', '❤️', '🌈', '😊', '👍', '🐰', '🐻', '🚌', '🍚', '🌸', '🎈', '🦋']

/** ③ 카드 고르기 → (사진이 없으면) 사진 고르는 창 → 꾸미기 */
export default function Connect() {
  const c = useStudent()
  const { cards, ns, project, update, go } = c
  useTeacherPhotos(c)
  const [open, setOpen] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)

  const link = (cardId: string, mediaId: string | null) => {
    update((p) => ({ ...p, scenes: { ...p.scenes, [cardId]: { ...(p.scenes[cardId] ?? emptyScene()), mediaId } } }))
  }
  const tapCard = (cardId: string) => {
    const has = project.scenes[cardId]?.mediaId
    if (has) setOpen(cardId)
    else setPicking(cardId)
  }

  const openCard = cards.find((x) => x.id === open)
  const pickCard = cards.find((x) => x.id === picking)

  return (
    <>
      {openCard ? (
        <Decorate card={openCard} onClose={() => setOpen(null)} onChangePhoto={() => setPicking(openCard.id)} />
      ) : (
        <div className="connect">
          <Guide step="connect" />
          <div className="slot-grid">
            {cards.map((card) => {
              const sc = project.scenes[card.id]
              const m = project.media.find((x) => x.id === sc?.mediaId)
              return (
                <button key={card.id} className={`slot ${m ? 'filled' : ''}`} onClick={() => tapCard(card.id)}>
                  <div className="slot-media">{m ? <Thumb ns={ns} m={m} /> : <span className="slot-add">＋ 사진 고르기</span>}</div>
                  <span className="slot-text">{card.text}</span>
                  <span className="slot-marks">
                    {sc?.voiceId ? '🎤' : ''}{sc?.text || sc?.words.length ? '💬' : ''}{sc?.stickers.length ? '⭐' : ''}
                    <b>{m ? ' 꾸미기 ▶' : ''}</b>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="row end">
            <button className="btn big primary" onClick={() => go('greet')}>다 했어요 ▶</button>
          </div>
        </div>
      )}
      {pickCard && (
        <PhotoPicker
          card={pickCard}
          current={project.scenes[pickCard.id]?.mediaId ?? null}
          onPick={(mediaId) => {
            link(pickCard.id, mediaId)
            setPicking(null)
            setOpen(pickCard.id)
            if (mediaId) speak('사진을 넣었어요')
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  )
}

/** 폰 사진 고르기처럼: 내가 찍은 사진 / 선생님 사진 */
function PhotoPicker({ card, current, onPick, onClose }: {
  card: FlatCard; current: string | null; onPick: (mediaId: string | null) => void; onClose: () => void
}) {
  const { ns, project, go } = useStudent()
  // 내 사진·선생님 사진 구분 없이 한곳에. 이 카드 것 먼저, 그다음 찍은 순서
  const list = [...project.media].sort((a, b) =>
    Number(b.cardId === card.id) - Number(a.cardId === card.id) || Number(!!a.teacher) - Number(!!b.teacher) || a.createdAt - b.createdAt)

  return (
    <div className="modal sheet" onClick={onClose}>
      <div className="modal-body picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <button className="btn" onClick={onClose}>✕ 닫기</button>
          <p className="picker-q">{card.text}</p>
          {current ? <button className="btn" onClick={() => onPick(null)}>사진 빼기</button> : <span className="picker-pad" />}
        </div>
        <div className="picker-grid">
          {list.map((m) => (
            <button key={m.id} className={`picker-item ${m.id === current ? 'on' : ''}`} onClick={() => onPick(m.id)}>
              <Thumb ns={ns} m={m} selected={m.id === current} />
              {m.cardId === card.id && <span className="picker-badge">이 카드</span>}
            </button>
          ))}
          {list.length === 0 && (
            <div className="picker-empty">
              <p className="hint">아직 사진이 없어요</p>
              <button className="btn big primary" onClick={() => go('shoot')}>📷 찍으러 가요</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type Tool = 'voice' | 'text' | 'sticker'

/** 꾸미기: 큰 미리보기 하나 + 도구는 하나씩만 펼침 */
function Decorate({ card, onClose, onChangePhoto }: { card: FlatCard; onClose: () => void; onChangePhoto: () => void }) {
  const { me, ns, project, update, template } = useStudent()
  const edit = project.scenes[card.id] ?? emptyScene()
  const media = project.media.find((m) => m.id === edit.mediaId)
  const level = me.level
  const canWrite = freeTextOn(template.data, level)
  const showWords = level !== '하' && card.words.length > 0
  const tools: { id: Tool; label: string }[] = [
    { id: 'voice', label: '🎤 말하기' },
    ...(canWrite || showWords ? [{ id: 'text' as Tool, label: '💬 자막' }] : []),
    ...(level !== '하' ? [{ id: 'sticker' as Tool, label: '⭐ 꾸미기' }] : []),
  ]
  const [tool, setTool] = useState<Tool | null>(level === '중' && tools.some((t) => t.id === 'text') ? 'text' : 'voice')
  const [sel, setSel] = useState<string | null>(null)
  const [faceFrom, setFaceFrom] = useState<string | null>(null)
  const [choosingFace, setChoosingFace] = useState(false)
  const photos = project.media.filter((m) => m.kind === 'photo')

  const set = (patch: Partial<SceneEdit>) =>
    update((p) => ({ ...p, scenes: { ...p.scenes, [card.id]: { ...(p.scenes[card.id] ?? emptyScene()), ...patch } } }))
  const setSticker = (id: string, patch: Partial<Sticker>) => set({ stickers: edit.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const addSticker = (s: Omit<Sticker, 'id' | 'x' | 'y' | 'size' | 'effect'>) => {
    const st: Sticker = { id: uid(), x: 0.3 + Math.random() * 0.4, y: 0.45 + Math.random() * 0.2, size: 0.25, effect: 'bounce', ...s }
    set({ stickers: [...edit.stickers, st] })
    setSel(st.id)
  }
  const selected = edit.stickers.find((s) => s.id === sel)
  const toggleWord = (w: string) => set({ words: edit.words.includes(w) ? edit.words.filter((x) => x !== w) : [...edit.words, w] })
  /** 직접 쓰기가 켜져 있으면 단어 카드가 자막 칸에 이어 붙음 (그다음 고쳐 쓸 수 있음) */
  const pickWord = (w: string) => {
    if (!canWrite) return toggleWord(w)
    const t = (edit.text ?? '').trim()
    set({ text: (t ? `${t} ${w}` : w).slice(0, 40) })
  }
  const wordOn = (w: string) => (canWrite ? (edit.text ?? '').includes(w) : edit.words.includes(w))

  return (
    <div className="decorate">
      <div className="deco-head">
        <button className="btn" onClick={onClose}>◀ 카드들</button>
        <p className="deco-q">{card.text}</p>
        <button className="btn" onClick={onChangePhoto}>🖼 사진 바꾸기</button>
        <button className="btn big primary" onClick={onClose}>✅ 다 했어요</button>
      </div>

      <div className="stage deco-stage">
        <ScenePreview ns={ns} card={card} edit={edit} media={media} selected={sel} onSelect={setSel}
          onMove={(id, x, y) => setSticker(id, { x, y })} />
      </div>

      {selected ? (
        <div className="deco-panel">
          <div className="row center">
            {EFFECTS.map((ef) => (
              <button key={ef.id} className={`btn ${selected.effect === ef.id ? 'primary' : ''}`} onClick={() => setSticker(selected.id, { effect: ef.id as Effect })}>{ef.label}</button>
            ))}
          </div>
          <div className="row center">
            <button className="btn icon" onClick={() => setSticker(selected.id, { size: Math.max(0.1, selected.size - 0.05) })} aria-label="작게">➖</button>
            <button className="btn icon" onClick={() => setSticker(selected.id, { size: Math.min(0.7, selected.size + 0.05) })} aria-label="크게">➕</button>
            <button className="btn icon" onClick={() => { set({ stickers: edit.stickers.filter((s) => s.id !== selected.id) }); setSel(null) }} aria-label="스티커 지우기">🗑</button>
            <button className="btn primary" onClick={() => setSel(null)}>좋아요</button>
          </div>
        </div>
      ) : (
        <>
          {tools.length > 1 && (
            <div className="tool-tabs">
              {tools.map((t) => (
                <button key={t.id} className={`tool-tab ${tool === t.id ? 'on' : ''}`} onClick={() => setTool(tool === t.id ? null : t.id)}>{t.label}</button>
              ))}
            </div>
          )}

          {tool === 'voice' && (
            <div className="deco-panel">
              <p className="hint">{level === '상' ? '내 말로 답해요' : '한 마디 해요 (안 해도 돼요)'}</p>
              <VoiceButton ns={ns} blobId={edit.voiceId} onChange={(id, d) => set({ voiceId: id, voiceDuration: d })} />
            </div>
          )}

          {tool === 'text' && (
            <div className="deco-panel">
              {showWords && (
                <div className="row center">
                  {card.words.map((w) => (
                    <button key={w} className={`btn word ${wordOn(w) ? 'primary' : ''}`} onClick={() => { pickWord(w); speak(w) }}>{w}</button>
                  ))}
                </div>
              )}
              {canWrite && (
                <div className="row center">
                  <input className="deco-input" value={edit.text ?? ''} maxLength={40} placeholder="자막을 써요" onChange={(e) => set({ text: e.target.value })} />
                  {!!edit.text && <button className="btn icon" onClick={() => set({ text: '' })} aria-label="자막 지우기">⌫</button>}
                </div>
              )}
            </div>
          )}

          {tool === 'sticker' && (
            <div className="deco-panel">
              <div className="row center">
                {photos.length > 0 && <button className="btn" onClick={() => setChoosingFace(true)}>😀 얼굴 쏙</button>}
                {media?.kind === 'photo' && (
                  <button className={`btn ${edit.kenBurns ? 'primary' : ''}`} onClick={() => set({ kenBurns: !edit.kenBurns })}>
                    🔍 확대 {edit.kenBurns ? '켜짐' : '꺼짐'}
                  </button>
                )}
                {EMOJIS.map((em) => <button key={em} className="btn icon emoji" onClick={() => addSticker({ kind: 'emoji', emoji: em })}>{em}</button>)}
              </div>
              <p className="muted center-text deco-tip">붙인 것을 누르면 움직임을 고르고, 끌어서 옮겨요</p>
            </div>
          )}
        </>
      )}

      {choosingFace && (
        <div className="modal" onClick={() => setChoosingFace(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <h2>얼굴이 있는 사진을 골라요</h2>
            <div className="photobox-grid">
              {photos.map((m) => (
                <div key={m.id} className="pb-item" onClick={() => { setFaceFrom(m.id); setChoosingFace(false) }}><Thumb ns={ns} m={m} /></div>
              ))}
            </div>
            <button className="btn" onClick={() => setChoosingFace(false)}>그만두기</button>
          </div>
        </div>
      )}
      {faceFrom && (
        <FaceCrop ns={ns} photoId={faceFrom} onClose={() => setFaceFrom(null)}
          onDone={(blobId) => { setFaceFrom(null); addSticker({ kind: 'face', blobId }) }} />
      )}
    </div>
  )
}
