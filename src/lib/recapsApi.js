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

function rowToThread(row, media = [], updates = []) {
  return {
    id: row.id,
    planningPostId: row.planning_post_id ?? null,
    title: row.title ?? null,
    content: row.content,
    hashtags: row.hashtags ?? [],
    status: row.status,
    visibility: row.visibility,
    edited: wasEdited(row),
    author: row.author,
    authorRole: row.author_role,
    timestamp: new Date(row.created_at),
    likes: row.likes_count ?? 0,
    liked: false,
    commentCount: row.comment_count ?? 0,
    newUpdates: row.new_updates_count ?? 0,
    media: media.map(m => ({ type: m.type, url: m.url, thumb: m.thumb_url ?? m.url })),
    audio: row.audio_url
      ? { url: row.audio_url, duration: row.audio_duration ?? 0, waveform: row.audio_waveform ?? [] }
      : null,
    updates,
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
    media: media.map(m => ({ type: m.type, url: m.url, thumb: m.thumb_url ?? m.url })),
    audio: row.audio_url
      ? { url: row.audio_url, duration: row.audio_duration ?? 0, waveform: row.audio_waveform ?? [] }
      : null,
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Fetch all recap threads with their media and updates. */
export async function fetchRecapThreads() {
  const { data: threads, error } = await supabase
    .from("recap_threads")
    .select("*")
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

// ─── Write ────────────────────────────────────────────────────────────────────

/** Create a new recap thread, optionally linked to a planning post. */
export async function createRecapThread({ title, content, privacy, audio, mediaFiles = [], planningPostId = null }, author = "Alex H.") {
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

  // 2. Insert thread
  const { data: thread, error } = await supabase
    .from("recap_threads")
    .insert({
      planning_post_id: planningPostId || null,
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

  if (error) { console.error("[recapsApi] createRecapThread:", error.message); return null; }

  // 3. Upload media
  const insertedMedia = [];
  for (const file of mediaFiles) {
    const isVideo = file.type?.startsWith("video/");
    const bucket = isVideo ? "videos" : "images";
    const path = storagePath(isVideo ? "threads/videos" : "threads/images", file.name);
    const url = await uploadFile(bucket, file, path);
    if (!url) continue;
    const { data: mRow } = await supabase.from("thread_media")
      .insert({ thread_id: thread.id, type: isVideo ? "video" : "image", url, thumb_url: url, storage_path: path })
      .select().single();
    if (mRow) insertedMedia.push(mRow);
  }

  return rowToThread(thread, insertedMedia, []);
}

/**
 * Add an update (sub-message) to an existing thread.
 * Handles audio blob upload + media file uploads.
 */
export async function addThreadUpdate(threadId, { content, audio, mediaFiles = [] }, author = "Alex H.") {
  // ── LOG 4a: incoming payload ───────────────────────────────────────────────
  console.group("[addThreadUpdate] called");
  console.log("threadId:", threadId);
  console.log("content:", content);
  console.log("mediaFiles received:", mediaFiles);
  console.log("mediaFiles length:", mediaFiles.length);
  mediaFiles.forEach((f, i) => {
    console.log(`  mediaFiles[${i}]:`, {
      name: f?.name,
      type: f?.type,
      size: f?.size,
      isFile: f instanceof File ? "✅ File" : "❌ NOT File — actual type: " + typeof f,
    });
  });

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
    console.groupEnd();
    return null;
  }
  console.log("[addThreadUpdate] thread_updates INSERT ok, update.id:", update.id);

  // 3. Increment new_updates_count on thread
  await supabase.from("recap_threads").select("new_updates_count").eq("id", threadId).single()
    .then(({ data: t }) => t && supabase.from("recap_threads")
      .update({ new_updates_count: (t.new_updates_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", threadId));

  // 4. Upload media
  const insertedMedia = [];
  for (const file of mediaFiles) {
    const isVideo = file.type?.startsWith("video/");
    const bucket = isVideo ? "videos" : "images";
    const path = storagePath(isVideo ? "updates/videos" : "updates/images", file.name);

    // ── LOG 4b: per-file upload attempt ───────────────────────────────────
    console.group(`[addThreadUpdate] uploading file: ${file.name}`);
    console.log("bucket:", bucket);
    console.log("path:", path);

    const url = await uploadFile(bucket, file, path);

    // ── LOG 4c: upload result ──────────────────────────────────────────────
    console.log("uploadFile result url:", url);
    if (!url) {
      console.error(`[addThreadUpdate] ❌ uploadFile returned null/undefined for ${file.name} — skipping update_media INSERT`);
      console.groupEnd();
      continue;
    }
    console.log("upload ✅ url:", url);

    // ── LOG 4d: update_media INSERT ────────────────────────────────────────
    const insertPayload = { update_id: update.id, type: isVideo ? "video" : "image", url, thumb_url: url, storage_path: path };
    console.log("update_media INSERT payload:", insertPayload);

    const { data: mRow, error: mErr } = await supabase.from("update_media")
      .insert(insertPayload)
      .select().single();

    if (mErr) {
      console.error("[addThreadUpdate] ❌ update_media INSERT error:", mErr.message, mErr);
    } else {
      console.log("[addThreadUpdate] ✅ update_media INSERT ok:", mRow);
      insertedMedia.push(mRow);
    }
    console.groupEnd();
  }

  // ── LOG 5: final return value ────────────────────────────────────────────
  const result = rowToUpdate(update, insertedMedia);
  console.log("[addThreadUpdate] insertedMedia:", insertedMedia);
  console.log("[addThreadUpdate] rowToUpdate result:", result);
  console.log("[addThreadUpdate] result.media:", result.media);
  if (result.media.length === 0 && mediaFiles.length > 0) {
    console.error("[addThreadUpdate] ❌ result.media is EMPTY despite receiving", mediaFiles.length, "file(s) — all uploads may have failed");
  }
  console.groupEnd();
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

/** Update thread status. */
export async function updateThreadStatus(threadId, status) {
  const { error } = await supabase.from("recap_threads").update({ status, updated_at: new Date().toISOString() }).eq("id", threadId);
  if (error) console.error("[recapsApi] updateThreadStatus:", error.message);
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
    const bucket = r.type === "video" ? "videos" : "images";
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
    await removeStorageObjects([...(media || []), ...updateMedia]);
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
 * Delete a thread. thread_media / thread_updates / update_media / comments /
 * likes all cascade automatically at the DB level (ON DELETE CASCADE on
 * thread_id — see supabase-schema.sql), so this one delete is enough to
 * leave zero orphan rows. Storage files are purged best-effort first.
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
