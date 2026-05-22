/**
 * planningApi.js
 * All Supabase data operations for the Planning section.
 * Falls back gracefully on error so the UI never hard-crashes.
 */

import { supabase, uploadFile, storagePath, deleteFile } from "./supabase.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Supabase row → the shape the Planning UI expects */
function rowToPost(row, media = []) {
  return {
    id: row.id,
    title: row.title ?? null,
    content: row.content,
    hashtags: row.hashtags ?? [],
    media: media.map(m => ({ type: m.type, url: m.url, thumb: m.thumb_url ?? m.url, storagePath: m.storage_path })),
    visibility: row.visibility,
    status: row.status,
    pinned: row.pinned,
    likes: row.likes_count,
    liked: false,          // resolved client-side per user
    commentCount: row.comment_count,
    author: row.author,
    authorRole: row.author_role,
    timestamp: row.created_at,
    audio: row.audio_url
      ? { url: row.audio_url, duration: row.audio_duration ?? 0, waveform: row.audio_waveform ?? [] }
      : null,
    floatingRR: row.floating_rr ?? null,
    realizedRR: row.realized_rr ?? null,
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all planning posts (newest first) with their media.
 * Returns [] on error.
 */
export async function fetchPlanningPosts() {
  const { data: posts, error } = await supabase
    .from("planning_posts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[planningApi] fetchPlanningPosts:", error.message);
    return [];
  }
  if (!posts.length) return [];

  // Fetch associated media in one query
  const postIds = posts.map(p => p.id);
  const { data: allMedia } = await supabase
    .from("post_media")
    .select("*")
    .in("post_id", postIds);

  const mediaByPost = {};
  (allMedia ?? []).forEach(m => {
    if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
    mediaByPost[m.post_id].push(m);
  });

  return posts.map(p => rowToPost(p, mediaByPost[p.id] ?? []));
}

/**
 * Fetch comments for a planning post. Returns [].
 */
export async function fetchPostComments(postId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) { console.error("[planningApi] fetchPostComments:", error.message); return []; }
  return (data ?? []).map(c => ({
    id: c.id,
    author: c.author,
    avatar: c.avatar ?? c.author?.[0]?.toUpperCase() ?? "?",
    text: c.text,
    likes: c.likes_count,
    liked: false,
    time: c.created_at,
  }));
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Create a new planning post, uploading audio & media files first.
 *
 * @param {{ title, content, privacy, audio, mediaFiles }} payload
 * @param {string} author
 * @returns {object|null} The created post in UI shape, or null on failure.
 */
export async function createPlanningPost({ title, content, privacy, audio, mediaFiles = [] }, author = "Alex H.") {
  // 1. Upload audio recording if present
  let audioUrl = null, audioDuration = 0, audioWaveform = [];
  if (audio?.blob) {
    const path = storagePath("posts", "recording.webm");
    audioUrl = await uploadFile("audio", audio.blob, path);
    audioDuration = audio.duration ?? 0;
    audioWaveform = audio.waveform ?? [];
  } else if (audio?.url && !audio.url.startsWith("blob:")) {
    // Persistent URL already — keep as-is (e.g. previously uploaded)
    audioUrl = audio.url;
    audioDuration = audio.duration ?? 0;
    audioWaveform = audio.waveform ?? [];
  }

  // 2. Insert the post row
  const { data: post, error } = await supabase
    .from("planning_posts")
    .insert({
      title: title || null,
      content,
      visibility: privacy ?? "members",
      status: "active",
      author,
      audio_url: audioUrl,
      audio_duration: audioDuration || null,
      audio_waveform: audioWaveform.length ? audioWaveform : null,
    })
    .select()
    .single();

  if (error) { console.error("[planningApi] createPlanningPost:", error.message); return null; }

  // 3. Upload media files and insert rows
  const insertedMedia = [];
  for (const file of mediaFiles) {
    const isVideo = file.type?.startsWith("video/");
    const bucket = isVideo ? "videos" : "images";
    const path = storagePath(isVideo ? "posts/videos" : "posts/images", file.name);
    const url = await uploadFile(bucket, file, path);
    if (!url) continue;

    const { data: mRow } = await supabase
      .from("post_media")
      .insert({ post_id: post.id, type: isVideo ? "video" : "image", url, thumb_url: url, storage_path: path })
      .select()
      .single();

    if (mRow) insertedMedia.push(mRow);
  }

  return rowToPost(post, insertedMedia);
}

/**
 * Update the status of a planning post.
 */
export async function updatePostStatus(postId, status) {
  const { error } = await supabase
    .from("planning_posts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) console.error("[planningApi] updatePostStatus:", error.message);
  return !error;
}

/**
 * Delete a planning post (cascade deletes media & comments).
 */
export async function deletePlanningPost(postId) {
  // Fetch media paths first so we can clean up storage
  const { data: media } = await supabase.from("post_media").select("storage_path, type").eq("post_id", postId);
  for (const m of media ?? []) {
    if (m.storage_path) {
      const bucket = m.type === "video" ? "videos" : "images";
      await deleteFile(bucket, m.storage_path);
    }
  }

  // Fetch audio path
  const { data: post } = await supabase.from("planning_posts").select("audio_url").eq("id", postId).single();
  if (post?.audio_url) {
    // Best effort: extract path from URL
    try {
      const url = new URL(post.audio_url);
      const parts = url.pathname.split("/audio/");
      if (parts[1]) await deleteFile("audio", parts[1]);
    } catch {}
  }

  const { error } = await supabase.from("planning_posts").delete().eq("id", postId);
  if (error) console.error("[planningApi] deletePlanningPost:", error.message);
  return !error;
}

/**
 * Toggle like on a post. Returns new liked state.
 */
export async function togglePostLike(postId, userId = "anonymous") {
  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
    await supabase.from("planning_posts").update({ likes_count: supabase.rpc ? undefined : 0 }).eq("id", postId);
    // Decrement
    await supabase.rpc("decrement_post_likes", { pid: postId }).catch(() =>
      supabase.from("planning_posts").select("likes_count").eq("id", postId).single()
        .then(({ data }) => data && supabase.from("planning_posts").update({ likes_count: Math.max(0, (data.likes_count ?? 1) - 1) }).eq("id", postId))
    );
    return false;
  } else {
    await supabase.from("likes").insert({ post_id: postId, user_id: userId });
    await supabase.from("planning_posts").select("likes_count").eq("id", postId).single()
      .then(({ data }) => data && supabase.from("planning_posts").update({ likes_count: (data.likes_count ?? 0) + 1 }).eq("id", postId));
    return true;
  }
}

/**
 * Add a comment to a planning post.
 */
export async function addPostComment(postId, { author, text }) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author, avatar: author?.[0]?.toUpperCase(), text })
    .select()
    .single();

  if (error) { console.error("[planningApi] addPostComment:", error.message); return null; }

  // Increment comment count
  await supabase.from("planning_posts").select("comment_count").eq("id", postId).single()
    .then(({ data: p }) => p && supabase.from("planning_posts").update({ comment_count: (p.comment_count ?? 0) + 1 }).eq("id", postId));

  return { id: data.id, author: data.author, avatar: data.avatar, text: data.text, likes: 0, liked: false, time: data.created_at };
}

/**
 * Update floating / realized RR and save a snapshot.
 */
export async function updatePostRR(postId, { floatingRR, realizedRR }) {
  await supabase.from("planning_posts").update({ floating_rr: floatingRR ?? null, realized_rr: realizedRR ?? null, updated_at: new Date().toISOString() }).eq("id", postId);
  await supabase.from("rr_snapshots").insert({ post_id: postId, floating_rr: floatingRR ?? 0, realized_rr: realizedRR ?? null });
}
