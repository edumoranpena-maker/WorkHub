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
import { tradeResult } from "./statsApi.js";

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

/**
 * The actual trades registered from ONE specific Post — this is the real
 * Post↔Trade relation the Thread's Stats tab uses (see Post.jsx's
 * ThreadStatsTab), not "the latest trades globally" and not a second,
 * separately-maintained relationship.
 *
 * Uses PostgREST's foreign-table embedding across the genuine FK
 * (post_trade_links.trade_id → trades.id, both tables in the same shared
 * Supabase project) to fetch post_trade_links joined with their trades in
 * one round trip, ordered by post_trade_links.created_at — the order each
 * trade was actually REGISTERED from this Post (Registrar → trade:saved),
 * which is the "session sequence" this tab wants, not PnL or alphabetical.
 *
 * Selects every real column the Thread Stats toggle needs to show (every
 * field of the trade model except pair/link, which the UI excludes on
 * purpose — see ThreadStatsTradeRow in Post.jsx) — not just the handful
 * the collapsed row itself needs, so the expanded detail never has to
 * re-fetch or guess at a field it doesn't have.
 *
 * Only ejecutado trades are included — same reasoning as
 * statsApi.js#fetchLatestTrades: an un-executed "setup seen" row has no
 * real Win/Loss/BE outcome, so it's filtered out rather than shown with a
 * misleading result. Because trade_id has `on delete cascade`, a trade
 * deleted in Doers Journal already has its link row removed by Postgres
 * itself — this never has to filter out a "ghost" deleted trade by hand.
 */
export async function fetchTradesForPost(postId) {
  if (!postId) return [];
  const { data, error } = await supabase
    .from("post_trade_links")
    .select(`created_at, trades(
      id, pair, rr, pnl, direction, date, hora, ejecutado,
      mercado, sesion, capital, setup, validez, confluencias, estado_mental, notas
    )`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) { console.error("[postTradeLinksApi] fetchTradesForPost:", error.message); return []; }
  return (data ?? [])
    .map(row => row.trades)
    .filter(t => t && t.ejecutado)
    .map(t => {
      const rr = Number(t.rr) || 0;
      const pnl = Number(t.pnl) || 0;
      return {
        id: t.id,
        pair: t.pair,
        rr,
        pnl,
        direction: t.direction === "short" || t.direction === "long" ? t.direction : null,
        date: t.date,
        hora: t.hora,
        ejecutado: t.ejecutado,
        mercado: t.mercado ?? null,
        sesion: t.sesion ?? null,
        capital: t.capital != null ? Number(t.capital) : null,
        setup: t.setup ?? null,
        validez: t.validez ?? null,
        confluencias: Array.isArray(t.confluencias) ? t.confluencias : [],
        estado_mental: t.estado_mental || null,
        notas: t.notas || null,
        result: tradeResult(rr),
      };
    });
}
