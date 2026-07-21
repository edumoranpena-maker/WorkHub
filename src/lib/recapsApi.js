/**
 * recapsApi.js
 * All Supabase data operations for the Recaps & Updates section.
 */

import { supabase, uploadFile, storagePath, deleteFile } from "./supabase.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// A row counts as "edited" if it was updated meaningfully after creation.
// 5s buffer absorbs clock skew between the insert and Postgres's default now().
function wasEdited(row) {
  if (!row.updated_at || !row.created_at) return false;
  return new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > 5000;
}

// Classifies a media item into 'image' | 'video' | 'file', and returns the
// raw File to upload. Accepts either:
//   - a tagged composer item { file, type: 'image'|'video'|'file' }  (preferred —
//     respects what the user actually attached it as, e.g. an image
//     deliberately attached via the "Archivo" chip stays a file)
//   - a raw browser File (fallback — inferred from MIME type)
// Archivos get exactly the same treatment as images/videos: their own bucket,
// their own DB type, nothing provisional or client-only about it.
function classifyMedia(item) {
  const file = item?.file ?? item;
  if (!file) return null;
  let kind = item?.type;
  if (kind !== "image" && kind !== "video" && kind !== "file") {
    kind = file.type?.startsWith("video/") ? "video"
         : file.type?.startsWith("image/") ? "image"
         : "file";
  }
  const bucket = kind === "video" ? "videos" : kind === "image" ? "images" : "files";
  return { file, kind, bucket };
}

function rowToThread(row, media = [], updates = [], subtemas = []) {
  return {
    id: row.id,
    planningPostId: row.planning_post_id ?? null,
    parentThreadId: row.parent_thread_id ?? null,
    title: row.title ?? null,
    content: row.content,
    hashtags: row.hashtags ?? [],
    status: row.status,
    visibility: row.visibility,
    edited: wasEdited(row),
    pinned: row.pinned ?? false,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at) : null,
    author: row.author,
    authorRole: row.author_role,
    timestamp: new Date(row.created_at),
    likes: row.likes_count ?? 0,
    liked: false,
    commentCount: row.comment_count ?? 0,
    newUpdates: row.new_updates_count ?? 0,
    media: media.map(m => ({ type: m.type, url: m.url, thumb: m.thumb_url ?? m.url, name: m.file_name ?? null })),
    audio: row.audio_url
      ? { url: row.audio_url, duration: row.audio_duration ?? 0, waveform: row.audio_waveform ?? [] }
      : null,
    updates,
    subtemas,
  };
}

function rowToUpdate(row, media = []) {
  return {
    id: row.id,
    content: row.content,
    edited: wasEdited(row),
    timestamp: new Date(row.created_at),
    likes: row.likes_count ?? 0,
    liked: false,
    media: media.map(m => ({ type: m.type, url: m.url, thumb: m.thumb_url ?? m.url, name: m.file_name ?? null })),
    audio: row.audio_url
      ? { url: row.audio_url, duration: row.audio_duration ?? 0, waveform: row.audio_waveform ?? [] }
      : null,
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Fetch all top-level recap threads (Posts) with their media and updates.
 *  Subtemas are recap_threads rows too now, so they're explicitly excluded
 *  here — fetch them per-thread via fetchSubtemas() when a Post is opened. */
export async function fetchRecapThreads() {
  const { data: threads, error } = await supabase
    .from("recap_threads")
    .select("*")
    .is("parent_thread_id", null)
    .order("created_at", { ascending: false });

  if (error) { console.error("[recapsApi] fetchRecapThreads:", error.message); return []; }
  if (!threads.length) return [];

  const threadIds = threads.map(t => t.id);

  // Thread media
  const { data: allThreadMedia } = await supabase.from("thread_media").select("*").in("thread_id", threadIds);
  const threadMediaMap = {};
  (allThreadMedia ?? []).forEach(m => {
    if (!threadMediaMap[m.thread_id]) threadMediaMap[m.thread_id] = [];
    threadMediaMap[m.thread_id].push(m);
  });

  // Updates
  const { data: allUpdates } = await supabase
    .from("thread_updates")
    .select("*")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: true });

  const updateIds = (allUpdates ?? []).map(u => u.id);
  const { data: allUpdateMedia } = updateIds.length
    ? await supabase.from("update_media").select("*").in("update_id", updateIds)
    : { data: [] };

  const updateMediaMap = {};
  (allUpdateMedia ?? []).forEach(m => {
    if (!updateMediaMap[m.update_id]) updateMediaMap[m.update_id] = [];
    updateMediaMap[m.update_id].push(m);
  });

  const updatesByThread = {};
  (allUpdates ?? []).forEach(u => {
    if (!updatesByThread[u.thread_id]) updatesByThread[u.thread_id] = [];
    updatesByThread[u.thread_id].push(rowToUpdate(u, updateMediaMap[u.id] ?? []));
  });

  return threads.map(t => rowToThread(t, threadMediaMap[t.id] ?? [], updatesByThread[t.id] ?? []));
}

