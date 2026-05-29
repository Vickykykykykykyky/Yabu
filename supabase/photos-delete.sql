-- 允许用户删除自己的照片（仅限 photo 归属的 profile 已绑定 auth_user_id）
grant delete on public.photos to anon, authenticated;

drop policy if exists "photos_delete_anon_dev" on public.photos;
drop policy if exists "photos_delete_own" on public.photos;
create policy "photos_delete_own"
  on public.photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.auth_user_id = auth.uid()
    )
  );
