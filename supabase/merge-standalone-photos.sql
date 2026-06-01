do $$
declare
  r record;
  pid uuid;
begin
  for r in select profile_id, array_agg(id order by created_at) as photo_ids
           from public.photos where post_id is null group by profile_id
  loop
    insert into public.posts (profile_id) values (r.profile_id) returning id into pid;
    update public.photos set post_id = pid where id = any(r.photo_ids);
    raise notice 'merged % photos for %', array_length(r.photo_ids, 1), r.profile_id;
  end loop;
end;
$$;
