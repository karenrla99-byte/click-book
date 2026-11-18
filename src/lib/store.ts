// 학생 작업은 이 태블릿의 IndexedDB에만 저장 (서버에 원본을 올리지 않음)
import { createStore, del, get, set } from 'idb-keyval'
import { uid } from './uid'

const st = createStore('click-book', 'data')

export type Effect = 'none' | 'bounce' | 'walkIn' | 'sparkle' | 'wiggle'
export const EFFECTS: { id: Effect; label: string }[] = [
  { id: 'none', label: '가만히' },
  { id: 'bounce', label: '통통' },
  { id: 'walkIn', label: '걸어 들어오기' },
  { id: 'sparkle', label: '반짝' },
  { id: 'wiggle', label: '흔들흔들' },
]

export type MediaItem = { id: string; kind: 'photo' | 'video'; cardId?: string | null; createdAt: number; duration?: number }
export type Sticker = {
  id: string
  kind: 'emoji' | 'face'
  emoji?: string
  blobId?: string // face
  x: number // 0~1 (가운데 기준)
  y: number
  size: number // 화면 높이 대비
  effect: Effect
}
export type SceneEdit = {
  mediaId?: string | null
  voiceId?: string | null
  voiceDuration?: number
  words: string[]
  text?: string
  stickers: Sticker[]
  kenBurns: boolean
}
export type Greeting = { blobId: string; kind: 'video' | 'audio'; duration?: number }
export type Project = {
  version: 1
  media: MediaItem[]
  scenes: Record<string, SceneEdit>
  greeting?: Greeting | null
  sent?: { at: number; id: string } | null
  updatedAt: number
}

export const emptyProject = (): Project => ({ version: 1, media: [], scenes: {}, greeting: null, sent: null, updatedAt: Date.now() })
export const emptyScene = (): SceneEdit => ({ mediaId: null, voiceId: null, words: [], text: '', stickers: [], kenBurns: true })

export const nsOf = (roomId: string, studentId: string) => `${roomId}:${studentId}`

export async function loadProject(ns: string): Promise<Project> {
  return (await get<Project>(`p:${ns}`, st)) ?? emptyProject()
}
export async function saveProject(ns: string, p: Project) {
  await set(`p:${ns}`, { ...p, updatedAt: Date.now() }, st)
}
export async function putBlob(ns: string, blob: Blob, id = uid()): Promise<string> {
  await set(`b:${ns}:${id}`, blob, st)
  return id
}
export async function getBlob(ns: string, id: string | null | undefined): Promise<Blob | undefined> {
  if (!id) return undefined
  return get<Blob>(`b:${ns}:${id}`, st)
}
export async function delBlob(ns: string, id: string | null | undefined) {
  if (id) await del(`b:${ns}:${id}`, st)
}

/** 아직 못 보낸 완성 영상 (와이파이 끊김 대비) */
export type Pending = { blob: Blob; mime: string; duration: number; createdAt: number }
export const getPending = (ns: string) => get<Pending>(`pending:${ns}`, st)
export const setPending = (ns: string, p: Pending) => set(`pending:${ns}`, p, st)
export const clearPending = (ns: string) => del(`pending:${ns}`, st)

/** 오래 쓸 수 있게 저장 공간을 '지우지 말아 주세요'로 요청 */
export function persistStorage() {
  navigator.storage?.persist?.().catch(() => {})
}
