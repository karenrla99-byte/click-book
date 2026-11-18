import { useEffect, useState } from 'react'
import { MediaItem, delBlob, putBlob } from '../../lib/store'
import { StudentCtx } from './ctx'

export const teacherMediaId = (path: string) => 't-' + (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')

/**
 * 선생님 사진을 태블릿(IndexedDB)에 내려받아 내 사진처럼 쓰게 한다.
 * 템플릿에서 빠진 사진은, 카드에 쓰이고 있지 않으면 사진함에서도 뺀다.
 */
export function useTeacherPhotos(c: StudentCtx) {
  const [loading, setLoading] = useState(false)
  const wanted = c.cards.flatMap((card) => (card.photos ?? []).map((path) => ({ path, cardId: card.id })))
  const key = wanted.map((w) => w.path).join('|')

  useEffect(() => {
    let live = true
    const have = new Set(c.project.media.filter((m) => m.teacher).map((m) => m.teacher))
    const missing = wanted.filter((w) => !have.has(w.path))
    const keep = new Set(wanted.map((w) => w.path))
    const used = new Set(Object.values(c.project.scenes).map((s) => s.mediaId))
    const stale = c.project.media.filter((m) => m.teacher && !keep.has(m.teacher) && !used.has(m.id))
    if (stale.length) {
      stale.forEach((m) => delBlob(c.ns, m.id))
      c.update((p) => ({ ...p, media: p.media.filter((m) => !stale.some((x) => x.id === m.id)) }))
    }
    if (!missing.length) return
    setLoading(true)
    ;(async () => {
      for (const w of missing) {
        try {
          const url = await c.assetUrl(w.path)
          if (!url || !live) continue
          const r = await fetch(url)
          if (!r.ok) continue
          const id = teacherMediaId(w.path)
          await putBlob(c.ns, await r.blob(), id)
          const item: MediaItem = { id, kind: 'photo', cardId: w.cardId, createdAt: Date.now(), teacher: w.path }
          c.update((p) => (p.media.some((m) => m.id === id) ? p : { ...p, media: [...p.media, item] }))
        } catch { /* 이 사진만 건너뜀 */ }
      }
      if (live) setLoading(false)
    })()
    return () => { live = false }
    // 템플릿 사진 목록이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, c.ns])

  return loading
}
