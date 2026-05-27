-- Yabu 一键建表 + 开发写入策略 + 种子数据
-- 在 https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new 粘贴整文件并 Run

-- ========== migration: initial_schema ==========
create type public.app_role as enum ('member', 'admin');

create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  avatar_url text not null default '',
  role public.app_role not null default 'member',
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_display_name_unique
  on public.profiles (display_name);

-- 名字注册 RPC（演示模式）
create or replace function public.register_profile(p_display_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id text;
  v_row public.profiles%rowtype;
begin
  v_name := trim(regexp_replace(p_display_name, '\s+', ' ', 'g'));
  if char_length(v_name) < 2 then
    raise exception using message = '名字至少需要 2 个字符';
  end if;
  if char_length(v_name) > 24 then
    raise exception using message = '名字不能超过 24 个字符';
  end if;
  if exists (select 1 from public.profiles where display_name = v_name) then
    raise exception using message = '该名字已被注册，请切换到「登录」';
  end if;
  v_id := 'user-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.profiles (id, display_name, avatar_url, role)
  values (v_id, v_name, '', 'member')
  returning * into v_row;
  return json_build_object(
    'id', v_row.id,
    'display_name', v_row.display_name,
    'avatar_url', v_row.avatar_url,
    'role', v_row.role
  );
end;
$$;

revoke all on function public.register_profile(text) from public;
grant execute on function public.register_profile(text) to anon, authenticated;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_profile_id_idx on public.photos (profile_id);

-- ========== posts: 多图帖子 ==========
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists posts_profile_id_created_at_idx
  on public.posts (profile_id, created_at desc);

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

-- ========== follows: 关注关系（用于粉丝数） ==========
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.follows enable row level security;

drop policy if exists "profiles_select_anon" on public.profiles;
create policy "profiles_select_anon"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_insert_anon" on public.profiles;
create policy "profiles_insert_anon"
  on public.profiles for insert
  to anon, authenticated
  with check (true);

drop policy if exists "photos_select_anon" on public.photos;
create policy "photos_select_anon"
  on public.photos for select
  to anon, authenticated
  using (true);

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

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

drop policy if exists "photos_insert_own" on public.photos;
create policy "photos_insert_own"
  on public.photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "photos_insert_admin" on public.photos;
create policy "photos_insert_admin"
  on public.photos for insert
  to authenticated
  with check (public.is_admin());

-- 正式版（Supabase Auth）建议：
-- 1) posts insert: 仅允许写入属于自己的 profile
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

-- 2) post_images insert/delete: 仅允许操作属于自己的帖子
drop policy if exists "post_images_insert_own" on public.post_images;
create policy "post_images_insert_own"
  on public.post_images for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.posts po
      join public.profiles p on p.id = po.profile_id
      where po.id = post_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "post_images_delete_own" on public.post_images;
create policy "post_images_delete_own"
  on public.post_images for delete
  to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles p on p.id = po.profile_id
      where po.id = post_id and p.auth_user_id = auth.uid()
    )
  );

-- 3) follows insert/delete: follower 必须是自己
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = follower_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = follower_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "profiles_update_anon_dev" on public.profiles;
create policy "profiles_update_anon_dev"
  on public.profiles for update
  to anon
  using (true)
  with check (true);

drop policy if exists "photos_insert_anon_dev" on public.photos;
create policy "photos_insert_anon_dev"
  on public.photos for insert
  to anon
  with check (true);

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

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.photos to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant select on public.post_images to anon, authenticated;
grant select on public.follows to anon, authenticated;
grant select on public.profile_follower_counts to anon, authenticated;
grant insert on public.profiles to anon, authenticated;
grant update on public.profiles to anon, authenticated;
grant insert on public.photos to anon, authenticated;
grant delete on public.photos to anon, authenticated;
grant insert on public.posts to anon, authenticated;
grant insert on public.post_images to anon, authenticated;
grant delete on public.post_images to anon, authenticated;
grant insert on public.follows to anon, authenticated;
grant delete on public.follows to anon, authenticated;
grant update on public.profiles to authenticated;

drop policy if exists "photos_delete_anon_dev" on public.photos;
create policy "photos_delete_anon_dev"
  on public.photos for delete
  to anon, authenticated
  using (true);
grant insert on public.photos to authenticated;
grant insert on public.posts to authenticated;
grant insert on public.post_images to authenticated;
grant delete on public.post_images to authenticated;
grant insert on public.follows to authenticated;
grant delete on public.follows to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ========== seed ==========
insert into public.profiles (id, display_name, avatar_url, role)
values
  ('user-1', '小蓝', '', 'member'),
  ('user-2', '小橙', '', 'member'),
  ('user-3', '小绿', '', 'member'),
  ('user-4', '小红', '', 'member'),
  ('user-5', '小紫', '', 'member'),
  ('user-6', '小黄', '', 'member')
on conflict (id) do update set
  display_name = excluded.display_name,
  role = excluded.role;

-- ========== Storage：公开桶 yabu-photos（不上传会报 Bucket not found）==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yabu-photos',
  'yabu-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880;

drop policy if exists "yabu_photos_public_read" on storage.objects;
create policy "yabu_photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'yabu-photos');

drop policy if exists "yabu_photos_anon_insert" on storage.objects;
create policy "yabu_photos_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'yabu-photos');

drop policy if exists "yabu_photos_anon_update" on storage.objects;
create policy "yabu_photos_anon_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'yabu-photos');

drop policy if exists "yabu_photos_anon_delete" on storage.objects;
create policy "yabu_photos_anon_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'yabu-photos');
