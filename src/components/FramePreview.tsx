import { useEffect, useRef } from 'react'
import { Assets, H, TScene, W, drawScene, loadFonts } from '../lib/render'
import { emptyScene } from '../lib/store'
import { Card, FlatCard } from '../lib/template'

type Props = {
  kind: 'title' | 'card' | 'greeting' | 'credits'
  card?: Card
  title?: string
  roomName?: string
  value?: string
  placeholder?: string
  onChange?: (v: string) => void
}

const EMPTY: Assets = { images: new Map(), videos: new Map(), audio: new Map(), urls: [] }
const NAME = '○○'

/** 완성 영상에 나오는 모습 그대로 그리고, 글씨는 그 자리에서 바로 고친다 */
export default function FramePreview({ kind, card, title = '', roomName = '', value = '', placeholder, onChange }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const words = card?.words.slice(0, 2).join(' · ') ?? ''

  useEffect(() => {
    let live = true
    const draw = () => {
      const ctx = ref.current?.getContext('2d')
      if (!ctx || !live) return
      let sc: TScene
      let at = 0
      if (kind === 'title') { sc = { kind: 'title', dur: 3, title: '', name: NAME }; at = 2 }
      else if (kind === 'greeting') sc = { kind: 'greeting', dur: 5, prompt: '', greeting: { blobId: '-', kind: 'audio' }, name: NAME }
      else if (kind === 'credits') { sc = { kind: 'credits', dur: 5, title, byline: `만든 사람: ${roomName} ${NAME}`, thumbs: [] }; at = 2 }
      else {
        const fc = { ...(card as Card), text: '', chapterTitle: '', chapterIndex: 0, index: 0 } as FlatCard
        sc = { kind: 'card', dur: 4, card: fc, edit: { ...emptyScene(), words: words ? [words] : [] } }
      }
      drawScene(ctx, sc, at, EMPTY)
    }
    draw()
    loadFonts().then(draw)
    return () => { live = false }
  }, [kind, card?.place, words, title, roomName, card])

  const editable = !!onChange && kind !== 'credits'
  return (
    <div className="frame">
      <canvas ref={ref} width={W} height={H} />
      {editable && (
        <textarea
          className={`frame-edit ${kind === 'title' ? 'title' : 'banner'}`}
          value={value}
          rows={kind === 'title' ? 2 : 1}
          placeholder={placeholder}
          onChange={(e) => onChange!(e.target.value.replace(/\n/g, ' '))}
        />
      )}
      {kind === 'card' && words && <span className="frame-note bottom">자막 예: 아이가 고른 단어·쓴 글</span>}
      {editable && <span className="frame-note">✏️ 글씨를 눌러 고쳐요</span>}
    </div>
  )
}
