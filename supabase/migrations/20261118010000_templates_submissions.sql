-- 찰칵 그림책 Phase 3~7: 템플릿 저장, 제출 목록, Storage 버킷(비공개), 매일 자동 삭제
-- Storage 업로드·서명 주소·삭제는 Edge Function `click-book`(service role)에서만 한다.

-- 방마다 템플릿 하나
create unique index if not exists templates_room_uniq on public.templates(room_id);

create or replace function public.get_teacher_template(p_room uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t templates;
begin
  perform _check_teacher(p_room, p_key);
  select * into t from templates where room_id = p_room;
  if not found then return null; end if;
  return jsonb_build_object('id', t.id, 'title', t.title, 'data', t.data, 'updated_at', t.updated_at);
end $$;

create or replace function public.save_template(p_room uuid, p_key text, p_title text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t templates;
begin
  perform _check_teacher(p_room, p_key);
  insert into templates(room_id, title, data, updated_at)
  values (p_room, coalesce(p_title, ''), coalesce(p_data, '{}'::jsonb), now())
  on conflict (room_id) do update set title = excluded.title, data = excluded.data, updated_at = now()
  returning * into t;
  return jsonb_build_object('id', t.id, 'title', t.title, 'updated_at', t.updated_at);
end $$;

create or replace function public.list_submissions(p_room uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _check_teacher(p_room, p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'student_id', student_id, 'status', status, 'size_bytes', size_bytes,
    'duration_sec', duration_sec, 'created_at', created_at, 'expires_at', expires_at, 'file_path', file_path
  ) order by created_at desc), '[]'::jsonb) from submissions where room_id = p_room);
end $$;

grant execute on function public.get_teacher_template(uuid, text), public.save_template(uuid, text, text, jsonb),
  public.list_submissions(uuid, text) to anon, authenticated;

-- 비공개 버킷 (파일 하나 최대 50MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 52428800, array['video/mp4', 'video/webm']),
       ('room-assets', 'room-assets', false, 52428800, null)
on conflict (id) do nothing;

-- 매일 한 번(한국 시각 새벽 3시) 보관 기간 지난 제출 영상 지우기
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'click-book-cleanup',
  '0 18 * * *',
  $cron$ select net.http_post(
    url := 'https://jwmemlnyvveysshmazln.supabase.co/functions/v1/click-book',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "cleanup"}'::jsonb
  ) $cron$
);
