-- 开发阶段：允许 anon 写入（前端尚未接登录，仅用 anon key）
-- 上线前请删除或收紧这些策略

create policy "profiles_update_anon_dev"
  on public.profiles for update
  to anon
  using (true)
  with check (true);

create policy "photos_insert_anon_dev"
  on public.photos for insert
  to anon
  with check (true);

grant update on public.profiles to anon;
grant insert on public.photos to anon;
