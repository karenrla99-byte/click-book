import { useRef, useState } from 'react'
import { useBlobUrl } from '../lib/blobUrl'
import { putBlob } from '../lib/store'

type Props = { ns: string; photoId: string; onDone: (blobId: string) => void; onClose: () => void }

/** 얼굴 쏙: 동그라미를 끌어 맞추고 잘라서 스티커로 (자동 얼굴 인식 없음) */
export default function FaceCrop({ ns, photoId, onDone, onClose }: Props) {
  const url = useBlobUrl(ns, photoId)
  const imgRef = useRef<HTMLImageElement>(null)
  const [c, setC] = useState({ x: 0.5, y: 0.4, r: 0.18 }) // r: 사진 너비 대비 반지름
  const [busy, setBusy] = useState(false)

  const down = (e: React.PointerEvent) => {
    const box = imgRef.current!.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    const start = c
    const move = (ev: PointerEvent) => {
      setC({
        ...start,
        x: Math.min(1, Math.max(0, start.x + (ev.clientX - sx) / box.width)),
        y: Math.min(1, Math.max(0, start.y + (ev.clientY - sy) / box.height)),
      })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const cut = async () => {
    const img = imgRef.current
    if (!img) return
    setBusy(true)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const r = c.r * w
    const out = document.createElement('canvas')
    out.width = out.height = 400
    const g = out.getContext('2d')!
    g.beginPath()
    g.arc(200, 200, 200, 0, Math.PI * 2)
    g.clip()
    g.drawImage(img, c.x * w - r, c.y * h - r, r * 2, r * 2, 0, 0, 400, 400)
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'))
    if (blob) onDone(await putBlob(ns, blob))
    setBusy(false)
  }

  return (
    <div className="modal">
      <div className="modal-body face-crop">
        <h2>😀 얼굴 쏙 — 동그라미를 얼굴에 맞춰요</h2>
        <div className="face-stage">
          {url && <img ref={imgRef} src={url} alt="" draggable={false} />}
          <div
            className="face-ring"
            onPointerDown={down}
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.r * 200}%`, aspectRatio: '1' }}
          />
        </div>
        <div className="row center">
          <button className="btn icon" onClick={() => setC({ ...c, r: Math.max(0.05, c.r - 0.03) })} aria-label="작게">➖</button>
          <button className="btn icon" onClick={() => setC({ ...c, r: Math.min(0.5, c.r + 0.03) })} aria-label="크게">➕</button>
          <button className="btn" onClick={onClose}>그만두기</button>
          <button className="btn big primary" onClick={cut} disabled={busy || !url}>✂️ 잘라서 붙여요</button>
        </div>
      </div>
    </div>
  )
}
