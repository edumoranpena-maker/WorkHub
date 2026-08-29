/**
 * checklistExecutionsApi.js
 *
 * Reads/writes `checklist_executions` + `checklist_execution_items` — see
 * supabase-migration-005-checklist-executions.sql for why these exist
 * separately from the checklist DEFINITION tables (`checklists`/
 * `checklist_items`, in lib/checklistsApi.js, untouched by this file).
 *
 * A checklist execution is "this checklist was used, for this symbol,
 * inside this Post" — Thread → Checklist tab creates and updates these;
 * Tools → Checklists → [checklist] reads them back out to populate its
 * own "POST" section. Neither side duplicates the checklist's own
 * definition (name/items) — always joined fresh from `checklists`/
 * `checklist_items`.
 */
import { supabase } from "./supabase.js";

function rowToExecution(row) {
  const items = (row.checklist_execution_items ?? [])
    .map(i => ({ id: i.checklist_item_id, checked: !!i.checked }));
  return {
    id: row.id,
    postId: row.post_id,
    checklistId: row.checklist_id,
    checklistName: row.checklists?.name ?? "Checklist",
    symbol: row.symbol,
    completed: !!row.completed,
    createdAt: row.created_at,
    items, // [{ id: checklist_item_id, checked }] — merged with the checklist's own item list (text/order) by the caller, this table only knows checked state
  };
}

/**
 * Every execution that belongs to ONE Post, each with its own checked
 * items — this is what the Thread's Checklist tab renders. Ordered oldest
 * first (the order they were added to this session), same convention as
 * fetchTradesForPost.
 */
export async function fetchExecutionsForPost(postId) {
  if (!postId) return [];
  const { data, error } = await supabase
    .from("checklist_executions")
    .select("*, checklists(name), checklist_execution_items(checklist_item_id, checked)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) { console.error("[checklistExecutionsApi] fetchExecutionsForPost:", error.message); return []; }
  return (data ?? []).map(rowToExecution);
}

/** Starts a new execution — no items marked yet (execution_items rows are
 *  created lazily, one at a time, as the user actually checks something —
 *  see toggleExecutionItem). Never creates a trade, never touches Doers. */
export async function createExecution(postId, checklistId, symbol) {
  if (!postId || !checklistId || !symbol) return null;
  const { data, error } = await supabase
    .from("checklist_executions")
    .insert({ post_id: postId, checklist_id: checklistId, symbol: symbol.trim() })
    .select("*, checklists(name), checklist_execution_items(checklist_item_id, checked)")
    .single();
  if (error) { console.error("[checklistExecutionsApi] createExecution:", error.message); return null; }
  return rowToExecution(data);
}

/** Checks/unchecks one item within one execution — upsert, so the first
 *  check on a given item creates its row, later toggles just flip it. */
export async function toggleExecutionItem(executionId, checklistItemId, checked) {
  const { error } = await supabase
    .from("checklist_execution_items")
    .upsert(
      { execution_id: executionId, checklist_item_id: checklistItemId, checked, checked_at: checked ? new Date().toISOString() : null },
      { onConflict: "execution_id,checklist_item_id" }
    );
  if (error) { console.error("[checklistExecutionsApi] toggleExecutionItem:", error.message); return false; }
  return true;
}

/** Persists the execution's own `completed` flag — recomputed and written
 *  by the caller after every toggle (checkedCount === total), not derived
 *  lazily on read, so Tools' Post list can filter/display without needing
 *  to join every item on every fetch. This alone NEVER creates a trade —
 *  it only marks the checklist itself as fully checked. */
export async function setExecutionCompleted(executionId, completed) {
  const { error } = await supabase
    .from("checklist_executions")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", executionId);
  if (error) { console.error("[checklistExecutionsApi] setExecutionCompleted:", error.message); return false; }
  return true;
}

/**
 * Every distinct Post that has at least one execution of ONE specific
 * checklist — this is Tools → Checklists → [checklist]'s "POST" section.
 * Real Posts (joined from recap_threads), never copies — the caller
 * navigates to the real Post via the app's own navigation, this just
 * supplies id/title/content/date to render the row.
 */
export async function fetchPostsForChecklist(checklistId) {
  if (!checklistId) return [];
  const { data, error } = await supabase
    .from("checklist_executions")
    .select("post_id, symbol, created_at, recap_threads(id, title, content, created_at)")
    .eq("checklist_id", checklistId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[checklistExecutionsApi] fetchPostsForChecklist:", error.message); return []; }

  // One row per distinct Post (a Post can have multiple executions of the
  // SAME checklist — e.g. two different symbols analyzed with it — those
  // collapse into one Post entry here, not duplicated rows).
  const seen = new Map();
  for (const row of data ?? []) {
    const post = row.recap_threads;
    if (!post || seen.has(post.id)) continue;
    seen.set(post.id, {
      id: post.id,
      title: post.title || post.content || "Post",
      date: post.created_at,
    });
  }
  return Array.from(seen.values());
}
