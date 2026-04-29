-- 1차 Supabase 전환용 스키마
-- 개발 편의를 위해 RLS는 비활성화 상태로 시작합니다.
-- 운영 단계에서는 RLS를 활성화하고 내부관리자/발주처 역할별 정책을 강화하세요.

create table if not exists public.tasks (
  id text primary key,
  "group" text,
  group_order integer,
  category text not null default '',
  title text not null default '',
  owner text not null default '',
  start_date date,
  due_date date,
  status text not null default '미착수'
    check (status in ('미착수', '진행중', '완료', '보고서 반영', '발주처 확인')),
  deliverable text not null default '',
  evidence text not null default '',
  note text not null default '',
  is_visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_deliverables (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  title text not null default '',
  file_name text not null default '',
  original_file_name text not null default '',
  stored_file_name text not null default '',
  file_size bigint not null default 0,
  file_type text not null default '',
  file_url text not null default '',
  file_path text not null default '',
  -- localStorage fallback 데이터와 호환용입니다. Supabase 운영에서는 Storage file_path/file_url 사용을 권장합니다.
  file_data text,
  version text not null default 'v0.1',
  planned_submit_date date,
  actual_submit_date date,
  status text not null default '작성중'
    check (status in ('작성중', '내부검토', '발주처검토', '수정중', '최종완료')),
  uploaded_by text not null default '',
  uploaded_at timestamptz,
  note text not null default '',
  is_visible_to_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id text primary key,
  target_type text not null default 'project'
    check (target_type in ('project', 'task', 'deliverable')),
  target_id text not null default 'project',
  target_title text not null default '',
  author_name text not null default '',
  author_role text not null default 'client'
    check (author_role in ('client', 'admin', 'researcher')),
  content text not null default '',
  status text not null default '접수'
    check (status in ('접수', '검토중', '반영중', '반영완료', '보류')),
  response text not null default '',
  responded_by text not null default '',
  responded_at timestamptz,
  reflected_location text not null default '',
  hold_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id text primary key,
  target_type text not null check (target_type in ('task_deliverable', 'comment')),
  target_id text not null,
  approved_by text not null default '',
  approved_at timestamptz,
  status text not null default '미승인' check (status in ('미승인', '요청', '승인', '반려')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_task_deliverables_task_id on public.task_deliverables(task_id);
create index if not exists idx_task_deliverables_visible on public.task_deliverables(is_visible_to_client);
create index if not exists idx_comments_status on public.comments(status);

-- 기존 1차 스키마를 이미 적용한 프로젝트용 보강 컬럼입니다.
alter table public.task_deliverables add column if not exists original_file_name text not null default '';
alter table public.task_deliverables add column if not exists stored_file_name text not null default '';
alter table public.tasks add column if not exists "group" text;
alter table public.tasks add column if not exists group_order integer;
alter table public.tasks add column if not exists is_visible_to_client boolean not null default true;
alter table public.comments add column if not exists target_type text not null default 'project';
alter table public.comments add column if not exists target_id text not null default 'project';
alter table public.comments add column if not exists target_title text not null default '';
alter table public.comments add column if not exists author_name text not null default '';
alter table public.comments add column if not exists author_role text not null default 'client';
alter table public.comments add column if not exists response text not null default '';
alter table public.comments add column if not exists responded_by text not null default '';
alter table public.comments add column if not exists responded_at timestamptz;
alter table public.comments add column if not exists reflected_location text not null default '';
alter table public.comments add column if not exists hold_reason text not null default '';
alter table public.comments add column if not exists updated_at timestamptz not null default now();

-- 상태값 확장 적용이 필요한 기존 프로젝트에서는 기존 check constraint를 재생성하세요.
-- alter table public.comments drop constraint if exists comments_status_check;
-- alter table public.comments add constraint comments_status_check check (status in ('접수', '검토중', '반영중', '반영완료', '보류'));
-- alter table public.approvals drop constraint if exists approvals_status_check;
-- alter table public.approvals add constraint approvals_status_check check (status in ('미승인', '요청', '승인', '반려'));

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('project-deliverables', 'project-deliverables', true)
on conflict (id) do update set public = excluded.public;

-- 개발용 permissive policy 예시입니다. 운영 전에는 반드시 역할별 RLS 정책으로 교체하세요.
alter table public.tasks enable row level security;
alter table public.task_deliverables enable row level security;
alter table public.comments enable row level security;
alter table public.approvals enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() ->> 'user_role', '');
$$;

drop policy if exists "admin tasks all" on public.tasks;
drop policy if exists "client tasks read visible" on public.tasks;
drop policy if exists "admin task deliverables all" on public.task_deliverables;
drop policy if exists "client task deliverables read visible" on public.task_deliverables;
drop policy if exists "admin comments all" on public.comments;
drop policy if exists "client comments select" on public.comments;
drop policy if exists "client comments insert" on public.comments;
drop policy if exists "client comments update own" on public.comments;
drop policy if exists "client comments delete own" on public.comments;
drop policy if exists "admin approvals all" on public.approvals;
drop policy if exists "client approvals select" on public.approvals;
drop policy if exists "client approvals insert" on public.approvals;
drop policy if exists "client approvals update own" on public.approvals;

create policy "admin tasks all" on public.tasks for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "client tasks read visible" on public.tasks for select
using ((public.current_app_role() = 'client' or auth.role() = 'anon') and coalesce(is_visible_to_client, true) = true);

create policy "admin task deliverables all" on public.task_deliverables for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "client task deliverables read visible" on public.task_deliverables for select
using ((public.current_app_role() = 'client' or auth.role() = 'anon') and is_visible_to_client = true);

create policy "admin comments all" on public.comments for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "client comments select" on public.comments for select
using ((public.current_app_role() = 'client' or auth.role() = 'anon') and author_role = 'client');

create policy "client comments insert" on public.comments for insert
with check ((public.current_app_role() = 'client' or auth.role() = 'anon') and author_role = 'client');

create policy "client comments update own" on public.comments for update
using ((public.current_app_role() = 'client' or auth.role() = 'anon') and author_role = 'client')
with check ((public.current_app_role() = 'client' or auth.role() = 'anon') and author_role = 'client');

create policy "client comments delete own" on public.comments for delete
using ((public.current_app_role() = 'client' or auth.role() = 'anon') and author_role = 'client');

create policy "admin approvals all" on public.approvals for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "client approvals select" on public.approvals for select
using (public.current_app_role() = 'client' or auth.role() = 'anon');

create policy "client approvals insert" on public.approvals for insert
with check (public.current_app_role() = 'client' or auth.role() = 'anon');

create policy "client approvals update own" on public.approvals for update
using (public.current_app_role() = 'client' or auth.role() = 'anon')
with check (public.current_app_role() = 'client' or auth.role() = 'anon');

-- Storage는 storage.objects RLS 정책이 없으면 anon 클라이언트 업로드가 차단됩니다.
-- 개발용 permissive policy입니다. 운영 전에는 인증 역할/프로젝트 멤버십 기준으로 강화하세요.
drop policy if exists "dev project deliverables select" on storage.objects;
drop policy if exists "dev project deliverables insert" on storage.objects;
drop policy if exists "dev project deliverables update" on storage.objects;
drop policy if exists "dev project deliverables delete" on storage.objects;
drop policy if exists "admin project deliverables all" on storage.objects;
drop policy if exists "client project deliverables select" on storage.objects;

create policy "admin project deliverables all"
on storage.objects for all
using (bucket_id = 'project-deliverables' and public.current_app_role() = 'admin')
with check (bucket_id = 'project-deliverables' and public.current_app_role() = 'admin');

create policy "client project deliverables select"
on storage.objects for select
using (bucket_id = 'project-deliverables' and (public.current_app_role() = 'client' or auth.role() = 'anon'));
