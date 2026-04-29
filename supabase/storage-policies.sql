-- Production Storage RLS policies for project-deliverables.
-- Apply after Supabase Auth is issuing JWTs with app_metadata.role or user_role.

insert into storage.buckets (id, name, public)
values ('project-deliverables', 'project-deliverables', true)
on conflict (id) do update set public = excluded.public;

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
