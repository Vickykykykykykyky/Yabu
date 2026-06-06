-- 检查当前数据库里已有哪些 Yabu 对象（在 SQL Editor 运行，只看结果）

select 'app_role' as item, exists(
  select 1 from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'app_role'
) as exists;

select 'profiles' as item, exists(
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'profiles'
) as exists;

select 'contact_email column' as item, exists(
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'contact_email'
) as exists;

select 'register_profile_auth' as item, exists(
  select 1 from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'register_profile_auth'
) as exists;

select 'profiles count' as item, (select count(*)::text from public.profiles) as value
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles');

select 'profiles without auth' as item, count(*)::text as value
from public.profiles
where auth_user_id is null;
