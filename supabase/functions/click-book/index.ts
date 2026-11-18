// 찰칵 그림책 Edge Function — Storage(비공개 버킷)를 다루는 일은 모두 여기서.
// 대시보드 설정: "Enforce JWT verification" 끄기 (로그인 없는 앱, publishable 키로 호출)
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg) } }

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s ?? ''))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function checkTeacher(room: string, key: string) {
  if (!room || !key) throw new HttpError(403, 'not_teacher')
  const { data } = await sb.from('room_teacher_keys').select('id').eq('room_id', room).eq('key_hash', await sha256(key)).limit(1)
  if (!data?.length) throw new HttpError(403, 'not_teacher')
}

async function roomByCode(code: string) {
  const { data } = await sb.from('rooms').select('id, is_open, retention_days, settings').eq('code', code).maybeSingle()
  if (!data) throw new HttpError(404, 'no_room')
  return data
}

async function studentInRoom(room: string, sid: string) {
  const { data } = await sb.from('students').select('id').eq('id', sid).eq('room_id', room).maybeSingle()
  if (!data) throw new HttpError(403, 'not_in_room')
}

async function removeSubmissions(rows: { id: string; file_path: string }[]) {
  if (!rows.length) return
  await sb.storage.from('submissions').remove(rows.map((r) => r.file_path))
  await sb.from('submissions').delete().in('id', rows.map((r) => r.id))
}

async function cleanupExpired() {
  const { data } = await sb.from('submissions').select('id, file_path').lt('expires_at', new Date().toISOString()).limit(200)
  await removeSubmissions(data ?? [])
  // 30분 넘게 '보내는 중'에 멈춘 것도 정리
  const { data: stale } = await sb.from('submissions').select('id, file_path').eq('status', 'uploading')
    .lt('created_at', new Date(Date.now() - 30 * 60_000).toISOString()).limit(200)
  await removeSubmissions(stale ?? [])
  return (data?.length ?? 0) + (stale?.length ?? 0)
}

async function removePrefix(bucket: string, prefix: string) {
  // room_id/… 아래 파일 모두 (2단계까지)
  const { data: top } = await sb.storage.from(bucket).list(prefix, { limit: 1000 })
  const files: string[] = []
  for (const item of top ?? []) {
    if (item.id) files.push(`${prefix}/${item.name}`)
    else {
      const { data: sub } = await sb.storage.from(bucket).list(`${prefix}/${item.name}`, { limit: 1000 })
      for (const f of sub ?? []) files.push(`${prefix}/${item.name}/${f.name}`)
    }
  }
  for (let i = 0; i < files.length; i += 100) await sb.storage.from(bucket).remove(files.slice(i, i + 100))
}

