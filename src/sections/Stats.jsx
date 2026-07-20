/**
 * Stats.jsx
 *
 * Two levels, kept deliberately decoupled so Doers Journal never has to
 * change to fit inside PlanSpace:
 *
 *   1. Stats (default export) — an ordinary PlanSpace section, mounted by
 *      App.jsx exactly like Post/Announcements. Same behavior as any other
 *      section (unified scroll, hideable profile, sticky chips, etc). Shows
 *      a welcome blurb, a placeholder grid of headline metrics (wired to
 *      Doers Journal later), and a CTA into the full Dashboard.
 *
 *   2. StatsDashboardPortal — a real fullscreen overlay, architecturally
 *      identical to ThreadView's overlay in Post.jsx: createPortal straight
 *      to document.body (so position:fixed escapes unifiedScrollRef's
 *      clipping on mobile and the animated section wrapper on desktop), with
 *      its own sticky topbar and a Back button. Doers Journal now lives
 *      inside it via <iframe src="https://doers-journal.vercel.app/">,
 *      keeping its own sticky header, modals, and scroll completely intact —
 *      nothing here or in Doers Journal needs to change to reconcile the two
 *      into one scroll.
 *
 * Freezing the section underneath: exactly like Post.jsx reports its Thread
 * overlay up via onThreadChange, Stats reports its Dashboard overlay up via
 * onDashboardChange so App.jsx can lock the unified scroll / hide the profile
 * header while the portal covers the screen (see App.jsx's
 * insideFullscreenOverlay wiring).
 *
 * NOT implemented yet (by design, this pass only validates the visual embed):
 *   - any postMessage bridge / auth handoff between PlanSpace and Doers Journal
 *   - metrics sync (the summary grid above stays on placeholder values)
 *   - the "Registrar Trade" action
 */
import { useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Loader } from "lucide-react";

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

const DOERS_JOURNAL_URL = "https://doers-journal.vercel.app/";

// ─── Stats — Level 1, the section itself ───────────────────────────────────
// onDashboardChange: notifies App.jsx whenever the fullscreen Dashboard
// portal opens/closes, same contract as Post.jsx's onThreadChange, so the
// section underneath (unified scroll + profile header) can be frozen the
// same way it already is for Thread.
export default function Stats({ onDashboardChange }) {
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Placeholder — will be populated from Doers Journal once the iframe/bridge
  // is wired up. Keys chosen to match the metrics Doers Journal exposes.
  const summary = [
    { label: "Winrate",    value: "—", color: C.green       },
    { label: "Expectancy", value: "—", color: C.accentLight },
    { label: "Trades",     value: "—", color: C.amber       },
    { label: "Profit",     value: "—", color: C.green       },
  ];

  return (
    <div style={{ padding: "20px 18px 32px" }}>
      {/* Welcome message */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 4px", fontFamily: font, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
          Tus Stats
        </h2>
        <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
          Un resumen rápido de tu desempeño. Abre el Dashboard completo para el detalle día a día de Doers Journal.
        </p>
      </div>

      {/* Summary grid — headline metrics, filled in from Doers Journal later */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {summary.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* CTA — opens the fullscreen Dashboard portal, not a navigation/replace */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setDashboardOpen(true)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", borderRadius: 16, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: "#fff", fontFamily: font, fontSize: 14, fontWeight: 700, boxShadow: `0 6px 24px ${C.accent}45` }}>
        Ver Dashboard completo
        <ArrowRight size={17} strokeWidth={2.4} />
      </motion.button>

      <StatsDashboardPortal
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        onDashboardChange={onDashboardChange}
      />
    </div>
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
function StatsDashboardPortal({ open, onClose, onDashboardChange }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Reset the loading state each time the portal is reopened, so a second
  // visit shows the spinner again instead of a stale "loaded" flag from the
  // previous mount — the iframe itself remounts too (see `open &&` below,
  // which unmounts it on close).
  useLayoutEffect(() => { if (open) setIframeLoaded(false); }, [open]);

  // Reports open/closed up to App.jsx — same useLayoutEffect timing as
  // Post.jsx's `useLayoutEffect(() => { onThreadChange?.(!!openThread) }, ...)`
  // so the freeze on the section underneath (scroll lock + hidden profile
  // header) commits before paint, no one-frame flash of the frozen section.
  useLayoutEffect(() => { onDashboardChange?.(open); }, [open]); // eslint-disable-line

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
            {/* Loading state — shown until the iframe fires onLoad */}
            {!iframeLoaded && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, background: C.bg, zIndex: 1 }}>
                <Loader size={20} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontFamily: font, fontSize: 13, color: C.textMuted }}>Cargando Dashboard…</span>
                <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
              </div>
            )}

            <iframe
              key="doers-journal-iframe"
              src={DOERS_JOURNAL_URL}
              title="Doers Journal Dashboard"
              onLoad={() => setIframeLoaded(true)}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                border: "none", display: "block",
                background: C.bg,
              }}
              // No sandbox restrictions — Doers Journal needs its own scripts,
              // storage and forms to run normally. Revisit once the
              // PlanSpace ↔ Doers Journal bridge (postMessage/auth) is defined.
              allow="clipboard-write"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
