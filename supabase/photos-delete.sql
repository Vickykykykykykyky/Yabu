-- 允许用户删除自己的作品（开发环境 anon 可删）
grant delete on public.photos to anon, authenticated;

drop policy if exists "photos_delete_anon_dev" on public.photos;
create policy "photos_delete_anon_dev"
  on public.photos for delete
  to anon, authenticated
  using (true);
