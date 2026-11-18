import { uid } from './uid'

export type MediaKind = 'photo' | 'video' | 'both'

export type Card = {
  id: string
  text: string
  audioPath?: string | null // 교사 녹음 (room-assets)
  media: MediaKind
  place?: string | null
  placeLowOnly?: boolean // 장소 힌트를 '하' 수준에게만
  words: string[]
}
export type Chapter = { id: string; title: string; cards: Card[] }
export type Level = '상' | '중' | '하'
export type StepKey = 'view' | 'shoot' | 'connect' | 'greet' | 'preview' | 'send'
/** 단계 안내 문구: all = 모두, 수준별로 다르게 쓰면 그 수준 것이 먼저 */
export type Guide = { all?: string; 상?: string; 중?: string; 하?: string }
export type TemplateData = {
  version: 1
  opening?: { path: string; kind: 'video' | 'image' } | null
  chapters: Chapter[]
  greeting: string
  guides?: Partial<Record<StepKey, Guide>>
  /** 꾸미기에서 아이가 자막을 직접 쓸 수 있는지 (수준별) */
  freeText?: Record<Level, boolean>
}

export const STEP_INFO: { key: StepKey; label: string }[] = [
  { key: 'view', label: '① 카드 보기' },
  { key: 'shoot', label: '② 찍기' },
  { key: 'connect', label: '③ 꾸미기' },
  { key: 'greet', label: '④ 인사' },
  { key: 'preview', label: '⑤ 미리보기' },
  { key: 'send', label: '⑥ 보내기' },
]

/** 교사가 비워 두면 나오는 기본 안내 */
export const DEFAULT_GUIDES: Record<StepKey, Guide> = {
  view: { all: '카드를 보고 🔊를 눌러 들어요' },
  shoot: { all: '카드에 맞는 사진이나 영상을 찍어요' },
  connect: {
    all: '사진을 끌어서 카드에 놓아요. 사진을 누르고 카드를 눌러도 돼요',
    하: '찍은 사진이 카드에 벌써 들어갔어요. 카드를 누르면 꾸밀 수 있어요',
  },
  greet: { all: '영상이나 목소리로 인사해요' },
  preview: { all: '내 그림책을 처음부터 봐요' },
  send: { all: '다 만들었으면 선생님께 보내요' },
}

export function guideText(d: TemplateData | undefined, step: StepKey, level: Level): string {
  const g = d?.guides?.[step]
  const def = DEFAULT_GUIDES[step]
  return (g?.[level]?.trim() || g?.all?.trim() || def[level] || def.all || '')
}

export const DEFAULT_FREE_TEXT: Record<Level, boolean> = { 상: true, 중: true, 하: true }
export const freeTextOn = (d: TemplateData | undefined, level: Level) => (d?.freeText ?? DEFAULT_FREE_TEXT)[level]
export type Template = { id?: string; title: string; data: TemplateData; updated_at?: string }

export const PLACES = [
  { id: 'entrance', icon: '🚪', label: '현관' },
  { id: 'classroom', icon: '🏫', label: '교실' },
  { id: 'cafeteria', icon: '🍚', label: '급식실' },
  { id: 'elevator', icon: '🛗', label: '엘리베이터' },
  { id: 'hallway', icon: '🚶', label: '복도' },
  { id: 'toilet', icon: '🚻', label: '화장실' },
  { id: 'playground', icon: '⚽', label: '운동장' },
  { id: 'bus', icon: '🚌', label: '스쿨버스' },
  { id: 'nurse', icon: '🏥', label: '보건실' },
  { id: 'library', icon: '📚', label: '도서관' },
  { id: 'gym', icon: '🤸', label: '체육관' },
  { id: 'therapy', icon: '🧩', label: '치료실' },
]
export const placeOf = (id?: string | null) => PLACES.find((p) => p.id === id)

export const MEDIA_LABEL: Record<MediaKind, string> = { photo: '📷 사진', video: '🎥 영상', both: '📷🎥 둘 다' }

