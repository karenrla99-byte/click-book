export type Level = '상' | '중' | '하'
export const LEVELS: Level[] = ['상', '중', '하']

export type Student = {
  id?: string
  name: string
  level: Level
  sort_order?: number
  image_path?: string | null
}

export type RoomSummary = {
  id: string
  code: string
  name: string
  is_open: boolean
  created_at: string
  student_count: number
}

export type TeacherRoom = {
  id: string
  code: string
  name: string
  is_open: boolean
  retention_days: number | null
  settings: Record<string, unknown>
  created_at: string
  students: Student[]
}

export type PublicRoom =
  | { ok: false; error: string; name?: string }
  | {
      ok: true
      room: { id: string; code: string; name: string }
      students: Student[]
      template: { id: string; title: string; data: unknown; updated_at: string } | null
    }
