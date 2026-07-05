-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002 — Subtemas + Archivos as first-class, persistent entities
-- Run this in Supabase SQL Editor against your EXISTING database.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. SUBTEMAS ────────────────────────────────────────────────────────────────────
-- A Subtema is modeled as a recap_threads row with a parent — it reuses every
-- piece of existing infrastructure (thread_media, thread_updates, update_media,
-- comments, likes, visibility, status, edited-tracking, delete-cascade) instead
-- of inventing a parallel system. parent_thread_id IS NULL  => it's a Post.
-- parent_thread_id IS NOT NULL => it's a Subtema of that Post.
alter table recap_threads
  add column if not exists parent_thread_id uuid references recap_threads(id) on delete cascade;

create index if not exists idx_recap_threads_parent on recap_threads(parent_thread_id);

-- Deleting a Post now correctly cascades to delete all of its Subtemas too
-- (and, transitively, each Subtema's own updates/media/comments/likes — the
-- existing ON DELETE CASCADE chains already in place take care of that).

-- 2. ARCHIVOS (generic files) as a first-class media type ────────────────────────
alter table thread_media  drop constraint if exists thread_media_type_check;
alter table thread_media  add constraint thread_media_type_check
  check (type in ('image', 'video', 'file'));

alter table update_media  drop constraint if exists update_media_type_check;
alter table update_media  add constraint update_media_type_check
  check (type in ('image', 'video', 'file'));

-- Original filename — needed to render a file's real name (images/videos never
-- needed this before since they render as previews, not by name).
alter table thread_media add column if not exists file_name text;
alter table update_media add column if not exists file_name text;

-- 3. Storage bucket for Archivos ──────────────────────────────────────────────────
-- Run this part in the Supabase dashboard (Storage → New bucket) or via SQL:
insert into storage.buckets (id, name, public) values ('files', 'files', true) on conflict do nothing;

create policy "Public read files"   on storage.objects for select using (bucket_id = 'files');
create policy "Public upload files" on storage.objects for insert with check (bucket_id = 'files');
create policy "Public delete files" on storage.objects for delete using (bucket_id = 'files');