/** Fetch a single thread by ID (for deep-link navigation from Planning). */
export async function fetchRecapThreadById(threadId) {
  const { data: thread, error } = await supabase
    .from("recap_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (error) { console.error("[recapsApi] fetchRecapThreadById:", error.message); return null; }

  const { data: media } = await supabase.from("thread_media").select("*").eq("thread_id", threadId);
  const { data: updates } = await supabase.from("thread_updates").select("*").eq("thread_id", threadId).order("created_at", { ascending: true });

  const updateIds = (updates ?? []).map(u => u.id);
  const { data: updateMedia } = updateIds.length
    ? await supabase.from("update_media").select("*").in("update_id", updateIds)
    : { data: [] };

  const updateMediaMap = {};
  (updateMedia ?? []).forEach(m => {
    if (!updateMediaMap[m.update_id]) updateMediaMap[m.update_id] = [];
    updateMediaMap[m.update_id].push(m);
  });

  return rowToThread(
    thread,
    media ?? [],
    (updates ?? []).map(u => rowToUpdate(u, updateMediaMap[u.id] ?? []))
  );
}

/** Fetch a thread linked to a specific planning post. */
export async function fetchThreadByPlanningPost(planningPostId) {
  const { data: thread, error } = await supabase
    .from("recap_threads")
    .select("*")
    .eq("planning_post_id", planningPostId)
    .maybeSingle();

  if (error || !thread) return null;
  return fetchRecapThreadById(thread.id);
}

/** Fetch comments for a recap thread. */
export async function fetchThreadComments(threadId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) { console.error("[recapsApi] fetchThreadComments:", error.message); return []; }
  return (data ?? []).map(c => ({
    id: c.id, author: c.author, avatar: c.avatar ?? c.author?.[0]?.toUpperCase() ?? "?",
    text: c.text, likes: c.likes_count, liked: false, time: c.created_at,
  }));
}

/**
 * Fetch a Post's Subtemas — each one is a full recap_threads row (parent_thread_id
 * = this thread), with its own media and updates, same shape as a top-level Post.
 * Loaded on-demand when the Thread is opened (like comments), not eagerly with
 * the whole feed, since a Subtema can carry its own nested updates+media.
 */