const safeExt = (e: string) => (/^[a-z0-9]{1,5}$/.test(e ?? '') ? e : 'bin')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    switch (b.action) {
      // ── 교사: 여는 영상·카드 녹음 올리기
      case 'asset-upload': {
        await checkTeacher(b.room, b.key)
        const path = `${b.room}/${crypto.randomUUID()}.${safeExt(b.ext)}`
        const { data, error } = await sb.storage.from('room-assets').createSignedUploadUrl(path)
        if (error) throw error
        return json({ path, token: data.token })
      }
      // ── 방 자료 재생 주소 (교사: room+key / 학생: code)
      case 'asset-urls': {
        let room: string
        if (b.code) {
          const r = await roomByCode(b.code)
          if (!r.is_open) throw new HttpError(403, 'closed')
          room = r.id
        } else {
          await checkTeacher(b.room, b.key)
          room = b.room
        }
        const paths = ((b.paths ?? []) as string[]).filter((p) => typeof p === 'string' && p.startsWith(room + '/'))
        if (!paths.length) return json({ urls: {} })
        const { data, error } = await sb.storage.from('room-assets').createSignedUrls(paths, 60 * 60 * 3)
        if (error) throw error
        const urls: Record<string, string> = {}
        for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
        return json({ urls })
      }
      // ── 학생: 제출 시작 → 서명된 업로드 주소
      case 'create-upload': {
        const r = await roomByCode(b.code)
        if (!r.is_open) throw new HttpError(403, 'closed')
        await studentInRoom(r.id, b.student_id)
        if (!(r.settings as Record<string, unknown>)?.multiSubmit) {
          const { data: old } = await sb.from('submissions').select('id, file_path').eq('student_id', b.student_id)
          await removeSubmissions(old ?? [])
        }
        const id = crypto.randomUUID()
        const ext = b.ext === 'webm' ? 'webm' : 'mp4'
        const path = `${r.id}/${b.student_id}/${id}.${ext}`
        const expires = r.retention_days ? new Date(Date.now() + r.retention_days * 86400_000).toISOString() : null
        const { error: e1 } = await sb.from('submissions').insert({
          id, room_id: r.id, student_id: b.student_id, file_path: path, status: 'uploading',
          size_bytes: b.size ?? null, duration_sec: b.duration ?? null, expires_at: expires,
        })
        if (e1) throw e1
        const { data, error } = await sb.storage.from('submissions').createSignedUploadUrl(path)
        if (error) throw error
        cleanupExpired().catch(() => {})
        return json({ id, path, token: data.token, room_id: r.id })
      }
      // ── 학생: 업로드 끝
      case 'finish': {
        const r = await roomByCode(b.code)
        const { data: row } = await sb.from('submissions').select('id, file_path, student_id, room_id').eq('id', b.id).maybeSingle()
        if (!row || row.room_id !== r.id || row.student_id !== b.student_id) throw new HttpError(403, 'not_yours')
        const dir = row.file_path.split('/').slice(0, 2).join('/')
        const { data: files } = await sb.storage.from('submissions').list(dir, { search: row.file_path.split('/')[2] })
        if (!files?.length) throw new HttpError(400, 'upload_missing')
        await sb.from('submissions').update({ status: 'done', size_bytes: files[0].metadata?.size ?? b.size ?? null }).eq('id', row.id)
        return json({ ok: true })
      }
      // ── 교사: 제출 영상 재생/내려받기 주소 (10분)
      case 'sign': {
        await checkTeacher(b.room, b.key)
        const { data: rows } = await sb.from('submissions').select('id, file_path').eq('room_id', b.room).in('id', b.ids ?? [])
        const urls: Record<string, string> = {}
        for (const row of rows ?? []) {
          const { data } = await sb.storage.from('submissions').createSignedUrl(row.file_path, 600, b.download ? { download: true } : undefined)
          if (data?.signedUrl) urls[row.id] = data.signedUrl
        }
        return json({ urls })
      }
      case 'delete-submissions': {
        await checkTeacher(b.room, b.key)
        const { data: rows } = await sb.from('submissions').select('id, file_path').eq('room_id', b.room).in('id', b.ids ?? [])
        await removeSubmissions(rows ?? [])
        return json({ ok: true, count: rows?.length ?? 0 })
      }
      case 'delete-asset': {
        await checkTeacher(b.room, b.key)
        if (typeof b.path === 'string' && b.path.startsWith(b.room + '/')) await sb.storage.from('room-assets').remove([b.path])
        return json({ ok: true })
      }
      // ── 교사: 방 지우기 (PIN 확인 → 행 삭제 → 파일 삭제)
      case 'delete-room': {
        await checkTeacher(b.room, b.key)
        const { data, error } = await sb.rpc('delete_room', { p_room: b.room, p_key: b.key, p_pin: b.pin })
        if (error) throw error
        if (!data?.ok) return json(data)
        await removePrefix('submissions', b.room)
        await removePrefix('room-assets', b.room)
        return json({ ok: true })
      }
      case 'cleanup':
        return json({ ok: true, removed: await cleanupExpired() })
      default:
        throw new HttpError(400, 'unknown_action')
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    return json({ error: e instanceof Error ? e.message : String(e) }, status)
  }
})
