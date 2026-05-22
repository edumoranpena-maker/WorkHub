/**
 * announcementsApi.js
 * Supabase data operations for the Announcements section.
 */

import { supabase } from "./supabase.js";

function rowToPost(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tag: row.tag ?? "Official",
    pinned: row.pinned ?? false,
    author: row.author,
    authorRole: row.author_role,
    likes: row.likes_count ?? 0,
    liked: false,
    commentCount: row.comment_count ?? 0,
    timestamp: row.created_at,
  };
}

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) { console.error("[announcementsApi] fetch:", error.message); return []; }
  return (data ?? []).map(rowToPost);
}

export async function createAnnouncement({ title, content, tag = "Official" }, author = "Admin") {
  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, content, tag, author, author_role: "admin" })
    .select().single();
  if (error) { console.error("[announcementsApi] create:", error.message); return null; }
  return rowToPost(data);
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) console.error("[announcementsApi] delete:", error.message);
  return !error;
}

export async function toggleAnnouncementLike(id, userId = "anonymous") {
  const { data: existing } = await supabase.from("likes").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
    await supabase.from("announcements").select("likes_count").eq("id", id).single()
      .then(({ data }) => data && supabase.from("announcements").update({ likes_count: Math.max(0, (data.likes_count ?? 1) - 1) }).eq("id", id));
    return false;
  } else {
    await supabase.from("likes").insert({ post_id: id, user_id: userId });
    await supabase.from("announcements").select("likes_count").eq("id", id).single()
      .then(({ data }) => data && supabase.from("announcements").update({ likes_count: (data.likes_count ?? 0) + 1 }).eq("id", id));
    return true;
  }
}
