/**
 * checklistsApi.js
 * All Supabase data operations for the Checklist Tool.
 *
 * Mirrors recapsApi.js's conventions (rowTo* mappers, uploadFile/storagePath
 * for media, the same Storage buckets — 'images'/'videos', nothing new).
 *
 * Deliberately does NOT touch Posts/Threads/Doers/AI — this phase is the
 * Checklist Tool standing entirely on its own. Deliberately does NOT persist
 * execution progress anywhere (no `checked` column on checklist_items, no
 * progress table) — a checklist here is a reusable TEMPLATE; progress is a
 * future, separate entity (see the migration file's header comment).
 *
 * Persistence model for edits (see ChecklistEditor.jsx for the UI side of
 * this split):
 *   - Structural changes to an EXISTING checklist (add/edit/delete/reorder a
 *     step, add/remove media) are immediate, one Supabase call per action —
 *     simpler and more robust than a full local/remote diff-and-reconcile,
 *     and matches the CRUD list being individually actionable operations.
 *   - The checklist's own text fields (name/description/completion message)
 *     are batched into one updateChecklist() call from an explicit "Guardar"
 *     button, same as updateRecapThread's plain field-only update.
 *   - Creating a brand new checklist is fully staged client-side (exactly
 *     like PostComposer) and only touches Supabase once, via
 *     createChecklist(), which uploads everything in the right order (row →
 *     items → media, since media needs real item ids to attach to).
 */
import { supabase, uploadFile, storagePath, deleteFile, deleteFiles } from "./supabase.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Media for this tool is image/video only (per spec — no generic files),
// same shape convention as recapsApi.js's classifyMedia but narrower.
function classifyMedia(item) {
  const file = item?.file ?? item;
  if (!file) return null;
  let kind = item?.type;
  if (kind !== "image" && kind !== "video") {
    kind = file.type?.startsWith("video/") ? "video" : "image";
  }
  const bucket = kind === "video" ? "videos" : "images";
  return { file, kind, bucket };
}

export function rowToMedia(row) {
  return { id: row.id, type: row.type, url: row.url, storagePath: row.storage_path, name: row.file_name };
}

function rowToItem(row, media = []) {
  return {
    id: row.id,
    label: row.label,
    position: row.position,
    media: media.map(rowToMedia),
  };
}

function rowToChecklist(row, items = [], media = [], itemCount = null) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    completionMessage: row.completion_message || "",
    media: media.map(rowToMedia),
    items: items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(it => rowToItem(it, (it.checklist_item_media || []))),
    // Only populated by fetchChecklists() (the library list), which asks
    // Supabase for a count instead of the full items array — cheaper for a
    // screen that only needs to show "N pasos" on a card.
    itemCount: itemCount ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function uploadMediaFor(table, foreignKey, foreignId, folder, mediaFiles) {
  const inserted = [];
  for (const item of mediaFiles) {
    const classified = classifyMedia(item);
    if (!classified) continue;
    const { file, kind, bucket } = classified;
    const path = storagePath(`${folder}/${kind === "video" ? "videos" : "images"}`, file.name);
    const url = await uploadFile(bucket, file, path);
    if (!url) continue;
    const { data: mRow, error } = await supabase.from(table)
      .insert({ [foreignKey]: foreignId, type: kind, url, storage_path: path, file_name: file.name })
      .select().single();
    if (error) { console.error(`[checklistsApi] uploadMediaFor(${table}):`, error.message); continue; }
    if (mRow) inserted.push(mRow);
  }
  return inserted;
}

// ─── Library (list) ──────────────────────────────────────────────────────────

/**
 * All checklists for the library screen — name/description/item count only
 * (no items, no media; fetchChecklistById gets the full thing when a card is
 * opened). `checklist_items(count)` is a Supabase embedded-resource count,
 * one query instead of N.
 */
