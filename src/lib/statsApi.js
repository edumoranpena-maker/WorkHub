/**
 * statsApi.js
 *
 * PlanSpace's read access to Doers Journal's All-Time trading stats.
 *
 * Reads directly from `v_alltime_stats` — a view created during the Doers
 * Journal → PlanSpace Supabase migration, living in the same project PlanSpace
 * already talks to. No iframe, no postMessage, no second copy of the
 * Dashboard mounted just to read numbers: this is a normal Supabase read,
 * through this file, following the exact same pattern as recapsApi.js /
 * announcementsApi.js — supabase.js is the only place that touches the
 * client directly, every other file (this one included) goes through a
 * `*Api.js` layer like this one. Components never import supabase.js.
 *
 * Both PlanSpace and Doers Journal share the same Postgres calculation for
 * these numbers (the view's SQL mirrors Doers Journal's own calcStats("all-
 * time") logic) — nobody recomputes anything client-side, so there's exactly
 * one source of truth for what "All-Time winrate" means.
 */
import { supabase } from "./supabase.js";

// Single-user today — both PlanSpace and Doers Journal run without real auth,
// so every row in v_alltime_stats (and every trading_* table) carries
// user_id = 'anonymous' (the column's default from the migration schema).
// This constant is the one place that assumption lives; the day real auth
// exists, swap it for the logged-in user's id and nothing else here changes.
const ALLTIME_USER_ID = "anonymous";

function rowToAllTimeStats(row) {
  return {
    winrate: Number(row.win_rate) || 0,
    expectancy: Number(row.expectancy) || 0,
    totalTrades: Number(row.total_trades) || 0,
    profit: Number(row.total_pnl) || 0,
  };
}

/**
 * Fetches the All-Time summary (Winrate, Expectancy, Total Trades, Profit)
 * from v_alltime_stats.
 *
 * Returns null when there's nothing to show yet (no trades logged — the view
 * simply has no row for this user, which isn't an error) or when the request
 * fails. Stats.jsx treats null as "not loaded" and renders "—" placeholders,
 * same as it already did before this existed.
 */
export async function fetchAllTimeStats() {
  const { data, error } = await supabase
    .from("v_alltime_stats")
    .select("*")
    .eq("user_id", ALLTIME_USER_ID)
    .maybeSingle();

  if (error) { console.error("[statsApi] fetchAllTimeStats:", error.message); return null; }
  if (!data) return null;

  return rowToAllTimeStats(data);
}

/**
 * Win/Loss/BE for a single trade — the exact same rule Doers Journal's own
 * `monthly_summary` SQL view uses (see supabase-schema.sql there: `wins`
 * filters `rr > 0`, `losses` filters `rr < 0`, `bes` filters `rr = 0`, all
 * gated on `ejecutado`). Not a second, parallel classification — this is
 * that same comparison, just evaluated client-side per row instead of
 * aggregated in SQL, because the Latest Trades card needs the individual
 * outcome per row, not just a count.
 */
function tradeResult(rr) {
  if (rr > 0) return "win";
  if (rr < 0) return "loss";
  return "be";
}

function rowToTradeSummary(row) {
  const rr = Number(row.rr) || 0;
  return {
    id: row.id,
    pair: row.pair,
    rr,
    pnl: Number(row.pnl) || 0,
    date: row.date,
    hora: row.hora,
    result: tradeResult(rr),
  };
}

/**
 * The most recent `limit` EXECUTED trades (raw rows from `trades` — this is
 * per-row data, so it reads the base table directly rather than
 * `v_alltime_stats`, which is an aggregate view with no per-trade rows).
 * `.eq("ejecutado", true)` at the query level: an un-executed "setup seen"
 * row has no real Win/Loss/BE outcome (its rr is just the column default),
 * so it's excluded rather than misleadingly shown as a BE.
 *
 * Ordered by the trade's own date/hora (real fields on the row) — not
 * created_at, and not assumed to already be sorted by the query engine.
 * `trades` has no user_id column (unlike v_alltime_stats, which is a view
 * that adds one) — single-user today, so no filter needed there.
 */
export async function fetchLatestTrades(limit = 5) {
  const { data, error } = await supabase
    .from("trades")
    .select("id, pair, rr, pnl, date, hora, ejecutado")
    .eq("ejecutado", true)
    .order("date", { ascending: false })
    .order("hora", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) { console.error("[statsApi] fetchLatestTrades:", error.message); return []; }
  return (data ?? []).map(rowToTradeSummary);
}
