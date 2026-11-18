import { Assets, TScene, buildTimeline, loadAssets } from '../../lib/render'
import { StudentCtx } from './ctx'

/** 여는 영상(교사 자료) + 태블릿 안 작업으로 장면 목록 만들기. 부를 때마다 새 영상 요소를 만든다 */
export async function prepare(c: StudentCtx, ac: BaseAudioContext): Promise<{ assets: Assets; tl: TScene[] }> {
  let opening: Blob | null = null
  const op = c.template.data.opening
  if (op) {
    try {
      const url = await c.assetUrl(op.path)
      if (url) {
        const r = await fetch(url)
        if (r.ok) opening = await r.blob()
      }
    } catch { /* 여는 영상 없이 진행 */ }
  }
  const assets = await loadAssets(c.ns, c.project, c.template, ac, opening)
  const tl = buildTimeline({ template: c.template, project: c.project, assets, studentName: c.me.name, roomName: c.room.name })
  return { assets, tl }
}