export async function fetchChecklists(userId = "anonymous") {
  const { data, error } = await supabase
    .from("checklists")
    .select("*, checklist_items(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) { console.error("[checklistsApi] fetchChecklists:", error.message); return []; }
  return (data || []).map(row => rowToChecklist(row, [], [], row.checklist_items?.[0]?.count ?? 0));
}

/** Full checklist — items (ordered) + each item's media + the checklist's
 *  own general media. Three queries (checklist, items, item_media) instead
 *  of a single deep-nested select — keeps each query simple and matches how
 *  fetchThread already reads Post.jsx's thread data. */
export async function fetchChecklistById(id) {
  const { data: row, error } = await supabase.from("checklists").select("*").eq("id", id).single();
  if (error) { console.error("[checklistsApi] fetchChecklistById:", error.message); return null; }

  const [{ data: items }, { data: media }] = await Promise.all([
    supabase.from("checklist_items").select("*").eq("checklist_id", id).order("position", { ascending: true }),
    supabase.from("checklist_media").select("*").eq("checklist_id", id).order("created_at", { ascending: true }),
  ]);

  const itemIds = (items || []).map(it => it.id);
  let itemMediaByItem = {};
  if (itemIds.length > 0) {
    const { data: itemMedia } = await supabase.from("checklist_item_media").select("*").in("item_id", itemIds);
    itemMediaByItem = (itemMedia || []).reduce((acc, m) => {
      (acc[m.item_id] ??= []).push(m);
      return acc;
    }, {});
  }
  const itemsWithMedia = (items || []).map(it => ({ ...it, checklist_item_media: itemMediaByItem[it.id] || [] }));

  return rowToChecklist(row, itemsWithMedia, media || []);
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a checklist from a fully-staged local draft — mirrors
 * insertThreadRow's shape: row → items (need real ids before their media can
 * attach) → general media → per-item media.
 *
 * draft.items: [{ label, mediaFiles: [...] }] — in the order they should be
 *   saved; `position` is assigned here from that order.
 * draft.mediaFiles: general (checklist-level) media to upload.
 */
export async function createChecklist(draft, userId = "anonymous") {
  const { data: checklist, error } = await supabase
    .from("checklists")
    .insert({
      user_id: userId,
      name: draft.name,
      description: draft.description || null,
      completion_message: draft.completionMessage || null,
    })
    .select().single();

  if (error) { console.error("[checklistsApi] createChecklist:", error.message); return null; }

  const insertedItems = [];
  for (let i = 0; i < (draft.items || []).length; i++) {
    const step = draft.items[i];
    const { data: itemRow, error: itemError } = await supabase
      .from("checklist_items")
      .insert({ checklist_id: checklist.id, label: step.label, position: i })
      .select().single();
    if (itemError) { console.error("[checklistsApi] createChecklist (item):", itemError.message); continue; }

    let itemMedia = [];
    if (step.mediaFiles?.length) {
      itemMedia = await uploadMediaFor("checklist_item_media", "item_id", itemRow.id, "checklists/items", step.mediaFiles);
    }
    insertedItems.push({ ...itemRow, checklist_item_media: itemMedia });
  }

  let media = [];
  if (draft.mediaFiles?.length) {
    media = await uploadMediaFor("checklist_media", "checklist_id", checklist.id, "checklists/general", draft.mediaFiles);
  }

  return rowToChecklist(checklist, insertedItems, media);
}

// ─── Update — checklist's own fields only (name/description/message) ────────
export async function updateChecklist(id, { name, description, completionMessage }) {
  const { error } = await supabase
    .from("checklists")
    .update({ name, description: description || null, completion_message: completionMessage || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[checklistsApi] updateChecklist:", error.message);
  return !error;
}

export async function deleteChecklist(id) {
  await purgeChecklistStorage(id);
  const { error } = await supabase.from("checklists").delete().eq("id", id);
  if (error) console.error("[checklistsApi] deleteChecklist:", error.message);
  return !error;
}

// ─── Steps (checklist_items) — immediate, one call per action ───────────────

/** Adds a step at the end (position = current item count). Returns the new
 *  item (no media yet — attach separately via addItemMedia). */
export async function addChecklistItem(checklistId, label) {
  const { count } = await supabase
    .from("checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("checklist_id", checklistId);

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({ checklist_id: checklistId, label, position: count ?? 0 })
    .select().single();

  if (error) { console.error("[checklistsApi] addChecklistItem:", error.message); return null; }
  return rowToItem(data, []);
}

export async function updateChecklistItemLabel(itemId, label) {
  const { error } = await supabase.from("checklist_items")
    .update({ label, updated_at: new Date().toISOString() }).eq("id", itemId);
  if (error) console.error("[checklistsApi] updateChecklistItemLabel:", error.message);
  return !error;
}

/** Deletes a step. checklist_item_media rows cascade at the DB level;
 *  Storage files are purged best-effort first. */
export async function deleteChecklistItem(itemId) {
  await purgeItemStorage(itemId);
  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (error) console.error("[checklistsApi] deleteChecklistItem:", error.message);
  return !error;
}

/** Persists a full reorder — orderedItemIds is the new top-to-bottom order.
 *  One update per item (position = its new index); Postgres has no native
 *  "bulk reorder" primitive worth reaching for here given a checklist is
 *  realistically a handful of steps, not hundreds. */
export async function reorderChecklistItems(orderedItemIds) {
  const results = await Promise.all(
    orderedItemIds.map((itemId, index) =>
      supabase.from("checklist_items").update({ position: index }).eq("id", itemId)
    )
  );
  const failed = results.find(r => r.error);
  if (failed) console.error("[checklistsApi] reorderChecklistItems:", failed.error.message);
  return !failed;
}

// ─── Media — immediate, one call per action ──────────────────────────────────

export async function addChecklistMedia(checklistId, mediaFiles) {
  return uploadMediaFor("checklist_media", "checklist_id", checklistId, "checklists/general", mediaFiles);
}

export async function removeChecklistMedia(mediaId) {
  const { data: row } = await supabase.from("checklist_media").select("type, storage_path").eq("id", mediaId).single();
  if (row?.storage_path) await deleteFile(row.type === "video" ? "videos" : "images", row.storage_path);
  const { error } = await supabase.from("checklist_media").delete().eq("id", mediaId);
  if (error) console.error("[checklistsApi] removeChecklistMedia:", error.message);
  return !error;
}

export async function addChecklistItemMedia(itemId, mediaFiles) {
  return uploadMediaFor("checklist_item_media", "item_id", itemId, "checklists/items", mediaFiles);
}

export async function removeChecklistItemMedia(mediaId) {
  const { data: row } = await supabase.from("checklist_item_media").select("type, storage_path").eq("id", mediaId).single();
  if (row?.storage_path) await deleteFile(row.type === "video" ? "videos" : "images", row.storage_path);
  const { error } = await supabase.from("checklist_item_media").delete().eq("id", mediaId);
  if (error) console.error("[checklistsApi] removeChecklistItemMedia:", error.message);
  return !error;
}

// ─── Storage cleanup on delete ───────────────────────────────────────────────
// Same "best-effort, purge Storage files before letting DB cascade handle the
// rows" pattern as recapsApi.js's purgeThreadStorage.
async function purgeItemStorage(itemId) {
  const { data: rows } = await supabase.from("checklist_item_media").select("type, storage_path").eq("item_id", itemId);
  if (!rows?.length) return;
  const byBucket = {};
  for (const r of rows) {
    if (!r.storage_path) continue;
    const bucket = r.type === "video" ? "videos" : "images";
    (byBucket[bucket] ??= []).push(r.storage_path);
  }
  await Promise.all(Object.entries(byBucket).map(([bucket, paths]) => deleteFiles(bucket, paths)));
}

async function purgeChecklistStorage(checklistId) {
  const [{ data: generalMedia }, { data: items }] = await Promise.all([
    supabase.from("checklist_media").select("type, storage_path").eq("checklist_id", checklistId),
    supabase.from("checklist_items").select("id").eq("checklist_id", checklistId),
  ]);

  const byBucket = {};
  for (const r of generalMedia || []) {
    if (!r.storage_path) continue;
    const bucket = r.type === "video" ? "videos" : "images";
    (byBucket[bucket] ??= []).push(r.storage_path);
  }
  if (Object.keys(byBucket).length) {
    await Promise.all(Object.entries(byBucket).map(([bucket, paths]) => deleteFiles(bucket, paths)));
  }

  // Item media cascades at the DB level when checklist_items are deleted
  // (which happens automatically via ON DELETE CASCADE from checklists),
  // but Storage files need their own explicit cleanup first, same reasoning
  // as the general media above.
  await Promise.all((items || []).map(it => purgeItemStorage(it.id)));
}