export async function fetchSubtemas(threadId) {
  const { data: subtemas, error } = await supabase
    .from("recap_threads")
    .select("*")
    .eq("parent_thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) { console.error("[recapsApi] fetchSubtemas:", error.message); return []; }
  if (!subtemas.length) return [];

  const subtemaIds = subtemas.map(s => s.id);

  const { data: allMedia } = await supabase.from("thread_media").select("*").in("thread_id", subtemaIds);
  const mediaMap = {};
  (allMedia ?? []).forEach(m => { (mediaMap[m.thread_id] ??= []).push(m); });

  const { data: allUpdates } = await supabase
    .from("thread_updates")
    .select("*")
    .in("thread_id", subtemaIds)
    .order("created_at", { ascending: true });

  const updateIds = (allUpdates ?? []).map(u => u.id);
  const { data: allUpdateMedia } = updateIds.length
    ? await supabase.from("update_media").select("*").in("update_id", updateIds)
    : { data: [] };

  const updateMediaMap = {};
  (allUpdateMedia ?? []).forEach(m => { (updateMediaMap[m.update_id] ??= []).push(m); });

  const updatesBySubtema = {};
  (allUpdates ?? []).forEach(u => {
    (updatesBySubtema[u.thread_id] ??= []).push(rowToUpdate(u, updateMediaMap[u.id] ?? []));
  });

  return subtemas.map(s => rowToThread(s, mediaMap[s.id] ?? [], updatesBySubtema[s.id] ?? []));
}



/**
 * Shared by createRecapThread (top-level Post) and createSubtema — the only
 * difference between the two is whether parent_thread_id is set. Everything
 * else (audio upload, media upload incl. Archivos, DB insert) is identical,
 * so Subtemas get exactly the same persistence guarantees as Posts.
 */
async function insertThreadRow({ title, content, privacy, audio, mediaFiles = [], planningPostId = null, parentThreadId = null }, author = "Luis Morp") {
  // 1. Upload audio
  let audioUrl = null, audioDuration = 0, audioWaveform = [];
  if (audio?.blob) {
    const path = storagePath("threads", "recording.webm");
    audioUrl = await uploadFile("audio", audio.blob, path);
    audioDuration = audio.duration ?? 0;
    audioWaveform = audio.waveform ?? [];
  } else if (audio?.url && !audio.url.startsWith("blob:")) {
    audioUrl = audio.url; audioDuration = audio.duration ?? 0; audioWaveform = audio.waveform ?? [];
  }

  // 2. Insert thread row
  const { data: thread, error } = await supabase
    .from("recap_threads")
    .insert({
      planning_post_id: planningPostId || null,
      parent_thread_id: parentThreadId || null,
      title: title || null,
      content,
      visibility: privacy ?? "public",
      author,
      audio_url: audioUrl,
      audio_duration: audioDuration || null,
      audio_waveform: audioWaveform.length ? audioWaveform : null,
    })
    .select()
    .single();

  if (error) { console.error("[recapsApi] insertThreadRow:", error.message); return null; }

  // 3. Upload media — Archivos get exactly the same treatment as images/videos:
  // their own bucket, their own DB type, their own filename.
  const insertedMedia = [];
  for (const item of mediaFiles) {
    const classified = classifyMedia(item);
    if (!classified) continue;
    const { file, kind, bucket } = classified;
    const folder = parentThreadId ? "subtemas" : "threads";
    const path = storagePath(`${folder}/${kind === "video" ? "videos" : kind === "image" ? "images" : "files"}`, file.name);
    const url = await uploadFile(bucket, file, path);
    if (!url) continue;
    const { data: mRow } = await supabase.from("thread_media")
      .insert({ thread_id: thread.id, type: kind, url, thumb_url: kind === "file" ? null : url, storage_path: path, file_name: file.name })
      .select().single();
    if (mRow) insertedMedia.push(mRow);
  }

  return rowToThread(thread, insertedMedia, []);
}

/** Create a new top-level recap thread (Post), optionally linked to a planning post. */
export async function createRecapThread(params, author = "Luis Morp") {
  return insertThreadRow(params, author);
}

/**
 * Create a Subtema under a Post. A Subtema is a full recap_threads row
 * (parent_thread_id = threadId) — same persistence, same media pipeline,
 * same edit/delete infrastructure as a Post. No client-only state involved.
 */
export async function createSubtema(parentThreadId, { title, content, audio, mediaFiles = [], visibility } = {}, author = "Luis Morp") {
  if (!parentThreadId) { console.error("[recapsApi] createSubtema: parentThreadId is required"); return null; }
  return insertThreadRow({ title, content, audio, mediaFiles, privacy: visibility, parentThreadId }, author);
}

/**
 * Add an update (sub-message) to an existing thread.
 * Handles audio blob upload + media file uploads.
 */
export async function addThreadUpdate(threadId, { content, audio, mediaFiles = [] }, author = "Luis Morp") {
  // 1. Upload audio
  let audioUrl = null, audioDuration = 0, audioWaveform = [];
  if (audio?.blob) {
    const path = storagePath("updates", "recording.webm");
    audioUrl = await uploadFile("audio", audio.blob, path);
    audioDuration = audio.duration ?? 0;
    audioWaveform = audio.waveform ?? [];
  } else if (audio?.url && !audio.url.startsWith("blob:")) {
    audioUrl = audio.url; audioDuration = audio.duration ?? 0; audioWaveform = audio.waveform ?? [];
  }

  // 2. Insert update
  const { data: update, error } = await supabase
    .from("thread_updates")
    .insert({
      thread_id: threadId,
      content,
      author,
      audio_url: audioUrl,
      audio_duration: audioDuration || null,
      audio_waveform: audioWaveform.length ? audioWaveform : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[recapsApi] addThreadUpdate INSERT error:", error.message, error);
    return null;
  }

  // 3. Increment new_updates_count on thread (not an edit of the post's own
  //    content, so updated_at is deliberately left untouched here)
  await supabase.from("recap_threads").select("new_updates_count").eq("id", threadId).single()
    .then(({ data: t }) => t && supabase.from("recap_threads")
      .update({ new_updates_count: (t.new_updates_count ?? 0) + 1 })
      .eq("id", threadId));

  // 4. Upload media — Archivos get exactly the same treatment as images/videos.
  const insertedMedia = [];
  for (const item of mediaFiles) {
    const classified = classifyMedia(item);
    if (!classified) continue;
    const { file, kind, bucket } = classified;
    const path = storagePath(`updates/${kind === "video" ? "videos" : kind === "image" ? "images" : "files"}`, file.name);

    const url = await uploadFile(bucket, file, path);
    if (!url) {
      console.error(`[addThreadUpdate] uploadFile returned null for ${file.name} — skipping update_media INSERT`);
      continue;
    }

    const { data: mRow, error: mErr } = await supabase.from("update_media")
      .insert({ update_id: update.id, type: kind, url, thumb_url: kind === "file" ? null : url, storage_path: path, file_name: file.name })
      .select().single();

    if (mErr) {
      console.error("[addThreadUpdate] update_media INSERT error:", mErr.message, mErr);
    } else {
      insertedMedia.push(mRow);
    }
  }

  const result = rowToUpdate(update, insertedMedia);
  return result;
}

/** Toggle like on a thread. */
export async function toggleThreadLike(threadId, userId = "anonymous") {
  const { data: existing } = await supabase.from("likes").select("id").eq("thread_id", threadId).eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
    await supabase.from("recap_threads").select("likes_count").eq("id", threadId).single()
      .then(({ data: t }) => t && supabase.from("recap_threads").update({ likes_count: Math.max(0, (t.likes_count ?? 1) - 1) }).eq("id", threadId));
    return false;
  } else {
    await supabase.from("likes").insert({ thread_id: threadId, user_id: userId });
    await supabase.from("recap_threads").select("likes_count").eq("id", threadId).single()
      .then(({ data: t }) => t && supabase.from("recap_threads").update({ likes_count: (t.likes_count ?? 0) + 1 }).eq("id", threadId));
    return true;
  }
}

/** Toggle like on an update. */
export async function toggleUpdateLike(updateId, userId = "anonymous") {
  const { data: existing } = await supabase.from("likes").select("id").eq("update_id", updateId).eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
    await supabase.from("thread_updates").select("likes_count").eq("id", updateId).single()
      .then(({ data: u }) => u && supabase.from("thread_updates").update({ likes_count: Math.max(0, (u.likes_count ?? 1) - 1) }).eq("id", updateId));
    return false;
  } else {
    await supabase.from("likes").insert({ update_id: updateId, user_id: userId });
    await supabase.from("thread_updates").select("likes_count").eq("id", updateId).single()
      .then(({ data: u }) => u && supabase.from("thread_updates").update({ likes_count: (u.likes_count ?? 0) + 1 }).eq("id", updateId));
    return true;
  }
}

