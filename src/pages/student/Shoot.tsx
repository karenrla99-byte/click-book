import { useState } from 'react'
import Camera from '../../components/Camera'
import Guide from '../../components/Guide'
import { useBlobUrl } from '../../lib/blobUrl'
import { speak } from '../../lib/speak'
import { MediaItem, delBlob, emptyScene, putBlob } from '../../lib/store'
import { placeOf } from '../../lib/template'
import { uid } from '../../lib/uid'
import { useStudent } from './ctx'

/** ② 촬영: 위에 지금 카드, 아래에 큰 버튼 */
export default function Shoot() {
  const { cards, me, ns, project, update, assetUrl, go } = useStudent()
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState('')
  const card = cards[i]
  const pl = placeOf(card.place)
  const showPlace = pl && (!card.placeLowOnly || me.level === '하')
  const mine = project.media.filter((m) => m.cardId === card.id && !m.teacher)

  const add = async (blob: Blob, kind: 'photo' | 'video', duration?: number) => {
    const id = await putBlob(ns, blob, uid())
    const item: MediaItem = { id, kind, cardId: card.id, createdAt: Date.now(), duration }
    update((p) => {
      const next = { ...p, media: [...p.media, item] }
      // '하' 수준: 찍은 카드에 바로 연결 (가장 최근 것)
      if (me.level === '하') next.scenes = { ...p.scenes, [card.id]: { ...(p.scenes[card.id] ?? emptyScene()), mediaId: id } }
      return next
    })
    setSaved(kind === 'photo' ? '📷 사진을 넣었어요!' : '🎥 영상을 넣었어요!')
    setTimeout(() => setSaved(''), 1500)
  }

  const remove = (m: MediaItem) => {
    if (!confirm('지울까요?')) return
    update((p) => ({
      ...p,
      media: p.media.filter((x) => x.id !== m.id),
      scenes: Object.fromEntries(Object.entries(p.scenes).map(([k, s]) => [k, s.mediaId === m.id ? { ...s, mediaId: null } : s])),
    }))
    delBlob(ns, m.id)
  }

  const read = async () => speak(card.text, card.audioPath ? await assetUrl(card.audioPath) : null)
  const done = project.media.some((m) => !m.teacher)

  return (
    <div className="shoot">
      <Guide step="shoot" />
      <div className="shoot-card">
        <button className="btn icon" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="앞 카드">◀</button>
        <div className="shoot-text">
          {showPlace && <span className="place-chip">{pl.icon} {pl.label}</span>}
          <span>{card.text}</span>
          <button className="btn icon" onClick={read} aria-label="읽어 주기">🔊</button>
        </div>
        <span className="muted">{i + 1}/{cards.length}</span>
        <button className="btn icon" onClick={() => setI(Math.min(cards.length - 1, i + 1))} disabled={i === cards.length - 1} aria-label="다음 카드">▶</button>
      </div>

      <Camera key={card.id} mode={card.media} maxSec={10} onPhoto={(b) => add(b, 'photo')} onVideo={(b, d) => add(b, 'video', d)} />
      {saved && <div className="toast">{saved}</div>}

      <div className="shoot-bottom">
        <div className="thumbs">
          {mine.map((m) => <Thumb key={m.id} ns={ns} m={m} onRemove={() => remove(m)} />)}
          {mine.length === 0 && <span className="muted">이 카드에서 찍은 것이 여기 보여요</span>}
        </div>
        {done && (
          <button className="btn big primary" onClick={() => go(me.level === '하' ? 'greet' : 'connect')}>
            다 찍었어요 ▶
          </button>
        )}
      </div>
    </div>
  )
}

export function Thumb({ ns, m, onRemove, selected, small }: { ns: string; m: MediaItem; onRemove?: () => void; selected?: boolean; small?: boolean }) {
  const url = useBlobUrl(ns, m.id)
  return (
    <div className={`thumb ${selected ? 'selected' : ''} ${small ? 'small' : ''}`}>
      {url && (m.kind === 'photo' ? <img src={url} alt="" draggable={false} /> : <video src={url + '#t=0.1'} muted playsInline preload="metadata" />)}
      {m.kind === 'video' && <span className="thumb-badge">🎥 {m.duration ? Math.round(m.duration) + '초' : ''}</span>}
      {onRemove && <button className="thumb-del" onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label="지우기">✕</button>}
    </div>
  )
}
