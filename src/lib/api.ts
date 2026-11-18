import { supabase } from './supabase'

/** Edge Function `click-book` 호출 */
export async function fn<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase 설정이 아직 없어요')
  const { data, error } = await supabase.functions.invoke('click-book', { body: { action, ...body } })
  if (error) {
    let msg = error.message
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any).context as Response | undefined
      if (ctx?.json) { const j = await ctx.json(); if (j?.error) msg = j.error }
    } catch { /* 무시 */ }
    throw new Error(msg)
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error))
  return data as T
}

export async function uploadSigned(bucket: string, path: string, token: string, blob: Blob, contentType: string) {
  if (!supabase) throw new Error('Supabase 설정이 아직 없어요')
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, blob, { contentType })
  if (error) throw new Error(error.message)
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
