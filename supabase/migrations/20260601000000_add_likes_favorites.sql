-- 点赞表
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, profile_id)
);

create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists likes_profile_idx on public.likes (profile_id);

-- 收藏表
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, profile_id)
);

create index if not exists favorites_post_idx on public.favorites (post_id);
create index if not exists favorites_profile_idx on public.favorites (profile_id);

-- RLS
alter table public.likes enable row level security;
alter table public.favorites enable row level security;

-- 所有人可查看
create policy "likes_select_anon" on public.likes for select to anon, authenticated using (true);
create policy "favorites_select_anon" on public.favorites for select to anon, authenticated using (true);

-- 登录用户可点赞/收藏
create policy "likes_insert_own" on public.likes for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid()));
create policy "favorites_insert_own" on public.favorites for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid()));

-- 登录用户可取消
create policy "likes_delete_own" on public.likes for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid()));
create policy "favorites_delete_own" on public.favorites for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid()));

-- 开发阶段 anon 也可操作
create policy "likes_insert_anon_dev" on public.likes for insert to anon with check (true);
create policy "likes_delete_anon_dev" on public.likes for delete to anon using (true);
create policy "favorites_insert_anon_dev" on public.favorites for insert to anon with check (true);
create policy "favorites_delete_anon_dev" on public.favorites for delete to anon using (true);

grant select, insert, delete on public.likes to anon, authenticated;
grant select, insert, delete on public.favorites to anon, authenticated;
