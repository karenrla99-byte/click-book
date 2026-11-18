import { useEffect, useState } from 'react'
import { speak } from '../../lib/speak'
import Guide from '../../components/Guide'
import { placeOf } from '../../lib/template'
import { useStudent } from './ctx'

/** ① 카드 보기: 여는 영상 → 카드 한 장씩 */
export default function View() {
  const { template, cards, me, assetUrl, go } = useStudent()
  const opening = template.data.opening
  const [i, setI] = useState(opening ? -1 : 0)
  const [openUrl, setOpenUrl] = useState<string>()

  useEffect(() => { if (opening) assetUrl(opening.path).then(setOpenUrl) }, [opening, assetUrl])

  const card = cards[i]
  const read = async () => {
    if (!card) return
    speak(card.text, card.audioPath ? await assetUrl(card.audioPath) : null)
  }
  useEffect(() => { if (card) read() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  if (i === -1 && opening) return (
    <div className="page-center">
      <h1 className="page-title">🎬 {template.title}</h1>
      {openUrl
        ? opening.kind === 'video'
          ? <video className="opening" src={openUrl} controls autoPlay playsInline onEnded={() => setI(0)} />
          : <img className="opening" src={openUrl} alt="" />
        : <p>불러오는 중이에요…</p>}
      <button className="btn big primary" onClick={() => setI(0)}>카드 보기 ▶</button>
    </div>
  )

  const pl = placeOf(card?.place)
  const showPlace = pl && (!card.placeLowOnly || me.level === '하')
  const last = i === cards.length - 1

  return (
    <div className="page-center">
      <Guide step="view" />
      <p className="room-name">{i + 1} / {cards.length}</p>
      <div className="story-book">
        <div className="sb-page sb-left">
          <span className="eyebrow">{card.chapterTitle}</span>
          {showPlace
            ? <div className="place-hint">{pl.icon}<span>{pl.label}</span></div>
            : <span className="sb-num">{i + 1}</span>}
        </div>
        <div className="sb-page sb-right">
          <p className="story-text">{card.text}</p>
          <button className="btn icon big-icon" onClick={read} aria-label="읽어 주기">🔊</button>
        </div>
      </div>
      <div className="row center">
        <button className="btn huge" disabled={i === 0 && !opening} onClick={() => setI(i - 1)}>◀</button>
        {last
          ? <button className="btn huge primary" onClick={() => go('shoot')}>📷 찍으러 가요</button>
          : <button className="btn huge primary" onClick={() => setI(i + 1)}>▶</button>}
      </div>
    </div>
  )
}
