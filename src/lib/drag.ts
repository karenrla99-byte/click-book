// 손가락으로 끌어 놓기 (터치·마우스 모두). 조금만 움직이면 그냥 '탭'으로 본다.
export function startDrag(
  e: React.PointerEvent<HTMLElement>,
  onDrop: (target: string) => void,
) {
  const src = e.currentTarget
  const sx = e.clientX
  const sy = e.clientY
  let ghost: HTMLElement | null = null
  let over: HTMLElement | null = null
  const move = (ev: PointerEvent) => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 12) return
    if (!ghost) {
      ghost = src.cloneNode(true) as HTMLElement
      const r = src.getBoundingClientRect()
      Object.assign(ghost.style, {
        position: 'fixed', left: '0', top: '0', width: r.width + 'px', height: r.height + 'px',
        pointerEvents: 'none', zIndex: '100', opacity: '.85', transform: 'scale(1.05)',
      })
      document.body.appendChild(ghost)
      src.dataset.dragging = '1'
    }
    ghost.style.left = ev.clientX - ghost.offsetWidth / 2 + 'px'
    ghost.style.top = ev.clientY - ghost.offsetHeight / 2 + 'px'
    const t = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null
    if (t !== over) { over?.classList.remove('drop-over'); t?.classList.add('drop-over'); over = t }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    over?.classList.remove('drop-over')
    if (ghost) {
      ghost.remove()
      setTimeout(() => { delete src.dataset.dragging }, 50)
      if (over?.dataset.drop) onDrop(over.dataset.drop)
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** 끌기 직후 생기는 click은 무시 */
export const wasDragged = (el: HTMLElement) => el.dataset.dragging === '1'
