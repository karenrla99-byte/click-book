import { useEffect, useRef, useState } from 'react'
import { Assets, H, TScene, W, disposeAssets, drawScene, loadAssets, sceneDuration } from '../lib/render'
import { FlatCard } from '../lib/template'
import { MediaItem, Project, SceneEdit, emptyProject } from '../lib/store'

type Props = {
  ns: string
  card: FlatCard
  edit: SceneEdit
  media?: MediaItem
  selected?: string | null
  onSelect?: (id: string | null) => void
  onMove?: (id: string, x: number, y: number) => void
}

/** 꾸미기 화면의 움직이는 미리보기 (MP4와 같은 drawScene 사용) */
export default function ScenePreview({ ns, card, edit, media, selected, onSelect, onMove }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [assets, setAssets] = useState<Assets | null>(null)
  const drag = useRef<{ id: string; x: number; y: number } | null>(null)
  const latest = useRef({ edit, media, assets, selected })
  latest.current = { edit, media, assets, selected }

  const faceKey = edit.stickers.filter((s) => s.kind === 'face').map((s) => s.blobId).join(',')
  useEffect(() => {
    let live = true
    let loaded: Assets | null = null
    const p: Project = { ...emptyProject(), media: media ? [media] : [], scenes: { [card.id]: { ...edit, voiceId: null } } }
    const tpl = { title: '', data: { version: 1 as const, greeting: '', chapters: [{ id: 'c', title: '', cards: [card] }] } }
    loadAssets(ns, p, tpl, new OfflineAudioContext(1, 1, 44100)).then((a) => {
      if (!live) return disposeAssets(a)
      loaded = a
      setAssets(a)
    })
    return () => { live = false; disposeAssets(loaded) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns, card.id, media?.id, faceKey])

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      const { edit: e, media: m, assets: a, selected: sel } = latest.current
      const ctx = ref.current?.getContext('2d')
      if (ctx && a) {
        const stickers = e.stickers.map((s) => (drag.current?.id === s.id ? { ...s, x: drag.current.x, y: drag.current.y } : s))
        const sc: TScene = { kind: 'card', dur: sceneDuration({ ...e, voiceId: null }, m, a), card, edit: { ...e, stickers }, media: m }
        drawScene(ctx, sc, ((performance.now() - t0) / 1000) % sc.dur, a)
        const s = stickers.find((x) => x.id === sel)
        if (s) {
          ctx.strokeStyle = '#ff8a3d'
          ctx.lineWidth = 6
          ctx.setLineDash([16, 10])
          const r = (s.size * H) / 2 + 12
          ctx.strokeRect(s.x * W - r, s.y * H - r, r * 2, r * 2)
          ctx.setLineDash([])
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card])

  const toXY = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  const down = (e: React.PointerEvent) => {
    const p = toXY(e)
    const hit = [...edit.stickers].reverse().find((s) => {
      const dx = (p.x - s.x) * W
      const dy = (p.y - s.y) * H
      return Math.hypot(dx, dy) < (s.size * H) / 2 + 20
    })
    onSelect?.(hit?.id ?? null)
    if (!hit) return
    const off = { x: p.x - hit.x, y: p.y - hit.y }
    drag.current = { id: hit.id, x: hit.x, y: hit.y }
    const move = (ev: PointerEvent) => {
      const q = toXY(ev)
      drag.current = { id: hit.id, x: Math.min(1, Math.max(0, q.x - off.x)), y: Math.min(1, Math.max(0, q.y - off.y)) }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const d = drag.current
      drag.current = null
      if (d) onMove?.(d.id, d.x, d.y)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return <canvas ref={ref} width={W} height={H} className="scene-canvas" onPointerDown={down} />
}
