/**
 * doersJournalBridge.js
 *
 * postMessage protocol between PlanSpace (parent window) and Doers Journal
 * (the iframe embedded in Stats' fullscreen Dashboard portal).
 *
 * Design goals:
 *   - One namespaced envelope for every message, both directions, so this
 *     channel can carry more than stats later (opening "Nuevo Trade", pushing
 *     a profile metric update, etc.) without inventing a new mechanism.
 *   - Every message is versioned (`v`) so either side can evolve the payload
 *     shape without silently breaking the other.
 *   - Origin-checked in both directions: PlanSpace only ever posts to
 *     DOERS_JOURNAL_ORIGIN (never "*"), and only ever accepts inbound
 *     messages whose event.origin matches it.
 *   - Payloads are validated defensively (parseAllTimeStatsPayload) — a
 *     malformed/partial message from Doers Journal is dropped rather than
 *     rendering NaN/undefined into a card.
 *
 * ── Message types (CHANNEL) ──────────────────────────────────────────────
 *   PlanSpace → Doers Journal
 *     "planspace:ready"     — sent once the iframe has loaded, so Doers
 *                              Journal knows the parent is listening.
 *     "stats:request"       — asks for a stats snapshot. { scope: "all-time" }
 *                              for now; scope is forward-compatible with
 *                              "1m" | "3m" | "ytd" etc. if PlanSpace ever
 *                              needs a non-all-time summary.
 *
 *   Doers Journal → PlanSpace
 *     "stats:all-time"      — the All-Time summary, sent in response to
 *                              "stats:request" (or pushed proactively any
 *                              time the underlying data changes — e.g. right
 *                              after the user logs a trade). Always the
 *                              All-Time totals, regardless of whatever
 *                              timeframe (1M/3M/YTD/...) is selected inside
 *                              the Dashboard's own UI.
 *
 * ── Reserved for later (not sent/handled yet, listed so the shape of the
 *    channel doesn't need to change when we get to them) ──────────────────
 *     "profile:metric-update" — Doers Journal → PlanSpace, pushes a single
 *                              updated metric for the profile header.
 *
 * ── Trade bridge ─────────────────────────────────────────────────────────
 * "trade:open-form" / "trade:saved" are NOT part of this channel — they're
 * a separate, independently-versioned envelope (TRADE_BRIDGE_CHANNEL) below,
 * since Doers Journal was already built against that exact contract on its
 * own side. See that section further down for the full message catalogue.
 */

export const DOERS_JOURNAL_URL    = "https://doers-journal.vercel.app/";
export const DOERS_JOURNAL_ORIGIN = new URL(DOERS_JOURNAL_URL).origin;

// Namespaces every envelope on this channel so PlanSpace can tell it apart
// from any other postMessage traffic in the page (browser extensions,
// analytics scripts, etc. all use postMessage too).
export const BRIDGE_CHANNEL = "planspace<->doers-journal";
export const BRIDGE_VERSION = 1;

export const MSG = {
  READY:          "planspace:ready",
  STATS_REQUEST:  "stats:request",
  STATS_ALL_TIME: "stats:all-time",
};

/**
 * Builds a channel envelope and posts it to the given window (typically an
 * iframe's contentWindow). targetOrigin is always DOERS_JOURNAL_ORIGIN,
 * never "*" — this only ever talks to Doers Journal.
 */
export function postToDoersJournal(targetWindow, type, payload) {
  if (!targetWindow) return;
  targetWindow.postMessage(
    { channel: BRIDGE_CHANNEL, v: BRIDGE_VERSION, type, payload: payload ?? null },
    DOERS_JOURNAL_ORIGIN
  );
}

/**
 * Validates an inbound MessageEvent against origin + envelope shape.
 * Returns the envelope's { type, payload } if valid, otherwise null.
 * Callers should still switch on `type` and ignore types they don't handle
 * (forward-compatible with message types this build doesn't know about yet).
 */
export function readBridgeMessage(event, expectedSourceWindow) {
  if (event.origin !== DOERS_JOURNAL_ORIGIN) return null;
  if (expectedSourceWindow && event.source !== expectedSourceWindow) return null;
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  if (data.channel !== BRIDGE_CHANNEL) return null;
  if (data.v !== BRIDGE_VERSION) return null; // bump BRIDGE_VERSION + handle migration if this ever needs to change
  if (typeof data.type !== "string") return null;
  return { type: data.type, payload: data.payload ?? null };
}

/**
 * Defensively parses a "stats:all-time" payload. Returns a normalized
 * { winrate, expectancy, totalTrades, profit } (all numbers) or null if the
 * payload is missing/malformed — callers should treat null as "ignore this
 * message" rather than rendering partial/NaN data into a card.
 *
 * Expected raw shape from Doers Journal:
 *   { winrate: number (0-100), expectancy: number (R per trade),
 *     totalTrades: number, profit: number (total realized R) }
 */
