-- Yabu：多图帖子 + 粉丝（最小表结构 + 开发策略）
-- 在 https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new 粘贴并运行
--
-- 说明：
-- - 当前项目仍是“只输入名字”演示模式，因此这里默认提供 anon 可写策略，便于前端快速迭代。
-- - 若你切到 Supabase Auth，请删掉/禁用 anon_*_dev 策略，并启用 authenticated 的 own 策略（见下方注释块）。

-- ========== posts ==========
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists posts_profile_id_created_at_idx
  on public.posts (profile_id, created_at desc);

-- ========== post_images ==========
create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists post_images_post_id_created_at_idx
  on public.post_images (post_id, created_at asc);

create index if not exists post_images_post_id_sort_order_idx
  on public.post_images (post_id, sort_order asc, created_at asc);

-- ========== follows ==========
create table if not exists public.follows (
  follower_id text not null references public.profiles (id) on delete cascade,
  followee_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self_follow check (follower_id <> followee_id)
);

create index if not exists follows_followee_id_idx on public.follows (followee_id);
create index if not exists follows_follower_id_idx on public.follows (follower_id);

-- 粉丝数视图：按 followee 聚合
create or replace view public.profile_follower_counts
with (security_invoker = true) as
select followee_id as profile_id, count(*)::int as follower_count
from public.follows
group by followee_id;

-- ========== RLS ==========
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.follows enable row level security;

-- 读取：开放
drop policy if exists "posts_select_anon" on public.posts;
create policy "posts_select_anon"
  on public.posts for select
  to anon, authenticated
  using (true);

drop policy if exists "post_images_select_anon" on public.post_images;
create policy "post_images_select_anon"
  on public.post_images for select
  to anon, authenticated
  using (true);

drop policy if exists "follows_select_anon" on public.follows;
create policy "follows_select_anon"
  on public.follows for select
  to anon, authenticated
  using (true);

-- 开发写入（anon 可写，演示用）
drop policy if exists "posts_insert_anon_dev" on public.posts;
create policy "posts_insert_anon_dev"
  on public.posts for insert
  to anon
  with check (true);

drop policy if exists "post_images_insert_anon_dev" on public.post_images;
create policy "post_images_insert_anon_dev"
  on public.post_images for insert
  to anon
  with check (true);

drop policy if exists "post_images_delete_anon_dev" on public.post_images;
create policy "post_images_delete_anon_dev"
  on public.post_images for delete
  to anon
  using (true);

drop policy if exists "follows_insert_anon_dev" on public.follows;
create policy "follows_insert_anon_dev"
  on public.follows for insert
  to anon
  with check (true);

drop policy if exists "follows_delete_anon_dev" on public.follows;
create policy "follows_delete_anon_dev"
  on public.follows for delete
  to anon
  using (true);

-- 权限（Data API）
grant usage on schema public to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant select on public.post_images to anon, authenticated;
grant select on public.follows to anon, authenticated;
grant select on public.profile_follower_counts to anon, authenticated;
grant insert on public.posts to anon, authenticated;
grant insert on public.post_images to anon, authenticated;
grant delete on public.post_images to anon, authenticated;
grant insert on public.follows to anon, authenticated;
grant delete on public.follows to anon, authenticated;

-- ========== 正式版（Supabase Auth）策略模板 ==========
-- 先确保 profiles.auth_user_id 绑定到 auth.users(id)，并移除上面的 anon_*_dev 策略，然后启用下面策略：
--
-- drop policy if exists "posts_insert_own" on public.posts;
-- create policy "posts_insert_own"
--   on public.posts for insert
--   to authenticated
--   with check (
--     exists (
--       select 1 from public.profiles p
--       where p.id = profile_id and p.auth_user_id = auth.uid()
--     )
--   );
--
-- drop policy if exists "post_images_insert_own" on public.post_images;
-- create policy "post_images_insert_own"
--   on public.post_images for insert
--   to authenticated
--   with check (
--     exists (
--       select 1
--       from public.posts po
--       join public.profiles p on p.id = po.profile_id
--       where po.id = post_id and p.auth_user_id = auth.uid()
--     )
--   );
--
-- drop policy if exists "post_images_delete_own" on public.post_images;
-- create policy "post_images_delete_own"
--   on public.post_images for delete
--   to authenticated
--   using (
--     exists (
--       select 1
--       from public.posts po
--       join public.profiles p on p.id = po.profile_id
--       where po.id = post_id and p.auth_user_id = auth.uid()
--     )
--   );
--
-- drop policy if exists "follows_insert_own" on public.follows;
-- create policy "follows_insert_own"
--   on public.follows for insert
--   to authenticated
--   with check (
--     exists (
--       select 1 from public.profiles p
--       where p.id = follower_id and p.auth_user_id = auth.uid()
--     )
--   );
--
-- drop policy if exists "follows_delete_own" on public.follows;
-- create policy "follows_delete_own"
--   on public.follows for delete
--   to authenticated
--   using (
--     exists (
--       select 1 from public.profiles p
--       where p.id = follower_id and p.auth_user_id = auth.uid()
--     )
--   );

