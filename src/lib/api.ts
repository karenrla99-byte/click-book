import { supabase } from './supabase'

/** 응답이 없으면 기다리지 않고 실패로 (화면이 멈춘 채로 있지 않게) */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${label}: 응답이 없어요 (${Math.round(ms / 1000)}초)`)), ms)
    p.then((v) => { clearTimeout(t); res(v) }, (e) => { clearTimeout(t); rej(e) })
  })
}

/** Edge Function `click-book` 호출 */
export async function fn<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase 설정이 아직 없어요')
  const { data, error } = await withTimeout(supabase.functions.invoke('click-book', { body: { action, ...body } }), 30_000, `서버(${action})`)
  if (error) {
    let msg = error.message
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any).context as Response | undefined
      if (ctx?.json) { const j = await ctx.json(); if (j?.error) msg = j.error }
    } catch { /* 무시 */ }
    throw new Error(`서버(${action}): ${msg}`)
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error))
  return data as T
}

export async function uploadSigned(bucket: string, path: string, token: string, blob: Blob, contentType: string) {
  if (!supabase) throw new Error('Supabase 설정이 아직 없어요')
  const { error } = await withTimeout(supabase.storage.from(bucket).uploadToSignedUrl(path, token, blob, { contentType }), 10 * 60_000, '올리기')
  if (error) throw new Error(`올리기: ${error.message}`)
}

/** 교사: 방 자료 올리기 → 경로 */
export async function uploadAsset(room: string, key: string, blob: Blob, ext: string): Promise<string> {
  const r = await fn<{ path: string; token: string }>('asset-upload', { room, key, ext })
  await uploadSigned('room-assets', r.path, r.token, blob, blob.type || 'application/octet-stream')
  return r.path
}

export type AssetAuth = { code: string } | { room: string; key: string }
export async function assetUrls(auth: AssetAuth, paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p))]
  if (!list.length) return {}
  const r = await fn<{ urls: Record<string, string> }>('asset-urls', { ...auth, paths: list })
  return r.urls
}

export const roomChannel = (roomId: string) => `click-book-room-${roomId}`
