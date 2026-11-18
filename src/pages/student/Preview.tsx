import { useEffect, useRef, useState } from 'react'
import Guide from '../../components/Guide'
import { H, Player, W, disposeAssets } from '../../lib/render'
import { useStudent } from './ctx'
import { prepare } from './useTimeline'

/** ⑤ 미리보기: 그림책처럼 넘기며 재생 (MP4와 같은 렌더러) */
export default function Preview() {
  const c = useStudent()
  const canvas = useRef<HTMLCanvasElement>(null)
  const player = useRef<Player | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let live = true
    let raf = 0
    const ac = new AudioContext()
    let cleanup = () => {}
    prepare(c, ac).then(({ assets, tl }) => {
      if (!live) return disposeAssets(assets)
      const p = new Player(tl, assets, ac, ac.destination)
      player.current = p
      setTotal(p.total)
      setCount(tl.filter((s) => s.kind === 'card').length)
      setReady(true)
      const loop = () => {
        const ctx = canvas.current?.getContext('2d')
        if (ctx) {
          const t = p.time()
          if (p.playing && t >= p.total) { p.stop(); setPlaying(false) }
          p.frame(ctx, p.time())
          setPos(p.time())
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      cleanup = () => { p.stop(); disposeAssets(assets) }
    })
    return () => { live = false; cancelAnimationFrame(raf); cleanup(); ac.close() }
    // 화면에 들어올 때 한 번만 준비
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async () => {
    const p = player.current
    if (!p) return
    if (p.playing) { p.pause(); setPlaying(false) } else { await p.play(); setPlaying(true) }
  }
  const restart = async () => {
    const p = player.current
    if (!p) return
    p.stop()
    await p.play(0)
    setPlaying(true)
  }

  return (
    <div className="page-center preview-page">
      <Guide step="preview" />
      <div className="stage">
      <div className="preview-wrap">
        <canvas ref={canvas} width={W} height={H} className="preview-canvas" onClick={toggle} />
        {!ready && <div className="cam-wait">그림책을 펼치는 중이에요…</div>}
      </div>
      </div>
      <div className="bar thin"><div style={{ width: `${total ? (pos / total) * 100 : 0}%` }} /></div>
      <div className="row center">
        <button className="btn icon" onClick={restart} disabled={!ready} aria-label="처음부터">⏮</button>
        <button className="btn huge primary" onClick={toggle} disabled={!ready}>{playing ? '⏸ 멈춰요' : '▶ 봐요'}</button>
        <span className="muted">{Math.round(pos)}초 / {Math.round(total)}초 · 장면 {count}개</span>
      </div>
      {ready && count === 0 && <p className="warn">아직 카드에 넣은 사진이 없어요. ③ 꾸미기에서 넣어요.</p>}
      <button className="btn big" onClick={() => c.go('send')}>📤 보내러 가요</button>
    </div>
  )
}
