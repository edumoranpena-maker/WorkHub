/**
 * Tools.jsx
 *
 * Two levels, same shape as Stats.jsx (Post's Thread overlay is the third
 * sibling of this same pattern in the app):
 *
 *   1. Tools (default export) — an ordinary PlanSpace section, mounted by
 *      App.jsx exactly like Post/Announcements/Stats/Rooms. Same behavior
 *      as any other section (unified scroll, hideable profile, sticky
 *      tabs, etc). Shows a responsive grid of tool cards — icon + name,
 *      nothing else.
 *
 *   2. ToolPortal — a real fullscreen overlay, architecturally identical to
 *      StatsDashboardPortal / ThreadView's overlay: createPortal straight to
 *      document.body, its own topbar with a back button, same open/close
 *      mechanism (AnimatePresence fade, 0.18s), same onToolsPortalChange
 *      contract as Stats' onDashboardChange so the section underneath
 *      freezes the same way. Not a Feed — uses the narrower "workspace"
 *      container (760px desktop) since a single-purpose tool reads better
 *      as a tight working column than a wide browsing layout.
 *
 * ── Adding a future tool ─────────────────────────────────────────────────
 * Add one object to the TOOLS array below: { id, name, icon, available,
 * component }. `component` is optional — omit it (or leave `available:
 * false`) and the portal falls back to a "Próximamente" placeholder, same
 * as every tool besides Risk Calculator does today.
 *
 * Risk Calculator's own UI/logic lives entirely under src/tools/
 * riskCalculator/ — this file only wires it into the grid + portal
 * mechanism, it doesn't know anything about SL, lots, or instruments.
 *
 * NOT implemented yet (by design, this pass is infrastructure only):
 *   - Position Sizer / R Multiple Converter — mock cards, no component yet.
 *   - Supabase, persistence, categories, favorites, search, permissions,
 *     deep links — explicitly out of scope for this pass.
 */
import { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Calculator } from "lucide-react";
import { PageContainer, isolateOverlayGestures } from "../lib/layout.jsx";
import RiskCalculatorPage from "../tools/riskCalculator/RiskCalculatorPage.jsx";

// ─── useIsDesktop ───────────────────────────────────────────────────────────
// Local per-file copy, same convention as every other section (Post.jsx,
// Announcements.jsx, Stats.jsx, App.jsx each keep their own).
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
// Same black as ProfileRegion (bg/surface), same secondary grays as Post.jsx
// (card/border/textMuted/textDim). No purple anywhere in this file — gold is
// the one accent color used to highlight anything important, per the
// ongoing move away from the old purple branding.
const C = {
  bg: "#000000", surface: "#0a0a0a", card: "#121212", cardHover: "#1a1a1a",
  border: "#1c1c2e", text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  gold: "#d4a843",
};
const font = "'DM Sans', sans-serif";

// ─── Tools registry ──────────────────────────────────────────────────────────
// The single source of truth for what shows in the grid. `available: false`
// tools render dimmed and inert — no portal, no click handler — exactly the
// "mock" placeholders requested for everything besides Risk Calculator.
const TOOLS = [
  { id: "risk-calculator", name: "Risk Calculator",      icon: Calculator, available: true,  component: RiskCalculatorPage },
  { id: "position-sizer",  name: "Position Sizer",       icon: Calculator, available: false },
  { id: "r-converter",     name: "R Multiple Converter", icon: Calculator, available: false },
];

function ToolCard({ tool, onClick }) {
  const Icon = tool.icon;
  return (
    <motion.button
      whileTap={tool.available ? { scale: 0.96 } : undefined}
      onClick={tool.available ? onClick : undefined}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "24px 12px", borderRadius: 16,
        background: C.card, border: `1px solid ${C.border}`,
        cursor: tool.available ? "pointer" : "default",
        opacity: tool.available ? 1 : 0.45,
      }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.gold}18`, border: `1px solid ${C.gold}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color={C.gold} strokeWidth={1.8} />
      </div>
      <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.3 }}>
        {tool.name}
      </span>
    </motion.button>
  );
}

