-- 允许更新 photos.url（迁移 R2 用）
grant update on public.photos to anon, authenticated;

drop policy if exists "photos_update_anon_dev" on public.photos;
create policy "photos_update_anon_dev"
  on public.photos for update
  to anon, authenticated
  using (true)
  with check (true);
