# Workspace Platform v5 — Supabase Integration

## What's New in v5

Full Supabase backend integration:
- **Authentication-ready** client setup
- **Persistent database** for Planning posts, Recap threads, updates, comments, likes, RR snapshots
- **Storage buckets** for images, videos, and audio recordings
- **Persistent audio** — recordings upload to Supabase Storage and survive page refresh
- **Relational data** — Recap threads link to Planning posts via `planning_post_id`
- **Optimistic UI** — all writes update the UI immediately, then persist in background

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Environment Variables
A `.env` file is already included with your credentials.
> Add `.env` to `.gitignore` before committing.

### 3. Run the Supabase schema
1. Open Supabase Dashboard → SQL Editor
2. Paste `supabase-schema.sql` contents → Run

### 4. Create Storage Buckets
Dashboard → Storage → New bucket:
- `images` (Public)
- `videos` (Public)
- `audio` (Public)

Then run the storage policy section at the bottom of `supabase-schema.sql`.

### 5. Start the app
```bash
npm run dev
```

---

## Architecture

```
src/
├── lib/
│   ├── supabase.js        Supabase client + storage helpers
│   ├── planningApi.js     Planning section DB operations
│   ├── recapsApi.js       Recaps & Updates DB operations
│   └── useAudioUpload.js  Hook: record → upload → persistent URL
└── sections/
    ├── Planning.jsx        Wired to planningApi.js
    ├── Recaps.jsx          Wired to recapsApi.js
    └── Announcements.jsx   (extend with announcementsApi.js)
```

## Audio Fix

**Before:** blob: URL → disappears on refresh
**After:** Blob uploaded to Supabase Storage → permanent CDN URL stored in DB → plays forever

## Key Relations

```
planning_posts → recap_threads (planning_post_id)
             → thread_updates (thread_id)
             → comments, likes, rr_snapshots, post_media
```
