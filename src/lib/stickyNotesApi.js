/**
 * stickyNotesApi.js
 * Supabase data operations for the Sticky Notes Tool.
 *
 * Mirrors announcementsApi.js's conventions (a plain rowToNote() mapper, one
 * small function per operation, no shared state, no cache) — that file was
 * picked as the reference specifically because it's a small, stable,
 * currently-working CRUD API with no media/upload complexity to drag in.
 *
 * Deliberately does NOT reuse or depend on anything from checklistsApi.js —
 * Checklist has an open freeze bug under investigation, and Sticky Notes is
 * meant to stand entirely on its own regardless of what happens there.
 *
 * Sticky Notes is a standalone content library (title + content, table
 * `sticky_notes` — see supabase-migration-004-sticky-notes.sql). It does
 * not know about Profile, widgets, or any other consumer: Profile will
 * later store its own `sticky_note_id` reference and read a note by id
 * through fetchStickyNote() below, but none of that lives here — this file
 * only owns the notes themselves.
 */
import { supabase } from "./supabase.js";

function rowToNote(row) {
  return {
    id: row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    color: row.color || "yellow",
    author: row.author ?? "Me",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All notes in the library, most-recently-updated first. */
export async function fetchStickyNotes() {
  const { data, error } = await supabase
    .from("sticky_notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) { console.error("[stickyNotesApi] fetch:", error.message); return []; }
  return (data ?? []).map(rowToNote);
}

/**
 * A single note by id — this is the lookup a future Profile widget will use
 * to resolve its `sticky_note_id` reference into live title/content. Not
 * called anywhere yet in this pass (Profile isn't implemented), kept here
 * so that integration is a one-line call, not a new function later.
 */
export async function fetchStickyNote(id) {
  const { data, error } = await supabase
    .from("sticky_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[stickyNotesApi] fetchOne:", error.message); return null; }
  return data ? rowToNote(data) : null;
}

export async function createStickyNote({ title, content, color }) {
  const { data, error } = await supabase
    .from("sticky_notes")
    .insert({ title: title?.trim() || "Sin título", content: content ?? "", color: color || "yellow" })
    .select().single();
  if (error) { console.error("[stickyNotesApi] create:", error.message); return null; }
  return rowToNote(data);
}

/**
 * Partial update — only the keys actually present in `patch` are written.
 * This is what the inline-editing autosave in StickyNoteExpanded.jsx relies
 * on: a debounced text edit sends {title} or {content} without touching
 * color, and an immediate color change from the ⋮ menu sends {color}
 * without touching whatever the user is mid-typing. The old whole-object
 * update (always overwriting title AND content together) is gone since
 * there's no longer a separate composer that submits both at once.
 */
export async function updateStickyNote(id, patch) {
  const payload = { updated_at: new Date().toISOString() };
  if ("title" in patch) payload.title = patch.title?.trim() || "Sin título";
  if ("content" in patch) payload.content = patch.content ?? "";
  if ("color" in patch) payload.color = patch.color || "yellow";
  const { data, error } = await supabase
    .from("sticky_notes")
    .update(payload)
    .eq("id", id)
    .select().single();
  if (error) { console.error("[stickyNotesApi] update:", error.message); return null; }
  return rowToNote(data);
}

export async function deleteStickyNote(id) {
  const { error } = await supabase.from("sticky_notes").delete().eq("id", id);
  if (error) console.error("[stickyNotesApi] delete:", error.message);
  return !error;
}
