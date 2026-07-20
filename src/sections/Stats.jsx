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
 *      its own sticky topbar and a Back button. Doers Journal will live
 *      inside it later via <iframe>, keeping its own sticky header, modals,
 *      and scroll completely intact — nothing here or in Doers Journal needs
 *      to change to reconcile the two into one scroll.
 *
 * NOT implemented yet (by design, this pass only prepares the shell):
 *   - the actual <iframe src="..."> pointing at Doers Journal
 *   - any postMessage bridge / auth handoff between PlanSpace and Doers Journal
 *   - real metric values in the summary grid (still placeholders)
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, BarChart2 } from "lucide-react";

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

// ─── Stats — Level 1, the section itself ───────────────────────────────────
export default function Stats() {
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

      <StatsDashboardPortal open={dashboardOpen} onClose={() => setDashboardOpen(false)} />
    </div>
  );
}

// ─── StatsDashboardPortal — Level 2, fullscreen overlay reserved for Doers Journal ─
// Same pattern as ThreadView's overlay (Post.jsx): createPortal(..., document.body)
// so this escapes any clipping/transformed ancestor regardless of whether Stats
// is being rendered from the desktop or mobile shell. zIndex 9999 sits above
// every other fixed element in the app (FABs at 999, role toggle at 9998), so
// it's a true top-level fullscreen layer, not just visually full-bleed.
function StatsDashboardPortal({ open, onClose }) {
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

          {/* Reserved space for Doers Journal — mounted here later as an
              <iframe>. This container imposes no scroll or layout of its own
              beyond flex:1, so Doers Journal keeps its own sticky header,
              modals, and scroll exactly as-is once embedded. */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 24, textAlign: "center" }}>
              <BarChart2 size={30} color={C.textMuted} strokeWidth={1.6} />
              <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, maxWidth: 260, lineHeight: 1.5 }}>
                Aquí vivirá Doers Journal, embebido como iframe con su propio scroll, header sticky y modales.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
