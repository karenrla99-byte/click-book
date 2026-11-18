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
export type TemplateData = {
  version: 1
  opening?: { path: string; kind: 'video' | 'image' } | null
  chapters: Chapter[]
  greeting: string
}
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
