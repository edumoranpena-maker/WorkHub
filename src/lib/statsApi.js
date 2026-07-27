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
