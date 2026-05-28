-- 帖子表（一组图片）
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists posts_profile_id_idx on public.posts (profile_id);

-- 扩展 photos 表：文字描述、原图、缩略图、尺寸、帖子关联
alter table public.photos
  add column if not exists caption text,
  add column if not exists original_url text,
  add column if not exists thumbnail_url text,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists post_id uuid references public.posts (id) on delete set null;

-- RLS
alter table public.posts enable row level security;

drop policy if exists "posts_select_anon" on public.posts;
create policy "posts_select_anon"
  on public.posts for select
  to anon, authenticated
  using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "posts_insert_admin" on public.posts;
create policy "posts_insert_admin"
  on public.posts for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.auth_user_id = auth.uid()
    )
  );

grant usage on schema public to anon, authenticated;
grant select, insert, delete on public.posts to anon, authenticated;
