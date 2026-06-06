-- 密码登录 + 绑定 auth.users
-- 在 Supabase SQL Editor 运行整文件
-- https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new

create extension if not exists pgcrypto;

-- 可选：关联的真实邮箱（用于邮箱登录）
alter table public.profiles
  add column if not exists contact_email text;

create unique index if not exists profiles_contact_email_unique
  on public.profiles (contact_email)
  where contact_email is not null;

-- 注册：需已 signUp 登录，绑定 auth.uid()
create or replace function public.register_profile_auth(
  p_display_name text,
  p_profile_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_name text;
  v_row public.profiles%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception using message = '未登录，请先完成账号注册';
  end if;

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
  if exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception using message = 'ID 冲突，请重试';
  end if;
  if exists (select 1 from public.profiles where auth_user_id = v_uid) then
    raise exception using message = '该登录账号已绑定资料';
  end if;

  insert into public.profiles (id, display_name, avatar_url, role, auth_user_id)
  values (p_profile_id, v_name, '', 'member', v_uid)
  returning * into v_row;

  return json_build_object(
    'id', v_row.id,
    'display_name', v_row.display_name,
    'avatar_url', v_row.avatar_url,
    'role', v_row.role
  );
end;
$$;

revoke all on function public.register_profile_auth(text, text) from public;
grant execute on function public.register_profile_auth(text, text) to authenticated;

-- 为已有 profiles 创建 auth 用户，初始密码 0506
-- 需在 Dashboard → Authentication → Providers 关闭「Confirm email」以便即时登录
do $$
declare
  rec record;
  v_uid uuid;
  v_email text;
begin
  for rec in
    select id, display_name
    from public.profiles
    where auth_user_id is null
  loop
    v_uid := gen_random_uuid();
    v_email := rec.id || '@users.yabu.chat';

    if exists (select 1 from auth.users where email = v_email) then
      select id into v_uid from auth.users where email = v_email limit 1;
    else
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_uid,
        'authenticated',
        'authenticated',
        v_email,
        crypt('0506', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'display_name', rec.display_name,
          'profile_id', rec.id,
          'must_change_password', true
        ),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );

      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email),
        'email',
        v_uid::text,
        now(),
        now(),
        now()
      );
    end if;

    update public.profiles
    set auth_user_id = v_uid
    where id = rec.id;
  end loop;
end $$;

-- 允许已登录用户更新自己的 contact_email
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

grant update on public.profiles to authenticated;