const card = (text: string, place: string, words: string[], media: MediaKind = 'both'): Card => ({
  id: uid(), text, media, place, placeLowOnly: true, words, audioPath: null,
})

/** 유초이음 학교생활 (기획서 4장 예시 그대로) */
export function yuchoTemplate(): Template {
  return {
    title: '유치원 동생에게 보내는 학교생활',
    data: {
      version: 1,
      opening: null,
      greeting: '유치원 동생에게 하고 싶은 말',
      chapters: [
        { id: uid(), title: '등교', cards: [
          card('휠체어를 타고 교실까지 어떻게 가나요?', 'elevator', ['휠체어', '엘리베이터', '복도', '선생님', '친구']),
          card('교실에 도착하면 제일 먼저 무엇을 하나요?', 'classroom', ['인사', '가방 정리', '손 씻기', '자리에 앉기']),
        ] },
        { id: uid(), title: '식사', cards: [
          card('숟가락 잘 드는 방법이 있나요?', 'cafeteria', ['숟가락', '손잡이', '천천히', '연습']),
          card('밥 먹을 때 어떤 연습을 해야 하나요?', 'cafeteria', ['꼭꼭 씹기', '골고루', '바른 자세', '물 마시기']),
        ] },
        { id: uid(), title: '하교', cards: [
          card('학교가 끝나면 어디로 가나요?', 'bus', ['스쿨버스', '집', '엄마', '아빠', '방과후']),
          card('몸이 힘들거나 졸리면 어떻게 알려줘야 하나요?', 'classroom', ['손 들기', '선생님', '말하기', '그림 카드', '쉬기']),
        ] },
      ],
    },
  }
}

export function emptyTemplate(): Template {
  return { title: '새 이야기', data: { version: 1, opening: null, greeting: '하고 싶은 말', chapters: [{ id: uid(), title: '1장', cards: [card('', 'classroom', [])] }] } }
}

export const newCard = () => card('', '', [])
export const newChapter = (n: number): Chapter => ({ id: uid(), title: `${n}장`, cards: [newCard()] })

export type FlatCard = Card & { chapterTitle: string; chapterIndex: number; index: number }
export function flatCards(d: TemplateData | undefined | null): FlatCard[] {
  if (!d?.chapters) return []
  let i = 0
  return d.chapters.flatMap((ch, ci) => ch.cards.map((c) => ({ ...c, chapterTitle: ch.title, chapterIndex: ci, index: i++ })))
}

/** 내보내기 파일: 여는 영상·녹음 경로는 뺀다 (다른 방에서는 쓸 수 없음) */
export function exportTemplate(t: Template): string {
  const data: TemplateData = {
    ...t.data,
    opening: null,
    chapters: t.data.chapters.map((ch) => ({ ...ch, cards: ch.cards.map((c) => ({ ...c, audioPath: null })) })),
  }
  return JSON.stringify({ app: 'click-book', title: t.title, data }, null, 2)
}

export function importTemplate(text: string): Template {
  const j = JSON.parse(text)
  if (!j?.data?.chapters) throw new Error('찰칵 그림책 템플릿 파일이 아니에요')
  const data = j.data as TemplateData
  return {
    title: String(j.title ?? '불러온 이야기'),
    data: {
      version: 1,
      opening: null,
      greeting: data.greeting ?? '하고 싶은 말',
      guides: data.guides ?? undefined,
      freeText: data.freeText ?? undefined,
      chapters: data.chapters.map((ch) => ({
        id: uid(), title: String(ch.title ?? ''),
        cards: (ch.cards ?? []).map((c) => ({
          id: uid(), text: String(c.text ?? ''), media: (['photo', 'video', 'both'].includes(c.media) ? c.media : 'both') as MediaKind,
          place: c.place ?? null, placeLowOnly: c.placeLowOnly ?? true, words: Array.isArray(c.words) ? c.words.map(String) : [], audioPath: null,
        })),
      })),
    },
  }
}