export function parseAllTimeStatsPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const { winrate, expectancy, totalTrades, profit } = payload;
  const nums = { winrate, expectancy, totalTrades, profit };
  for (const key in nums) {
    if (typeof nums[key] !== "number" || Number.isNaN(nums[key])) return null;
  }
  return { winrate, expectancy, totalTrades, profit };
}

/**
 * ── Trade bridge (Registrar → Doers → trade:saved) ─────────────────────────
 *
 * A SEPARATE envelope from the Stats channel above — different `channel`
 * string, different version counter, different shape (`context`/`trade`
 * instead of `payload`). Doers Journal was already built to this exact
 * contract on its own side, so this mirrors it rather than reusing
 * BRIDGE_CHANNEL/BRIDGE_VERSION. The two channels are independent and must
 * both keep working: readBridgeMessage() only ever matches BRIDGE_CHANNEL,
 * readTradeBridgeMessage() only ever matches TRADE_BRIDGE_CHANNEL — a
 * message on one channel is simply ignored (returns null) by the other's
 * reader, so nothing here can cross-contaminate the Stats integration.
 *
 * Still the same DOERS_JOURNAL_ORIGIN (same iframe, same site) for every
 * origin check and every postMessage target — never "*".
 *
 * ── Message types ─────────────────────────────────────────────────────────
 *   PlanSpace → Doers Journal
 *     "trade:open-form" — { context: { source: "post", postId, postUrl? } |
 *                                     { source: "subtema", postId, subtemaId } }
 *                          Opens "Nuevo Trade" directly, pre-loaded with
 *                          where the user should return to. `postUrl`
 *                          (optional, Post only) is a full URL from
 *                          lib/internalUrls.js — Doers Journal uses it only
 *                          to pre-fill the Link field, never required by
 *                          isValidTradeContext below since its absence
 *                          shouldn't block opening the form.
 *
 *   Doers Journal → PlanSpace
 *     "trade:saved"     — { context: <the same context sent above>,
 *                            trade: { id } }
 *                          Sent only after a successful Supabase insert —
 *                          never on a failed save (Doers Journal keeps its
 *                          form open in that case and simply doesn't send
 *                          anything).
 */
export const TRADE_BRIDGE_CHANNEL = "xplannation-doers-bridge";
export const TRADE_BRIDGE_VERSION = 1;

export const TRADE_MSG = {
  OPEN_FORM: "trade:open-form",
  SAVED:     "trade:saved",
};

/** True for a well-formed { source: "post", postId } or
 *  { source: "subtema", postId, subtemaId } context — the same minimal
 *  shape Doers Journal itself validates on its side. */
export function isValidTradeContext(context) {
  if (!context || typeof context !== "object") return false;
  if (context.source === "post") {
    return typeof context.postId === "string" && context.postId.length > 0;
  }
  if (context.source === "subtema") {
    return typeof context.postId === "string" && context.postId.length > 0
        && typeof context.subtemaId === "string" && context.subtemaId.length > 0;
  }
  return false;
}

/** Sends "trade:open-form" with the given context. targetOrigin is always
 *  DOERS_JOURNAL_ORIGIN, never "*" — same rule as postToDoersJournal above. */
export function postTradeOpenForm(targetWindow, context) {
  if (!targetWindow) return;
  if (!isValidTradeContext(context)) return; // never send a malformed context — Doers would just ignore it anyway
  targetWindow.postMessage(
    { channel: TRADE_BRIDGE_CHANNEL, version: TRADE_BRIDGE_VERSION, type: TRADE_MSG.OPEN_FORM, context },
    DOERS_JOURNAL_ORIGIN
  );
}

/**
 * Validates an inbound MessageEvent against the Trade channel specifically
 * (origin + envelope shape) — returns { type, context, trade } if valid,
 * null otherwise. A message on the Stats channel (different `channel`
 * string) correctly falls through to null here, same as this one falling
 * through readBridgeMessage() above.
 */
export function readTradeBridgeMessage(event, expectedSourceWindow) {
  if (event.origin !== DOERS_JOURNAL_ORIGIN) return null;
  if (expectedSourceWindow && event.source !== expectedSourceWindow) return null;
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  if (data.channel !== TRADE_BRIDGE_CHANNEL) return null;
  if (data.version !== TRADE_BRIDGE_VERSION) return null;
  if (typeof data.type !== "string") return null;
  return { type: data.type, context: data.context ?? null, trade: data.trade ?? null };
}
