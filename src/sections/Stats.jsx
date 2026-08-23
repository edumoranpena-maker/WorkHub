/**
 * Stats.jsx
 *
 * Two levels, kept deliberately decoupled so Doers Journal never has to
 * change to fit inside PlanSpace:
 *
 *   1. Stats (default export) — an ordinary PlanSpace section, mounted by
 *      App.jsx exactly like Post/Announcements. Same behavior as any other
 *      section (unified scroll, hideable profile, sticky chips, etc). Shows
 *      a welcome blurb, a grid of native PlanSpace cards fed by real
 *      All-Time metrics from Doers Journal, and a CTA into the full
 *      Dashboard.
 *
 *   2. StatsDashboardPortal — a real fullscreen overlay, architecturally
 *      identical to ThreadView's overlay in Post.jsx: createPortal straight
 *      to document.body, its own sticky topbar, Doers Journal embedded via
 *      <iframe>. PlanSpace never mounts a second, hidden copy of the
 *      Dashboard just to fetch data — it doesn't need to anymore (see below).
 *
 * ── Where the summary cards' data comes from ────────────────────────────
 * lib/statsApi.js#fetchAllTimeStats() — a direct Supabase read against the
 * `v_alltime_stats` view (same Postgres project Doers Journal itself writes
 * to, after the shared-Supabase migration). The fetch itself, and the
 * resulting allTimeStats/statsLoaded state, now live in App.jsx — NOT
 * here — because Perfil's Winrate stat needs the exact same value on the
 * exact same refresh schedule (see App.jsx's own comment on allTimeStats
 * for why two independent copies used to drift out of sync). Stats.jsx
 * receives allTimeStats/statsLoaded/onRefreshStats/onStatsUpdate as props
 * and is otherwise unchanged — same cards, same empty-state message, same
 * refresh-on-Dashboard-close timing.
 *
 * ── The postMessage bridge (lib/doersJournalBridge.js) ──────────────────
 * Still lives here, still wired into StatsDashboardPortal via onStatsUpdate
 * — if Doers Journal happens to push a fresher stats:all-time message while
 * the Dashboard is open (e.g. right after the user logs a trade in there),
 * the cards (and, now, Perfil too, since it's the same shared state) pick
 * it up live. But it's not what populates them on first load. Its real
 * reason for being here going forward is the message types reserved for
 * later features — profile:metric-update — see that file for the full
 * catalogue.
 */
import { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, usePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Loader } from "lucide-react";
import {
  DOERS_JOURNAL_URL, MSG,
  postToDoersJournal, readBridgeMessage, parseAllTimeStatsPayload,
  TRADE_MSG, postTradeOpenForm, readTradeBridgeMessage, isValidTradeContext,
} from "../lib/doersJournalBridge.js";
import { linkTradeToPost } from "../lib/postTradeLinksApi.js";
import { PageContainer, isolateOverlayGestures } from "../lib/layout.jsx";
import { useNavigation } from "../lib/navigation.jsx";

// ─── useIsDesktop ───────────────────────────────────────────────────────────
// Local per-file copy, same convention as every other section (Post.jsx,
// Announcements.jsx, App.jsx each keep their own).
function useIsDesktop() {
  const [v, setV] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

// ─── Design Tokens ──────────────────────────────────────────────────────────
// Mirrors the token set used by Post.jsx / Announcements.jsx. Kept local to
// this section, same convention as the rest of PlanSpace's sections.
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", cardHover: "#19192a",
  border: "#1c1c2e",
  accent: "#7c4dff", accentLight: "#9d71ff", accentDim: "#3a1f70",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  green: "#1ed99a", greenDim: "rgba(30,217,154,0.12)",
  red: "#ff4f6a", amber: "#f5a623",
  teal: "#22d3a0",
};
const font = "'DM Sans', sans-serif";

// Container widths now come from lib/layout.jsx's shared PageContainer — the
// main Stats screen uses variant="feed" (1200px), the Dashboard portal uses
// variant="dashboard" (1400px, wide enough for Doers Journal's tables/charts).

