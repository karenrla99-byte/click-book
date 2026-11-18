import { useState } from 'react'
import FaceCrop from '../../components/FaceCrop'
import ScenePreview from '../../components/ScenePreview'
import VoiceButton from '../../components/VoiceButton'
import { startDrag, wasDragged } from '../../lib/drag'
import { speak } from '../../lib/speak'
import { EFFECTS, Effect, SceneEdit, Sticker, emptyScene } from '../../lib/store'
import { FlatCard } from '../../lib/template'
import { uid } from '../../lib/uid'
import { useStudent } from './ctx'
import { Thumb } from './Shoot'

const EMOJIS = ['⭐', '❤️', '🌈', '😊', '👍', '🐰', '🐻', '🚌', '🍚', '🌸', '🎈', '🦋']

/** ③ 연결하기 + 꾸미기 (수준별) */
export default function Connect() {
  const { cards, me, ns, project, update, go } = useStudent()
  const [picked, setPicked] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const link = (cardId: string, mediaId: string) => {
    update((p) => ({ ...p, scenes: { ...p.scenes, [cardId]: { ...(p.scenes[cardId] ?? emptyScene()), mediaId } } }))
    setPicked(null)
    speak('연결했어요')
  }

  const openCard = cards.find((c) => c.id === open)
  if (openCard) return <Decorate card={openCard} onClose={() => setOpen(null)} />

  const hint = me.level === '하'
    ? '찍은 사진이 카드에 벌써 들어갔어요. 카드를 누르면 한 마디 녹음할 수 있어요.'
    : '사진을 끌어서 카드에 놓아요. (사진을 누르고 → 카드를 눌러도 돼요)'

  return (
    <div className="connect">
      <p className="hint">
        {hint} <button className="btn icon" onClick={() => speak(hint)} aria-label="읽어 주기">🔊</button>
      </p>
      <div className="connect-grid">
        <div className="slots">
          {cards.map((c) => {
            const s = project.scenes[c.id]
            const m = project.media.find((x) => x.id === s?.mediaId)
            return (
              <div
                key={c.id}
                data-drop={c.id}
                className={`slot ${m ? 'filled' : ''} ${picked ? 'ready' : ''}`}
                onClick={() => (picked ? link(c.id, picked) : setOpen(c.id))}
              >
                <div className="slot-media">{m ? <Thumb ns={ns} m={m} small /> : <span>여기에 놓아요</span>}</div>
                <div className="slot-text">
                  <span className="muted">{c.chapterTitle}</span>
                  <span>{c.text}</span>
                  <span className="slot-marks">
                    {s?.voiceId && '🎤'} {(s?.words.length || s?.text) && '💬'} {s?.stickers.length ? '⭐' : ''}
                  </span>
                </div>
                <span className="slot-go">꾸미기 ▶</span>
              </div>
            )
          })}
        </div>
        <div className="photobox">
          <h3>📸 내 사진함</h3>
          {project.media.length === 0 && <p className="muted">아직 찍은 것이 없어요. ② 찍기에서 찍어요.</p>}
          <div className="photobox-grid">
            {project.media.map((m) => (
              <div
                key={m.id}
                className="pb-item"
                onPointerDown={(e) => startDrag(e, (cardId) => link(cardId, m.id))}
                onClick={(e) => { if (!wasDragged(e.currentTarget)) setPicked(picked === m.id ? null : m.id) }}
              >
                <Thumb ns={ns} m={m} selected={picked === m.id} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="row end">
        <button className="btn big primary" onClick={() => go('greet')}>다 했어요 ▶</button>
      </div>
    </div>
  )
}

function Decorate({ card, onClose }: { card: FlatCard; onClose: () => void }) {
  const { me, ns, project, update } = useStudent()
  const edit = project.scenes[card.id] ?? emptyScene()
  const media = project.media.find((m) => m.id === edit.mediaId)
  const [sel, setSel] = useState<string | null>(null)
  const [faceFrom, setFaceFrom] = useState<string | null>(null)
  const [choosingFace, setChoosingFace] = useState(false)
  const photos = project.media.filter((m) => m.kind === 'photo')
  const level = me.level

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

  return (
    <div className="decorate">
      <div className="decorate-left">
        <ScenePreview ns={ns} card={card} edit={edit} media={media} selected={sel} onSelect={setSel}
          onMove={(id, x, y) => setSticker(id, { x, y })} />
        {selected && (
          <div className="tool-row">
            {EFFECTS.map((ef) => (
              <button key={ef.id} className={`btn ${selected.effect === ef.id ? 'primary' : ''}`} onClick={() => setSticker(selected.id, { effect: ef.id as Effect })}>{ef.label}</button>
            ))}
            <button className="btn icon" onClick={() => setSticker(selected.id, { size: Math.max(0.1, selected.size - 0.05) })} aria-label="작게">➖</button>
            <button className="btn icon" onClick={() => setSticker(selected.id, { size: Math.min(0.7, selected.size + 0.05) })} aria-label="크게">➕</button>
            <button className="btn icon" onClick={() => { set({ stickers: edit.stickers.filter((s) => s.id !== selected.id) }); setSel(null) }} aria-label="스티커 지우기">🗑</button>
          </div>
        )}
      </div>

      <div className="decorate-right">
        <div className="row-between">
          <h3>{card.text}</h3>
        </div>

        <section>
          <h4>{level === '상' ? '🎤 내 말로 답해요' : '🎤 한 마디 해요 (해도 되고 안 해도 돼요)'}</h4>
          <VoiceButton ns={ns} blobId={edit.voiceId} onChange={(id, d) => set({ voiceId: id, voiceDuration: d })} />
        </section>

        {level === '상' && (
          <section>
            <h4>✏️ 글로 써도 돼요</h4>
            <input value={edit.text ?? ''} maxLength={40} placeholder="자막으로 나와요" onChange={(e) => set({ text: e.target.value })} />
          </section>
        )}

        {level !== '하' && card.words.length > 0 && (
          <section>
            <h4>💬 단어 카드를 골라요</h4>
            <div className="row">
              {card.words.map((w) => (
                <button key={w} className={`btn word ${edit.words.includes(w) ? 'primary' : ''}`} onClick={() => { toggleWord(w); speak(w) }}>{w}</button>
              ))}
            </div>
          </section>
        )}

        {level !== '하' && (
          <section>
            <h4>⭐ 붙이기 (누르고 화면에서 끌어서 옮겨요)</h4>
            <div className="row">
              {EMOJIS.map((em) => <button key={em} className="btn icon emoji" onClick={() => addSticker({ kind: 'emoji', emoji: em })}>{em}</button>)}
              <button className="btn" onClick={() => setChoosingFace(true)} disabled={!photos.length}>😀 얼굴 쏙</button>
            </div>
          </section>
        )}

        {media?.kind === 'photo' && (
          <section className="row">
            <button className={`btn ${edit.kenBurns ? 'primary' : ''}`} onClick={() => set({ kenBurns: !edit.kenBurns })}>
              🔍 천천히 확대 {edit.kenBurns ? '켜짐' : '꺼짐'}
            </button>
          </section>
        )}

        <div className="row end">
          {media && <button className="btn" onClick={() => set({ mediaId: null })}>사진 빼기</button>}
          <button className="btn big primary" onClick={onClose}>✅ 다 했어요</button>
        </div>
      </div>

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
