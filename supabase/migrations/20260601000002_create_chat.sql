-- Create chat_rooms and messages tables for DM/private chat
-- Run in Supabase SQL Editor or via CLI migration

-- Chat rooms: one room per pair of users
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user1_id text not null references public.profiles (id) on delete cascade,
  user2_id text not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint chat_rooms_unique_pair unique (user1_id, user2_id),
  constraint chat_rooms_no_self check (user1_id <> user2_id)
);

create index if not exists chat_rooms_user1_idx on public.chat_rooms (user1_id, last_message_at desc);
create index if not exists chat_rooms_user2_idx on public.chat_rooms (user2_id, last_message_at desc);

-- Messages within a chat room
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id text not null references public.profiles (id) on delete cascade,
  content text not null default '',
  image_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_id_created_at_idx
  on public.messages (room_id, created_at asc);
create index if not exists messages_unread_idx
  on public.messages (room_id, is_read)
  where is_read = false;

-- RLS
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;

-- Policies for chat_rooms (anon dev mode: permissive; tighten for production with auth.uid())
drop policy if exists "chat_rooms_select_own" on public.chat_rooms;
create policy "chat_rooms_select_own"
  on public.chat_rooms for select
  to anon, authenticated
  using (true);

drop policy if exists "chat_rooms_insert_own" on public.chat_rooms;
create policy "chat_rooms_insert_own"
  on public.chat_rooms for insert
  to anon, authenticated
  with check (true);

drop policy if exists "chat_rooms_update_own" on public.chat_rooms;
create policy "chat_rooms_update_own"
  on public.chat_rooms for update
  to anon, authenticated
  using (true)
  with check (true);

-- Policies for messages
drop policy if exists "messages_select_in_room" on public.messages;
create policy "messages_select_in_room"
  on public.messages for select
  to anon, authenticated
  using (true);

drop policy if exists "messages_insert_in_room" on public.messages;
create policy "messages_insert_in_room"
  on public.messages for insert
  to anon, authenticated
  with check (true);

drop policy if exists "messages_update_in_room" on public.messages;
create policy "messages_update_in_room"
  on public.messages for update
  to anon, authenticated
  using (true)
  with check (true);

-- Grants
grant select, insert, update on public.chat_rooms to anon, authenticated;
grant select, insert, update on public.messages to anon, authenticated;

-- Enable Supabase Realtime for messages table
alter publication supabase_realtime add table public.messages;
