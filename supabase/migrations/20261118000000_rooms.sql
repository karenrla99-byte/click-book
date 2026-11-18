-- 찰칵 그림책 Phase 2: 방·명단·템플릿·제출 테이블 + RPC
-- 원칙: 테이블은 RLS로 모두 막고, 읽기/쓰기는 security definer RPC로만.
-- 교사 권한 = 방 만들 때 발급한 teacher_key (DB에는 sha256 해시만).
--   한 교사가 PC·전자칠판 등 여러 기기를 쓰므로 키 해시는 room_teacher_keys에 여러 개 저장.
--   4자리 PIN으로 되찾으면 그 기기용 새 키를 하나 더 발급 (기존 기기 키는 그대로).
-- PIN은 bcrypt, 5번 틀리면 15분 잠금(학생이 방 코드를 알고 PIN을 맞춰 보는 것 방지).

create extension if not exists pgcrypto with schema extensions;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  name text not null check (char_length(name) between 1 and 60),
  pin_hash text not null,
  is_open boolean not null default true,
  retention_days int default 30 check (retention_days is null or retention_days between 1 and 365), -- null = 직접 지울 때까지
  settings jsonb not null default '{}'::jsonb,
  pin_fail_count int not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.room_teacher_keys (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create unique index on public.room_teacher_keys(room_id, key_hash);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  sort_order int not null default 0,
  level text not null default '중' check (level in ('상','중','하')),
  image_path text
);
create index on public.students(room_id, sort_order);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null default '',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index on public.templates(room_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  file_path text not null,
  duration_sec numeric,
  size_bytes bigint,
  status text not null default 'uploading' check (status in ('uploading','done')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index on public.submissions(room_id);
create index on public.submissions(expires_at);

alter table public.rooms enable row level security;
alter table public.room_teacher_keys enable row level security;
alter table public.students enable row level security;
alter table public.templates enable row level security;
alter table public.submissions enable row level security;
revoke all on public.rooms, public.room_teacher_keys, public.students, public.templates, public.submissions from anon, authenticated;

-- ───────── 내부 도우미 ─────────
create or replace function public._key_hash(p_key text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
$$;

create or replace function public._check_teacher(p_room uuid, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from room_teacher_keys where room_id = p_room and key_hash = _key_hash(p_key)) then
    raise exception 'not_teacher' using errcode = '42501';
  end if;
end $$;

create or replace function public._new_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from rooms where code = c);
  end loop;
  return c;
end $$;

create or replace function public._new_key(p_room uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare k text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into room_teacher_keys(room_id, key_hash) values (p_room, _key_hash(k));
  return k;
end $$;

create or replace function public._students_json(p_room uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'level', level, 'sort_order', sort_order, 'image_path', image_path
  ) order by sort_order, name), '[]'::jsonb)
  from students where room_id = p_room
$$;

-- ───────── 교사 ─────────
create or replace function public.create_room(p_name text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r rooms;
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'bad_pin'; end if;
  insert into rooms(code, name, pin_hash)
  values (_new_code(), trim(p_name), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  returning * into r;
  return jsonb_build_object('room_id', r.id, 'code', r.code, 'name', r.name, 'teacher_key', _new_key(r.id));
end $$;

-- 예외를 던지면 실패 횟수 증가가 롤백되므로, 실패는 json으로 돌려준다
create or replace function public.recover_room(p_code text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r rooms;
begin
  select * into r from rooms where code = p_code for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_room'); end if;
  if r.pin_locked_until is not null and r.pin_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', r.pin_locked_until);
  end if;
  if extensions.crypt(coalesce(p_pin, ''), r.pin_hash) <> r.pin_hash then
    update rooms set
      pin_fail_count = case when pin_fail_count + 1 >= 5 then 0 else pin_fail_count + 1 end,
      pin_locked_until = case when pin_fail_count + 1 >= 5 then now() + interval '15 minutes' else pin_locked_until end
    where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  update rooms set pin_fail_count = 0, pin_locked_until = null where id = r.id;
  return jsonb_build_object('ok', true, 'room_id', r.id, 'code', r.code, 'name', r.name, 'teacher_key', _new_key(r.id));
end $$;

-- p_keys: [{"room_id": "...", "key": "..."}]
create or replace function public.list_my_rooms(p_keys jsonb) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'code', r.code, 'name', r.name, 'is_open', r.is_open, 'created_at', r.created_at,
    'student_count', (select count(*) from students s where s.room_id = r.id)
  ) order by r.created_at desc), '[]'::jsonb)
  from rooms r
  where exists (
    select 1 from jsonb_array_elements(coalesce(p_keys, '[]'::jsonb)) k
    join room_teacher_keys t on t.room_id = (k->>'room_id')::uuid and t.key_hash = _key_hash(k->>'key')
    where t.room_id = r.id
  )
$$;

create or replace function public.get_teacher_room(p_room uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  perform _check_teacher(p_room, p_key);
  select * into r from rooms where id = p_room;
  return jsonb_build_object(
    'id', r.id, 'code', r.code, 'name', r.name, 'is_open', r.is_open,
    'retention_days', r.retention_days, 'settings', r.settings, 'created_at', r.created_at,
    'students', _students_json(r.id)
  );
end $$;

-- p_patch: {name?, is_open?, retention_days?(null 허용), settings?}
create or replace function public.update_room(p_room uuid, p_key text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _check_teacher(p_room, p_key);
  update rooms set
    name = case when p_patch ? 'name' then trim(p_patch->>'name') else name end,
    is_open = case when p_patch ? 'is_open' then (p_patch->>'is_open')::boolean else is_open end,
    retention_days = case when p_patch ? 'retention_days' then (p_patch->>'retention_days')::int else retention_days end,
    settings = case when p_patch ? 'settings' then p_patch->'settings' else settings end
  where id = p_room;
end $$;

-- 명단 통째로 저장. p_students: [{id?, name, level}] 배열 순서 = 번호
-- 목록에서 빠진 학생은 삭제 (그 학생의 제출도 함께 삭제)
create or replace function public.save_students(p_room uuid, p_key text, p_students jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s jsonb;
  i int := 0;
  keep uuid[] := '{}';
  sid uuid;
begin
  perform _check_teacher(p_room, p_key);
  for s in select * from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) loop
    i := i + 1;
    sid := nullif(s->>'id', '')::uuid;
    if sid is not null and exists (select 1 from students where id = sid and room_id = p_room) then
      update students set name = trim(s->>'name'), level = coalesce(s->>'level', '중'), sort_order = i where id = sid;
    else
      insert into students(room_id, name, level, sort_order)
      values (p_room, trim(s->>'name'), coalesce(s->>'level', '중'), i) returning id into sid;
    end if;
    keep := keep || sid;
  end loop;
  delete from students where room_id = p_room and not (id = any(keep));
  return _students_json(p_room);
end $$;

create or replace function public.duplicate_room(p_room uuid, p_key text, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare src rooms; r rooms;
begin
  perform _check_teacher(p_room, p_key);
  select * into src from rooms where id = p_room;
  insert into rooms(code, name, pin_hash, is_open, retention_days, settings)
  values (_new_code(), coalesce(nullif(trim(p_name), ''), src.name || ' (복사)'), src.pin_hash, true, src.retention_days, src.settings)
  returning * into r;
  -- 같은 기기에서 바로 쓸 수 있게 지금 키를 새 방에도 등록
  insert into room_teacher_keys(room_id, key_hash) values (r.id, _key_hash(p_key));
  insert into students(room_id, name, level, sort_order, image_path)
    select r.id, name, level, sort_order, image_path from students where room_id = p_room;
  insert into templates(room_id, title, data)
    select r.id, title, data from templates where room_id = p_room;
  return jsonb_build_object('room_id', r.id, 'code', r.code, 'name', r.name);
end $$;

-- 방 지우기: PIN 확인. (Storage 파일 정리는 Phase 7 Edge Function에서)
create or replace function public.delete_room(p_room uuid, p_key text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r rooms;
begin
  perform _check_teacher(p_room, p_key);
  select * into r from rooms where id = p_room;
  if extensions.crypt(coalesce(p_pin, ''), r.pin_hash) <> r.pin_hash then
    return jsonb_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  delete from rooms where id = p_room;
  return jsonb_build_object('ok', true);
end $$;

-- ───────── 학생 ─────────
create or replace function public.get_room_by_code(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r rooms; t templates;
begin
  select * into r from rooms where code = p_code;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_room'); end if;
  if not r.is_open then return jsonb_build_object('ok', false, 'error', 'closed', 'name', r.name); end if;
  select * into t from templates where room_id = r.id order by updated_at desc limit 1;
  return jsonb_build_object(
    'ok', true,
    'room', jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name),
    'students', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'level', level, 'image_path', image_path) order by sort_order, name), '[]'::jsonb) from students where room_id = r.id),
    'template', case when t.id is null then null else jsonb_build_object('id', t.id, 'title', t.title, 'data', t.data, 'updated_at', t.updated_at) end
  );
end $$;

-- ───────── 실행 권한 ─────────
revoke execute on function public._key_hash(text), public._check_teacher(uuid, text), public._new_code(),
  public._new_key(uuid), public._students_json(uuid) from public, anon, authenticated;
grant execute on function public.create_room(text, text), public.recover_room(text, text),
  public.list_my_rooms(jsonb), public.get_teacher_room(uuid, text), public.update_room(uuid, text, jsonb),
  public.save_students(uuid, text, jsonb), public.duplicate_room(uuid, text, text),
  public.delete_room(uuid, text, text), public.get_room_by_code(text) to anon, authenticated;
