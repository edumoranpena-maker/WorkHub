-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace Platform — Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor to initialise your database.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PLANNING POSTS ───────────────────────────────────────────────────────────
create table if not exists planning_posts (
  id              uuid primary key default uuid_generate_v4(),
  title           text,
  content         text not null,
  hashtags        text[]    default '{}',
  visibility      text      default 'members' check (visibility in ('public', 'members', 'followers')),
  status          text      default 'active'  check (status  in ('active', 'in_progress', 'closed')),
  pinned          boolean   default false,
  author          text      not null default 'Alex H.',
  author_role     text      default 'host',
  likes_count     integer   default 0,
  comment_count   integer   default 0,
  -- Audio
  audio_url       text,
  audio_duration  integer,  -- seconds
  audio_waveform  float[]   default '{}',
  -- Trade / RR fields
  floating_rr     numeric,
  realized_rr     numeric,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── POST MEDIA (images / videos attached to planning posts) ──────────────────
create table if not exists post_media (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid references planning_posts(id) on delete cascade,
  type        text not null check (type in ('image', 'video', 'file')),
  url         text not null,
  thumb_url   text,
  storage_path text,
  file_name   text,
  created_at  timestamptz default now()
);

-- ─── RECAP / UPDATE THREADS ───────────────────────────────────────────────────
-- Threads are linked to planning posts via planning_post_id (may be null for
-- standalone recaps).
create table if not exists recap_threads (
  id                uuid primary key default uuid_generate_v4(),
  planning_post_id  uuid references planning_posts(id) on delete set null,
  parent_thread_id  uuid references recap_threads(id) on delete cascade,
  title             text,
  content           text not null,
  hashtags          text[]  default '{}',
  visibility        text    default 'members' check (visibility in ('public', 'members', 'followers')),
  status            text    default 'active'  check (status  in ('active', 'in_progress', 'closed')),
  author            text    not null default 'Alex H.',
  author_role       text    default 'host',
  likes_count       integer default 0,
  comment_count     integer default 0,
  new_updates_count integer default 0,
  -- Audio for the thread opener
  audio_url         text,
  audio_duration    integer,
  audio_waveform    float[] default '{}',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── THREAD MEDIA ─────────────────────────────────────────────────────────────
create table if not exists thread_media (
  id          uuid primary key default uuid_generate_v4(),
  thread_id   uuid references recap_threads(id) on delete cascade,
  type        text not null check (type in ('image', 'video', 'file')),
  url         text not null,
  thumb_url   text,
  storage_path text,
  file_name   text,
  created_at  timestamptz default now()
);

-- ─── THREAD UPDATES (individual update messages within a Recaps thread) ───────
create table if not exists thread_updates (
  id          uuid primary key default uuid_generate_v4(),
  thread_id   uuid references recap_threads(id) on delete cascade,
  content     text not null,
  author      text not null default 'Alex H.',
  author_role text default 'host',
  likes_count integer default 0,
  -- Audio
  audio_url       text,
  audio_duration  integer,
  audio_waveform  float[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── UPDATE MEDIA ─────────────────────────────────────────────────────────────
create table if not exists update_media (
  id          uuid primary key default uuid_generate_v4(),
  update_id   uuid references thread_updates(id) on delete cascade,
  type        text not null check (type in ('image', 'video', 'file')),
  url         text not null,
  thumb_url   text,
  storage_path text,
  file_name   text,
  created_at  timestamptz default now()
);

-- ─── COMMENTS ─────────────────────────────────────────────────────────────────
create table if not exists comments (
  id          uuid primary key default uuid_generate_v4(),
  -- A comment belongs to either a planning post OR a recap thread (not both)
  post_id     uuid references planning_posts(id) on delete cascade,
  thread_id   uuid references recap_threads(id)  on delete cascade,
  author      text not null,
  avatar      text,
  text        text not null,
  likes_count integer default 0,
  created_at  timestamptz default now(),
  constraint exactly_one_parent check (
    (post_id is not null)::int + (thread_id is not null)::int = 1
  )
);

-- ─── LIKES ────────────────────────────────────────────────────────────────────
create table if not exists likes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     text not null default 'anonymous',  -- replace with auth.uid() when auth is wired
  -- target: one of the following
  post_id     uuid references planning_posts(id) on delete cascade,
  thread_id   uuid references recap_threads(id)  on delete cascade,
  update_id   uuid references thread_updates(id) on delete cascade,
  comment_id  uuid references comments(id)       on delete cascade,
  created_at  timestamptz default now(),
  -- Ensure a user can only like a given item once
  unique (user_id, post_id),
  unique (user_id, thread_id),
  unique (user_id, update_id),
  unique (user_id, comment_id)
);

-- ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
create table if not exists announcements (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  content     text not null,
  tag         text default 'Official',
  pinned      boolean default false,
  author      text not null default 'Admin',
  author_role text default 'admin',
  likes_count integer default 0,
  comment_count integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── FLOATING RR SNAPSHOTS ────────────────────────────────────────────────────
create table if not exists rr_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid references planning_posts(id) on delete cascade,
  floating_rr numeric not null,
  realized_rr numeric,
  snapshot_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row-Level Security (RLS) — open read access for now; restrict writes later
-- ═══════════════════════════════════════════════════════════════════════════════

alter table planning_posts   enable row level security;
alter table post_media       enable row level security;
alter table recap_threads    enable row level security;
alter table thread_media     enable row level security;
alter table thread_updates   enable row level security;
alter table update_media     enable row level security;
alter table comments         enable row level security;
alter table likes            enable row level security;
alter table announcements    enable row level security;
alter table rr_snapshots     enable row level security;

-- Allow full access via anon key (tighten once auth is live)
create policy "Public read" on planning_posts  for select using (true);
create policy "Public insert" on planning_posts for insert with check (true);
create policy "Public update" on planning_posts for update using (true);
create policy "Public delete" on planning_posts for delete using (true);

create policy "Public read" on post_media      for select using (true);
create policy "Public insert" on post_media    for insert with check (true);
create policy "Public delete" on post_media    for delete using (true);

create policy "Public read" on recap_threads   for select using (true);
create policy "Public insert" on recap_threads for insert with check (true);
create policy "Public update" on recap_threads for update using (true);
create policy "Public delete" on recap_threads for delete using (true);

create policy "Public read" on thread_media    for select using (true);
create policy "Public insert" on thread_media  for insert with check (true);
create policy "Public delete" on thread_media  for delete using (true);

create policy "Public read" on thread_updates  for select using (true);
create policy "Public insert" on thread_updates for insert with check (true);
create policy "Public update" on thread_updates for update using (true);
create policy "Public delete" on thread_updates for delete using (true);

create policy "Public read" on update_media    for select using (true);
create policy "Public insert" on update_media  for insert with check (true);
create policy "Public delete" on update_media  for delete using (true);

create policy "Public read" on comments        for select using (true);
create policy "Public insert" on comments      for insert with check (true);
create policy "Public update" on comments      for update using (true);
create policy "Public delete" on comments      for delete using (true);

create policy "Public read" on likes           for select using (true);
create policy "Public insert" on likes         for insert with check (true);
create policy "Public delete" on likes         for delete using (true);

create policy "Public read" on announcements   for select using (true);
create policy "Public insert" on announcements for insert with check (true);
create policy "Public update" on announcements for update using (true);
create policy "Public delete" on announcements for delete using (true);

create policy "Public read" on rr_snapshots    for select using (true);
create policy "Public insert" on rr_snapshots  for insert with check (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Storage bucket policies  (run AFTER creating buckets in the Storage UI)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create buckets named: images, videos, audio, files
-- Then run the following to make them publicly readable:

-- insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('audio',  'audio',  true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('files',  'files',  true) on conflict do nothing;

-- create policy "Public read images"  on storage.objects for select using (bucket_id = 'images');
-- create policy "Public upload images" on storage.objects for insert with check (bucket_id = 'images');
-- create policy "Public delete images" on storage.objects for delete using (bucket_id = 'images');

-- create policy "Public read videos"  on storage.objects for select using (bucket_id = 'videos');
-- create policy "Public upload videos" on storage.objects for insert with check (bucket_id = 'videos');
-- create policy "Public delete videos" on storage.objects for delete using (bucket_id = 'videos');

-- create policy "Public read audio"   on storage.objects for select using (bucket_id = 'audio');
-- create policy "Public upload audio" on storage.objects for insert with check (bucket_id = 'audio');
-- create policy "Public delete audio" on storage.objects for delete using (bucket_id = 'audio');

-- create policy "Public read files"   on storage.objects for select using (bucket_id = 'files');
-- create policy "Public upload files" on storage.objects for insert with check (bucket_id = 'files');
-- create policy "Public delete files" on storage.objects for delete using (bucket_id = 'files');