// ─── Display formatting ─────────────────────────────────────────────────────
// Pure presentation — Doers Journal sends raw numbers, PlanSpace decides how
// its own cards render them (kept in one place so it's easy to change later
// without touching the bridge contract).
const fmtWinrate    = v => `${Math.round(v)}%`;
const fmtExpectancy = v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
const fmtTrades     = v => `${v}`;
const fmtProfit     = v => `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function summaryFromStats(stats) {
  return [
    { label: "Winrate",    value: stats ? fmtWinrate(stats.winrate)       : "—", color: !stats ? C.textMuted : stats.winrate >= 50 ? C.green : C.red },
    { label: "Expectancy", value: stats ? fmtExpectancy(stats.expectancy) : "—", color: !stats ? C.textMuted : stats.expectancy >= 0 ? C.green : C.red },
    { label: "Trades",     value: stats ? fmtTrades(stats.totalTrades)    : "—", color: C.accentLight },
    { label: "Profit",     value: stats ? fmtProfit(stats.profit)         : "—", color: !stats ? C.textMuted : stats.profit >= 0 ? C.green : C.red },
  ];
}

// ─── Stats — Level 1, the section itself ───────────────────────────────────
// onDashboardChange: notifies App.jsx whenever the fullscreen Dashboard
// portal opens/closes, same contract as Post.jsx's onThreadChange, so the
// section underneath (unified scroll + profile header) can be frozen the
// same way it already is for Thread.
export default function Stats({ onDashboardChange, pendingTradeContext, onClearPendingTrade, onTradeLinked, allTimeStats, statsLoaded, onRefreshStats, onStatsUpdate }) {
  const isDesktop = useIsDesktop();
  const { route, navigate, goBack } = useNavigation();
  const dashboardOpen = route.routeId === "statsDashboard";

  // allTimeStats/statsLoaded and the refresh trigger itself now live in
  // App.jsx (see its own comment there for why: this used to be a second,
  // independent fetchAllTimeStats() call refreshing on a different
  // schedule than Perfil's copy, which is exactly why Perfil used to lag
  // behind these same cards after a trade was added or deleted). Stats.jsx
  // keeps calling it "refreshStats" locally purely so the rest of this
  // file doesn't need to change — it's App's onRefreshStats underneath.
  const refreshStats = onRefreshStats;

  // Single close path for the Dashboard portal — used by the topbar Back
  // button (cancel/close without saving) AND, unchanged, by a valid
  // trade:saved arriving in StatsDashboardPortal (see its onClose call
  // below): both cases are "the Dashboard is done, go back to where the
  // user came from" and must behave identically. Clearing
  // pendingTradeContext here — not just after a successful trade:saved —
  // is what stops a cancelled Registrar session from being inherited by a
  // later, unrelated one (see App.jsx's handleRegisterTrade).
  const handleCloseDashboard = useCallback(() => {
    goBack();
    refreshStats();
    onClearPendingTrade?.();
  }, [goBack, refreshStats, onClearPendingTrade]);

  const summary = summaryFromStats(allTimeStats);

  return (
    <PageContainer isDesktop={isDesktop} variant="feed">
    <div style={{ padding: "20px 18px 32px" }}>
      {/* Welcome message */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 4px", fontFamily: font, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
          Tus Stats
        </h2>
        <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
          Resumen All-Time desde Doers Journal. Abre el Dashboard completo para el detalle día a día.
        </p>
      </div>

      {/* Summary grid — native PlanSpace cards, fed by Doers Journal's All-Time stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {summary.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {!allTimeStats && statsLoaded && (
        <p style={{ margin: "-10px 0 20px", fontFamily: font, fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
          Aún no hay trades registrados en Doers Journal.
        </p>
      )}

      {/* CTA — opens the fullscreen Dashboard portal via a real navigation */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("statsDashboard")}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", borderRadius: 16, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: "#fff", fontFamily: font, fontSize: 14, fontWeight: 700, boxShadow: `0 6px 24px ${C.accent}45` }}>
        Ver Dashboard completo
        <ArrowRight size={17} strokeWidth={2.4} />
      </motion.button>

      <StatsDashboardPortal
        open={dashboardOpen}
        onClose={handleCloseDashboard}
        onDashboardChange={onDashboardChange}
        onStatsUpdate={onStatsUpdate}
        pendingTradeContext={pendingTradeContext}
        onTradeLinked={onTradeLinked}
      />
    </div>
    </PageContainer>
  );
}

// ─── DashboardOverlay — the actual animated/portaled node ──────────────────
// Split out from StatsDashboardPortal so it can call usePresence() — Framer
// Motion's own documented escape hatch for a known upstream bug class where
// AnimatePresence's exit-completion tracking gets confused and never
// actually removes the exiting node from the DOM (see Tools.jsx's
// ToolPortalOverlay, which hit the exact same thing and has the full
// writeup — motion issues #2554/#1914).
//
// THIS is what was silently breaking "Registrar → trade:open-form": if the
// Dashboard had been opened and closed even once before (e.g. the user
// tried "Ver Dashboard completo" first, or opened/cancelled a previous
// Registrar attempt), the outgoing <motion.div key="stats-dashboard-overlay">
// could get stuck mid-exit instead of actually being removed. On the NEXT
// open, AnimatePresence sees the same key still present and revives that
// SAME component instance instead of mounting a fresh one — so the
// <iframe> never gets a new load cycle, `onLoad` never fires again, and
// handleIframeLoad() (the only place trade:open-form is ever sent) simply
// never runs for that visit. Visually this is invisible: the already-
// loaded Dashboard just reappears, looking completely normal — which is
// exactly why "Registrar → Dashboard" looked like it worked while "Nuevo
// Trade" silently never opened.
//
// Same two-layer fix as ToolPortalOverlay:
//   1. pointerEvents set directly in the `exit` variant, applied the
//      instant exit begins rather than after it finishes.
//   2. usePresence()'s safeToRemove(), forced via a timeout well past the
//      0.18s transition, guarantees the node is ACTUALLY torn down even if
//      Framer's own completion callback gets stuck — which is what
//      guarantees the next open is a genuinely fresh mount (fresh iframe,
//      fresh onLoad, pendingTradeContext correctly picked up).
function DashboardOverlay({ onClose, onStatsUpdate, pendingTradeContext, onTradeLinked }) {
  const [isPresent, safeToRemove] = usePresence();
  const isDesktop = useIsDesktop();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef(null);
  const handledTradeIdsRef = useRef(new Set()); // trade.id values already linked this session — see the trade:saved handler below

  useEffect(() => {
    if (isPresent) return;
    const t = setTimeout(safeToRemove, 400); // 0.18s transition + generous buffer
    return () => clearTimeout(t);
  }, [isPresent, safeToRemove]);

  // The bridge: listens for postMessage from the iframe for as long as this
  // overlay is mounted, tears the listener down on unmount. Only accepts
  // messages whose origin AND source window match this exact iframe.
  //
  // Checks BOTH channels independently in the same handler — the Stats
  // channel (readBridgeMessage/BRIDGE_CHANNEL) and the separate Trade
  // channel (readTradeBridgeMessage/TRADE_BRIDGE_CHANNEL). A message
  // belongs to at most one of them (different `channel` string), so this
  // can't misfire across the two; the Stats integration's own handling
  // below is completely unchanged.
  useEffect(() => {
    function handleMessage(event) {
      const msg = readBridgeMessage(event, iframeRef.current?.contentWindow);
      if (msg) {
        if (msg.type === MSG.STATS_ALL_TIME) {
          const parsed = parseAllTimeStatsPayload(msg.payload);
          if (parsed) onStatsUpdate?.(parsed);
          // A malformed payload is silently dropped rather than blanking out
          // whatever the cards were already showing.
        }
        // Unknown types are ignored on purpose — forward-compatible with
        // message types this build doesn't handle yet (see bridge file).
        return;
      }

      const tradeMsg = readTradeBridgeMessage(event, iframeRef.current?.contentWindow);
      if (!tradeMsg) return; // neither channel matched — not a message for us
      if (tradeMsg.type !== TRADE_MSG.SAVED) return; // only type this side needs to react to
      if (!isValidTradeContext(tradeMsg.context)) return; // malformed — ignore rather than close on faith

      // Success, confirmed by Doers Journal after its own Supabase insert.
      // Persist the Post↔Trade link (see postTradeLinksApi.js — this is
      // the ONLY place this ever gets written), so Registrar (N) is
      // already correct in Supabase the moment the user eventually leaves.
      // handledTradeIdsRef guards against processing the same trade.id
      // twice (e.g. a stray repeated message); the table's own unique
      // index on trade_id would reject a real duplicate insert anyway,
      // this just avoids a pointless second network round-trip for the
      // common case.
      //
      // Deliberately does NOT call onClose() anymore — trade:saved used to
      // close the Dashboard and goBack() automatically; now the user stays
      // inside Doers Journal (which shows its own "✓ Trade registrado
      // correctamente" confirmation) and leaves manually via the topbar
      // arrow whenever they're ready. onClose is still exactly what that
      // arrow calls (see the topbar button below) — trade:saved and a
      // manual close both still end up going through the same
      // handleCloseDashboard in Stats.jsx, just no longer triggered
      // automatically from here.
      const tradeId = tradeMsg.trade?.id;
      if (tradeId && !handledTradeIdsRef.current.has(tradeId)) {
        handledTradeIdsRef.current.add(tradeId);
        linkTradeToPost(tradeMsg.context.postId, tradeId).then(ok => {
          if (ok) onTradeLinked?.(tradeMsg.context.postId);
        });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []); // eslint-disable-line — mounted only while this overlay itself exists, no [open] gate needed anymore

  // Sends "trade:open-form" — deliberately NOT inside handleIframeLoad
  // below. Relying only on the onLoad event to gate this send is fragile:
  // if this DashboardOverlay instance ever ends up reused rather than
  // freshly mounted (AnimatePresence reviving an exit-in-progress node —
  // see this component's own header comment), `iframeLoaded` can already
  // be `true` from a previous open and onLoad simply never fires again,
  // silently dropping the message. This effect instead treats
  // `iframeLoaded` as a piece of STATE to react to, not an EVENT to catch:
  // it fires whenever iframeLoaded and pendingTradeContext are BOTH true
  // at the same time, however that came to be — a fresh onLoad just now,
  // or an already-true iframeLoaded from before combined with a brand-new
  // Registrar click supplying a fresh pendingTradeContext. Either path
  // ends up here and sends correctly.
  //
  // sentForRef tracks the exact context OBJECT already sent (App.jsx's
  // setPendingTradeContext always creates a new object per Registrar
  // click, so this is a reliable per-click identity) — guarantees exactly
  // one send per Registrar click, never a repeat on unrelated re-renders,
  // and correctly sends again for a genuinely new click even if the
  // iframe was already loaded from before.
  const sentForRef = useRef(null);
  useEffect(() => {
    if (!iframeLoaded) return; // iframe not confirmed ready yet
    if (!pendingTradeContext) { sentForRef.current = null; return; } // nothing pending — also resets, so a later click is never mistaken for "already sent"
    if (sentForRef.current === pendingTradeContext) return; // already sent for this exact click
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    postTradeOpenForm(target, pendingTradeContext);
    sentForRef.current = pendingTradeContext;
  }, [iframeLoaded, pendingTradeContext]);

  // Once the iframe has actually loaded, tell Doers Journal PlanSpace is
  // ready and ask for the All-Time snapshot — unchanged, Stats bridge only.
  // trade:open-form is NOT sent from here anymore (see the effect above) —
  // this only flips iframeLoaded to true, which is what that effect
  // actually reacts to.
  const handleIframeLoad = () => {
    setIframeLoaded(true);
    const target = iframeRef.current?.contentWindow;
    postToDoersJournal(target, MSG.READY);
    postToDoersJournal(target, MSG.STATS_REQUEST, { scope: "all-time" });
  };

  return (
    <motion.div {...isolateOverlayGestures}
      initial={{ opacity: 0, pointerEvents: "none" }}
      animate={{ opacity: 1, pointerEvents: "auto" }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.18 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.surface, display: "flex", flexDirection: "column" }}>

      {/* Topbar — owned entirely by this portal, independent of PlanSpace's
          MobileTopBar/Sidebar/Chips underneath. The arrow's label depends
          on how we got here: pendingTradeContext only ever has a value
          when this Dashboard was opened via Registrar from a Post (see
          App.jsx's handleRegisterTrade) — in that case the arrow means
          "go back to that Post", not "go back to Stats", so it's shown
          bare. A normal "Ver Dashboard completo" open never sets
          pendingTradeContext, so that case is completely unchanged. */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", flexShrink: 0, minHeight: 56 }}>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 3, color: C.teal, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
          <ChevronLeft size={19} strokeWidth={2.2} /> {!pendingTradeContext && "Stats"}
        </button>
        <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", textAlign: "center", marginRight: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Dashboard
        </span>
      </div>

      {/* Doers Journal — fills all remaining space below the topbar.
          flex:1 + position:relative with no overflow/scroll of its own
          imposed here; the iframe is sized to 100%/100% so Doers Journal's
          own layout (sticky header, modals, scroll) drives everything
          inside it, completely independent of PlanSpace's scroll. */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: C.bg }}>
        {/* Capped + centered workspace column — the iframe lives in here,
            sized to fill it (100%/100%), while the outer flex:1 area above
            keeps showing background:C.bg on the sides, same "chrome vs
            content" split used everywhere else in this redesign. */}
        <PageContainer isDesktop={isDesktop} variant="dashboard" style={{ position: "relative", height: "100%" }}>
          {/* Loading state — shown until the iframe fires onLoad */}
          {!iframeLoaded && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, background: C.bg, zIndex: 1 }}>
              <Loader size={20} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontFamily: font, fontSize: 13, color: C.textMuted }}>Cargando Dashboard…</span>
              <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={DOERS_JOURNAL_URL}
            title="Doers Journal Dashboard"
            onLoad={handleIframeLoad}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              border: "none", display: "block",
              background: C.bg,
            }}
            // No sandbox restrictions — Doers Journal needs its own scripts,
            // storage and forms to run normally. Revisit once "Nuevo Trade"
            // and auth handoff are in scope.
            allow="clipboard-write"
          />
        </PageContainer>
      </div>
    </motion.div>
  );
}

// ─── StatsDashboardPortal — Level 2, fullscreen overlay hosting Doers Journal ─
// Same pattern as ThreadView's overlay (Post.jsx): createPortal(..., document.body)
// so this escapes any clipping/transformed ancestor regardless of whether Stats
// is being rendered from the desktop or mobile shell. zIndex 9999 sits above
// every other fixed element in the app (FABs at 999, role toggle at 9998), so
// it's a true top-level fullscreen layer, not just visually full-bleed.
//
// Opens/closes exactly like ThreadView: AnimatePresence fade, mounted only
// while `open` is true, closed via the topbar Back button — nothing else can
// dismiss it (no backdrop-click-to-close), same as Thread.
//
// onStatsUpdate: bubbles a parsed { winrate, expectancy, totalTrades, profit }
// up to Stats every time a valid "stats:all-time" message arrives.
function StatsDashboardPortal({ open, onClose, onDashboardChange, onStatsUpdate, pendingTradeContext, onTradeLinked }) {
  // Reports open/closed up to App.jsx — same useLayoutEffect timing as
  // Post.jsx's `useLayoutEffect(() => { onThreadChange?.(!!openThread) }, ...)`
  // so the freeze on the section underneath (scroll lock + hidden profile
  // header) commits before paint, no one-frame flash of the frozen section.
  useLayoutEffect(() => { onDashboardChange?.(open); }, [open]); // eslint-disable-line

  return createPortal(
    <AnimatePresence>
      {open && (
        <DashboardOverlay key="stats-dashboard-overlay"
          onClose={onClose} onStatsUpdate={onStatsUpdate} pendingTradeContext={pendingTradeContext} onTradeLinked={onTradeLinked} />
      )}
    </AnimatePresence>,
    document.body
  );
}
