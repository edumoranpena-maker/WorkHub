/**
 * postTradeLinksApi.js
 *
 * Reads/writes `post_trade_links` — see
 * supabase-migration-004-post-trade-links.sql for why this table exists at
 * all (short version: Doers Journal's own `trades` table has no reference
 * back to xPlannation, and trade:saved is a one-time session event, not
 * persisted anywhere on its own — without this table "Registrar (N)" would
 * reset to 0 on every reload).
 *
 * Same one-file-per-table convention as recapsApi.js/announcementsApi.js —
 * components never import supabase.js directly.
 */
import { supabase } from "./supabase.js";

/**
 * Batch trade-count lookup for every postId in the list — one query for
 * the whole feed/thread list, not one query per PostCard. Returns
 * { [postId]: count }; a postId with zero trades simply doesn't appear as
 * a key (callers should treat a missing key as 0, e.g. `counts[id] || 0`).
 */
export async function fetchTradeCounts(postIds) {
  const ids = (postIds ?? []).filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("post_trade_links")
    .select("post_id")
    .in("post_id", ids);
  if (error) { console.error("[postTradeLinksApi] fetchTradeCounts:", error.message); return {}; }
  const counts = {};
  for (const row of data ?? []) counts[row.post_id] = (counts[row.post_id] || 0) + 1;
  return counts;
}

/**
 * Records that `tradeId` (the id Doers Journal just returned in trade:saved)
 * belongs to `postId`. Called exactly once per successful trade:saved, from
 * Stats.jsx's DashboardOverlay. A duplicate call for the same tradeId (e.g.
 * a stray repeated message) is rejected by the table's own unique index on
 * trade_id rather than silently double-counting — that failure is expected
 * and logged, not surfaced to the user.
 */
export async function linkTradeToPost(postId, tradeId) {
  if (!postId || !tradeId) return false;
  const { error } = await supabase
    .from("post_trade_links")
    .insert({ post_id: postId, trade_id: tradeId });
  if (error) { console.error("[postTradeLinksApi] linkTradeToPost:", error.message); return false; }
  return true;
}
