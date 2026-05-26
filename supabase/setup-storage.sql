-- 在 SQL Editor 执行一次：照片文件存 Storage，不再把大图塞进 photos.url
-- Dashboard → Storage 里会出现 bucket「yabu-photos」

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
