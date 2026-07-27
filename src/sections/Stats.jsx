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
 * to, after the shared-Supabase migration). Fetched once when Stats mounts,
 * completely independent of whether the user ever opens the Dashboard
 * portal — that's the whole point: the cards are real data from the moment
 * the user lands on the section, no iframe load required. Doers Journal and
 * PlanSpace read the exact same view, so there's no duplicated calculation
 * logic anywhere.
 *
 * ── The postMessage bridge (lib/doersJournalBridge.js) ──────────────────
 * Still lives here, still wired into StatsDashboardPortal via onStatsUpdate
 * — if Doers Journal happens to push a fresher stats:all-time message while
 * the Dashboard is open (e.g. right after the user logs a trade in there),
 * the cards pick it up live. But it's no longer the ONLY way the cards get
 * data, and it's not what populates them on first load. Its real reason for
 * being here going forward is the message types reserved for later features
 * — trade:open-form, profile:metric-update — see that file for the full
 * catalogue.
 */
import { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Loader } from "lucide-react";
import {
  DOERS_JOURNAL_URL, MSG,
  postToDoersJournal, readBridgeMessage, parseAllTimeStatsPayload,
} from "../lib/doersJournalBridge.js";
import { fetchAllTimeStats } from "../lib/statsApi.js";
import { PageContainer } from "../lib/layout.jsx";

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
export default function Stats({ onDashboardChange }) {
  const isDesktop = useIsDesktop();
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // All-Time summary. Populated automatically on mount via a direct read
  // (fetchAllTimeStats → v_alltime_stats), independent of the Dashboard
  // portal. `statsLoaded` distinguishes "haven't fetched yet" from "fetched,
  // genuinely nothing to show" so the empty-state message below only
  // appears once we actually know there are no trades, not during the brief
  // initial load.
  //
  // Stats stays permanently mounted while the app is open (App.jsx toggles
  // it with display:none/block on tab switch, it never unmounts) — so a
  // plain mount-only fetch would go stale forever after the first load and
  // never notice a trade edited later. refreshStats is called again when the
  // Dashboard portal closes (the moment the user is most likely to have just
  // edited something in Doers Journal), so the cards catch up right after.
  const [allTimeStats, setAllTimeStats] = useState(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const refreshStats = useCallback(() => {
    fetchAllTimeStats().then(stats => {
      setAllTimeStats(stats);
      setStatsLoaded(true);
    });
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

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

      {/* CTA — opens the fullscreen Dashboard portal, not a navigation/replace */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setDashboardOpen(true)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", borderRadius: 16, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: "#fff", fontFamily: font, fontSize: 14, fontWeight: 700, boxShadow: `0 6px 24px ${C.accent}45` }}>
        Ver Dashboard completo
        <ArrowRight size={17} strokeWidth={2.4} />
      </motion.button>

      <StatsDashboardPortal
        open={dashboardOpen}
        onClose={() => { setDashboardOpen(false); refreshStats(); }}
        onDashboardChange={onDashboardChange}
        onStatsUpdate={setAllTimeStats}
      />
    </div>
    </PageContainer>
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
function StatsDashboardPortal({ open, onClose, onDashboardChange, onStatsUpdate }) {
  const isDesktop = useIsDesktop();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef(null);

  // Reset the loading state each time the portal is reopened, so a second
  // visit shows the spinner again instead of a stale "loaded" flag from the
  // previous mount — the iframe itself remounts too (unmounted entirely on
  // close, since this whole tree is `{open && (...)}`).
  useLayoutEffect(() => { if (open) setIframeLoaded(false); }, [open]);

  // Reports open/closed up to App.jsx — same useLayoutEffect timing as
  // Post.jsx's `useLayoutEffect(() => { onThreadChange?.(!!openThread) }, ...)`
  // so the freeze on the section underneath (scroll lock + hidden profile
  // header) commits before paint, no one-frame flash of the frozen section.
  useLayoutEffect(() => { onDashboardChange?.(open); }, [open]); // eslint-disable-line

  // The bridge: listens for postMessage from the iframe for as long as the
  // portal is open, tears the listener down on close/unmount. Only accepts
  // messages whose origin AND source window match this exact iframe.
  useEffect(() => {
    if (!open) return;
    function handleMessage(event) {
      const msg = readBridgeMessage(event, iframeRef.current?.contentWindow);
      if (!msg) return; // wrong origin/source/envelope — ignore, don't throw
      if (msg.type === MSG.STATS_ALL_TIME) {
        const parsed = parseAllTimeStatsPayload(msg.payload);
        if (parsed) onStatsUpdate?.(parsed);
        // A malformed payload is silently dropped rather than blanking out
        // whatever the cards were already showing.
      }
      // Unknown types are ignored on purpose — forward-compatible with
      // message types this build doesn't handle yet (see bridge file).
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open]); // eslint-disable-line

  // Once the iframe has actually loaded, tell Doers Journal PlanSpace is
  // ready and ask for the All-Time snapshot. Explicit request (rather than
  // relying purely on Doers Journal pushing on its own) so a fresh mount
  // always gets a snapshot instead of waiting for the next data change.
  const handleIframeLoad = () => {
    setIframeLoaded(true);
    const target = iframeRef.current?.contentWindow;
    postToDoersJournal(target, MSG.READY);
    postToDoersJournal(target, MSG.STATS_REQUEST, { scope: "all-time" });
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="stats-dashboard-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.surface, display: "flex", flexDirection: "column" }}>

          {/* Topbar — owned entirely by this portal, independent of PlanSpace's
              MobileTopBar/Sidebar/Chips underneath. */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", flexShrink: 0, minHeight: 56 }}>
            <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 3, color: C.teal, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
              <ChevronLeft size={19} strokeWidth={2.2} /> Stats
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
                key="doers-journal-iframe"
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
      )}
    </AnimatePresence>,
    document.body
  );
}
