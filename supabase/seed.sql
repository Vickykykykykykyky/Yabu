-- 种子数据：首页三栏用户（与当前 App 的 user-1 / user-2 / user-3 一致）
-- 在跑完 migration 后执行

insert into public.profiles (id, display_name, avatar_url, role)
values
  ('user-1', '小蓝', '', 'member'),
  ('user-2', '小橙', '', 'member'),
  ('user-3', '小绿', '', 'member')
on conflict (id) do update set
  display_name = excluded.display_name,
  role = excluded.role;

-- 示例：把某个登录用户设为管理员（先把 auth_user_id 换成真实 UUID）
-- update public.profiles
-- set role = 'admin', auth_user_id = '00000000-0000-0000-0000-000000000000'
-- where id = 'user-1';
