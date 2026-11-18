import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anon
  ? createClient(url, anon, { auth: { persistSession: false } })
  : null

export const supabaseReady = !!supabase

const MESSAGES: Record<string, string> = {
  not_teacher: '선생님 열쇠가 맞지 않아요. PIN으로 방을 되찾아 주세요.',
  bad_pin: 'PIN은 숫자 4자리예요.',
  wrong_pin: 'PIN이 맞지 않아요.',
  locked: 'PIN을 여러 번 틀려서 15분 동안 잠겼어요.',
  no_room: '그런 방이 없어요. 숫자를 다시 확인해 주세요.',
  closed: '방이 닫혀 있어요. 선생님께 말해 주세요.',
}

export function friendly(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err)
  for (const k of Object.keys(MESSAGES)) if (m.includes(k)) return MESSAGES[k]
  if (m.includes('Failed to fetch')) return '인터넷 연결을 확인해 주세요.'
  return m
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase 설정이 아직 없어요 (.env.local)')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