/** Add a comment to a recap thread. */
export async function addThreadComment(threadId, { author, text }) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ thread_id: threadId, author, avatar: author?.[0]?.toUpperCase(), text })
    .select()
    .single();
  if (error) { console.error("[recapsApi] addThreadComment:", error.message); return null; }
  await supabase.from("recap_threads").select("comment_count").eq("id", threadId).single()
    .then(({ data: t }) => t && supabase.from("recap_threads").update({ comment_count: (t.comment_count ?? 0) + 1 }).eq("id", threadId));
  return { id: data.id, author: data.author, avatar: data.avatar, text: data.text, likes: 0, liked: false, time: data.created_at };
}

/** Update thread status. Doesn't touch updated_at — a status change isn't a
 *  content edit, so it shouldn't trigger the "Editado" indicator. */
export async function updateThreadStatus(threadId, status) {
  const { error } = await supabase.from("recap_threads").update({ status }).eq("id", threadId);
  if (error) console.error("[recapsApi] updateThreadStatus:", error.message);
  return !error;
}

/** Pin or unpin a thread (Post). pinned_at drives "most recently pinned
 *  first" ordering in the feed — set to now() when pinning, cleared when
 *  unpinning. Like updateThreadStatus, doesn't touch updated_at: pinning
 *  isn't a content edit and shouldn't trigger the "Editado" indicator. */
