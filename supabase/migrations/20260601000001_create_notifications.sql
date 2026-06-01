create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  receiver_id text not null references public.profiles (id) on delete cascade,
  sender_id text not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'collection', 'follow')),
  post_id uuid references public.posts (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_receiver_idx on public.notifications (receiver_id, is_read);
create index if not exists notifications_sender_post_idx on public.notifications (sender_id, post_id, type);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications for select
  to authenticated using (receiver_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "notifications_select_anon_dev" on public.notifications for select
  to anon using (true);

create policy "notifications_insert_anon_dev" on public.notifications for insert
  to anon with check (true);

create policy "notifications_update_anon_dev" on public.notifications for update
  to anon using (true) with check (true);

create policy "notifications_delete_anon_dev" on public.notifications for delete
  to anon using (true);

grant select, insert, update, delete on public.notifications to anon, authenticated;

alter publication supabase_realtime add table public.notifications;
