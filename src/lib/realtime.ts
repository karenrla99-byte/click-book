import { supabase } from './supabase'
import { roomChannel } from './api'

/** 방 채널로 '바뀌었어요' 신호만 보냄 (내용은 각자 RPC로 다시 읽음) */
export function ping(roomId: string, event: 'submission' | 'template', payload: Record<string, unknown> = {}) {
  if (!supabase) return
  const sb = supabase
  const ch = sb.channel(roomChannel(roomId))
  const done = () => { sb.removeChannel(ch) }
  const timer = setTimeout(done, 5000)
  ch.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    ch.send({ type: 'broadcast', event, payload }).finally(() => { clearTimeout(timer); done() })
  })
}

export function listen(roomId: string, event: 'submission' | 'template', cb: (payload: Record<string, unknown>) => void) {
  if (!supabase) return () => {}
  const sb = supabase
  const ch = sb.channel(roomChannel(roomId)).on('broadcast', { event }, (m) => cb(m.payload ?? {})).subscribe()
  return () => { sb.removeChannel(ch) }
}