export async function toggleThreadPin(threadId, pinned) {
  const { error } = await supabase
    .from("recap_threads")
    .update({ pinned, pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", threadId);
  if (error) console.error("[recapsApi] toggleThreadPin:", error.message);
  return !error;
}

/** Reset the unseen-updates counter for a thread (called when it's opened/viewed).
 *  Doesn't touch updated_at for the same reason as above. */
export async function resetThreadNewUpdates(threadId) {
  const { error } = await supabase.from("recap_threads").update({ new_updates_count: 0 }).eq("id", threadId);
  if (error) console.error("[recapsApi] resetThreadNewUpdates:", error.message);
  return !error;
}

/**
 * Best-effort Storage cleanup. DB rows never end up orphaned regardless of
 * whether this succeeds — thread_media, update_media, thread_updates,
 * comments and likes all use ON DELETE CASCADE on thread_id/update_id in
 * the schema, so the actual DB delete below is what guarantees no orphan
 * rows. This only prevents orphan *files* left behind in Storage buckets.
 *
 * NOTE: audio (recap_threads.audio_url / thread_updates.audio_url) has no
 * storage_path column in this schema, so it can't be targeted safely here
 * without fragile URL parsing — audio files are left in Storage (unused but
 * harmless) until a storage_path column is added for them too.
 */
async function removeStorageObjects(rows) {
  const byBucket = {};
  for (const r of rows) {
    if (!r.storage_path) continue;
    const bucket = r.type === "video" ? "videos" : r.type === "file" ? "files" : "images";
    (byBucket[bucket] ??= []).push(r.storage_path);
  }
  await Promise.all(
    Object.entries(byBucket).map(([bucket, paths]) =>
      supabase.storage.from(bucket).remove(paths).catch(e => console.error(`[recapsApi] storage cleanup (${bucket}):`, e.message))
    )
  );
}

async function purgeThreadStorage(threadId) {
  try {
    const { data: media } = await supabase.from("thread_media").select("type, storage_path").eq("thread_id", threadId);
    const { data: updates } = await supabase.from("thread_updates").select("id").eq("thread_id", threadId);
    const updateIds = (updates || []).map(u => u.id);
    let updateMedia = [];
    if (updateIds.length) {
      const { data } = await supabase.from("update_media").select("type, storage_path").in("update_id", updateIds);
      updateMedia = data || [];
    }

    // Subtemas cascade-delete in the DB along with the parent Post, but their
    // Storage files won't clean themselves up — walk them the same way.
    const { data: subtemas } = await supabase.from("recap_threads").select("id").eq("parent_thread_id", threadId);
    const subtemaIds = (subtemas || []).map(s => s.id);
    let subtemaMedia = [], subtemaUpdateMedia = [];
    if (subtemaIds.length) {
      const { data: sMedia } = await supabase.from("thread_media").select("type, storage_path").in("thread_id", subtemaIds);
      subtemaMedia = sMedia || [];
      const { data: sUpdates } = await supabase.from("thread_updates").select("id").in("thread_id", subtemaIds);
      const sUpdateIds = (sUpdates || []).map(u => u.id);
      if (sUpdateIds.length) {
        const { data: sUpdateMedia } = await supabase.from("update_media").select("type, storage_path").in("update_id", sUpdateIds);
        subtemaUpdateMedia = sUpdateMedia || [];
      }
    }

    await removeStorageObjects([...(media || []), ...updateMedia, ...subtemaMedia, ...subtemaUpdateMedia]);
  } catch (err) {
    console.error("[recapsApi] purgeThreadStorage (non-blocking):", err.message);
  }
}

async function purgeUpdateStorage(updateId) {
  try {
    const { data } = await supabase.from("update_media").select("type, storage_path").eq("update_id", updateId);
    await removeStorageObjects(data || []);
  } catch (err) {
    console.error("[recapsApi] purgeUpdateStorage (non-blocking):", err.message);
  }
}

/**
 * Delete a thread (Post or Subtema — same table now). thread_media /
 * thread_updates / update_media / comments / likes all cascade automatically
 * at the DB level (ON DELETE CASCADE on thread_id — see supabase-schema.sql).
 * Subtemas (parent_thread_id) cascade too, so deleting a Post correctly takes
 * its Subtemas down with it. This one delete is enough to leave zero orphan
 * rows. Storage files (incl. Subtemas' own) are purged best-effort first.
 */
export async function deleteRecapThread(threadId) {
  await purgeThreadStorage(threadId);
  const { error } = await supabase.from("recap_threads").delete().eq("id", threadId);
  if (error) console.error("[recapsApi] deleteRecapThread:", error.message);
  return !error;
}

/**
 * Update content of a recap thread.
 */
export async function updateRecapThread(threadId, { title, content, visibility }) {
  const { error } = await supabase
    .from("recap_threads")
    .update({ title: title ?? null, content, visibility, updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) console.error("[recapsApi] updateRecapThread:", error.message);
  return !error;
}

/**
 * Update content of a thread update (sub-post).
 */
export async function updateThreadUpdate(updateId, { content }) {
  const { error } = await supabase
    .from("thread_updates")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", updateId);
  if (error) console.error("[recapsApi] updateThreadUpdate:", error.message);
  return !error;
}

/**
 * Delete a thread update. update_media / likes cascade automatically at the
 * DB level (ON DELETE CASCADE on update_id). Storage files purged best-effort first.
 */
export async function deleteThreadUpdate(updateId) {
  await purgeUpdateStorage(updateId);
  const { error } = await supabase.from("thread_updates").delete().eq("id", updateId);
  if (error) console.error("[recapsApi] deleteThreadUpdate:", error.message);
  return !error;
}