// ─── Tools — Level 1, the section itself ───────────────────────────────────
// onToolsPortalChange: notifies App.jsx whenever a tool's fullscreen portal
// opens/closes — same contract as Stats' onDashboardChange / Post's
// onThreadChange, so the section underneath (unified scroll + profile
// header) freezes the same way it already does for those.
//
// openToolId (prop) / onOpenToolIdChange: the deep-linking pair, separate
// from onToolsPortalChange above on purpose — that one only ever needed a
// boolean for the freeze mechanism, this needs the actual id so App.jsx can
// both open a specific tool from a URL (same controlled-handoff pattern as
// Post's openThreadId prop) and reflect which one is open back into the URL.
export default function Tools({ onToolsPortalChange, openToolId: openToolIdProp, onOpenToolIdChange, onCloseRequest }) {
  const isDesktop = useIsDesktop();
  const [openToolId, setOpenToolId] = useState(null);
  const openTool = TOOLS.find(t => t.id === openToolId) ?? null;

  useEffect(() => {
    // Explicit null is as meaningful as a real id here — App's navigate()
    // resets this request state to null on every section change, same
    // treatment Post.jsx's openThreadId already got, so a tool left open
    // when the user navigates away (or presses Back) actually closes.
    setOpenToolId(openToolIdProp ?? null);
  }, [openToolIdProp]);

  useEffect(() => {
    onOpenToolIdChange?.(openToolId);
  }, [openToolId, onOpenToolIdChange]);


  return (
    <PageContainer isDesktop={isDesktop} variant="feed">
      <div style={{ padding: "20px 18px 32px" }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 4px", fontFamily: font, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
            Tools
          </h2>
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
            Utilidades y calculadoras para tu operativa.
          </p>
        </div>

        {/* Responsive grid — 2 columns fixed on mobile, as many as fit on
            desktop via auto-fill. Nothing here changes when a new tool is
            added to TOOLS above; the grid just gets one more cell. */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(150px, 1fr))" : "1fr 1fr",
          gap: 12,
        }}>
          {TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} onClick={() => setOpenToolId(tool.id)} />
          ))}
        </div>
      </div>

      <ToolPortal
        tool={openTool}
        onClose={() => onCloseRequest ? onCloseRequest() : setOpenToolId(null)}
        onPortalChange={onToolsPortalChange}
      />
    </PageContainer>
  );
}

// ─── ToolPortal — Level 2, fullscreen overlay hosting a single tool ────────
// Same pattern as StatsDashboardPortal / ThreadView's overlay:
// createPortal(..., document.body) so this escapes any clipping/transformed
// ancestor regardless of platform. zIndex 9999 matches every other top-level
// portal in the app. Opens/closes exactly the same way: AnimatePresence
// fade, mounted only while a tool is open, closed via the topbar Back
// button only (no backdrop-click-to-close), same as Thread and Dashboard.
//
// Uses variant="workspace" (760px) — not "feed" — since this is a focused
// single-task surface, not a browsing feed. Body is an intentionally empty
// placeholder for now; the Risk Calculator's real fields/logic are a
// separate, later pass.
function ToolPortal({ tool, onClose, onPortalChange }) {
  const isDesktop = useIsDesktop();
  const open = !!tool;

  // Reports open/closed up to App.jsx before paint — same timing as
  // StatsDashboardPortal's onDashboardChange — so the freeze on the section
  // underneath (scroll lock + hidden profile header) commits with no
  // one-frame flash.
  useLayoutEffect(() => { onPortalChange?.(open); }, [open]); // eslint-disable-line

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="tool-portal-overlay" {...isolateOverlayGestures}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.surface, display: "flex", flexDirection: "column" }}>

          {/* Topbar — owned entirely by this portal, full width, independent
              of PlanSpace's TopBar/ProfileRegion underneath. */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", flexShrink: 0, minHeight: 56 }}>
            <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 3, color: C.gold, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
              <ChevronLeft size={19} strokeWidth={2.2} /> Tools
            </button>
            <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", textAlign: "center", marginRight: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tool?.name ?? ""}
            </span>
          </div>

          {/* Body — delegates its own width/centering to whatever renders
              inside (each tool component owns its own PageContainer, same
              as RiskCalculatorPage does with variant="workspace"), so this
              stays a plain scroll area, not a second width decision. Tools
              without a real interface yet (available:false ones can never
              reach here; a future available:true tool with no component
              wired up yet would) fall back to the placeholder. */}
          <div style={{ flex: 1, overflowY: "auto", background: C.bg }}>
            {tool?.component ? (
              <tool.component />
            ) : (
              <PageContainer isDesktop={isDesktop} variant="workspace">
                <div style={{ padding: "24px 18px" }}>
                  <div style={{ minHeight: 240, borderRadius: 16, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: font, fontSize: 13, color: C.textDim }}>Próximamente</span>
                  </div>
                </div>
              </PageContainer>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
