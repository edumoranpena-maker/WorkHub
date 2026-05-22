import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, FileText, Megaphone, Hash, MessageSquare,
  Bell, Search, Sparkles, TrendingUp, Clock,
  ChevronLeft, ChevronRight, ArrowRight, Users, LayoutDashboard,
  Activity, Zap, Radio,
} from "lucide-react";
import Planning      from "./sections/Planning";
import Recaps        from "./sections/Recaps";
import Announcements from "./sections/Announcements";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          "#08080e",
  surface:     "#0e0e18",
  card:        "#13131f",
  cardHover:   "#19192a",
  border:      "#1c1c2e",
  accent:      "#7c4dff",
  accentLight: "#9d71ff",
  accentDim:   "#3d2480",
  text:        "#eaeaf5",
  textMuted:   "#6a6a82",
  textDim:     "#32324a",
  green:       "#1ed99a",
  greenDim:    "rgba(30,217,154,0.12)",
  amber:       "#f5a623",
  blue:        "#4fa3ff",
  red:         "#ff4f6a",
};
const font = "'DM Sans', sans-serif";

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "planning",      label: "Planning",         icon: CalendarDays,   subtitle: "Trade plans & market analysis",    accentColor: "#7c4dff", glowColor: "rgba(124,77,255,0.18)",  badge: "4 new"  },
  { id: "recaps",        label: "Recaps & Updates", icon: FileText,       subtitle: "Weekly summaries & progress",      accentColor: "#22d3a0", glowColor: "rgba(34,211,160,0.15)",  badge: "1 new"  },
  { id: "announcements", label: "Announcements",    icon: Megaphone,      subtitle: "Official updates from leadership", accentColor: "#f59e0b", glowColor: "rgba(245,158,11,0.15)",  badge: null     },
  { id: "rooms",         label: "Rooms",            icon: Hash,           subtitle: "Live group sessions & channels",   accentColor: "#60a5fa", glowColor: "rgba(96,165,250,0.15)",  badge: "2 live" },
  { id: "community",     label: "Community",        icon: MessageSquare,  subtitle: "Open chat for all members",        accentColor: "#e879f9", glowColor: "rgba(232,121,249,0.15)", badge: "12 new" },
];

const PREVIEW_POSTS = {
  planning:      { title: "Weekly Market Outlook",         excerpt: "Major confluence zones aligning across DXY and XAUUSD. Expecting a corrective move before continuation.", author: "Alex H.",  timestamp: "2h ago",    tag: "Analysis"   },
  recaps:        { title: "Week 20 Recap — Targets Hit",   excerpt: "XAUUSD confirmed the rejection at 2340. Target hit at 2310. Full breakdown of the week's moves inside.",  author: "Alex H.",  timestamp: "Today",     tag: "Weekly"     },
  announcements: { title: "New Room Schedule — May",       excerpt: "Daily sessions now at 8 AM and 2 PM EST. Check the full calendar inside.",                                author: "Admin",    timestamp: "Yesterday", tag: "Official"   },
  rooms:         { title: "🔴 Live: Pre-Market Session",   excerpt: "Alex H. is hosting a live pre-market session. Join now for real-time analysis and trade setups.",         author: "Alex H.",  timestamp: "Live now",  tag: "Live"       },
  community:     { title: "Share your wins this week! 🏆", excerpt: "Drop your best trade of the week below. Let's celebrate the wins and learn from each other's setups.",   author: "Marco V.", timestamp: "5m ago",    tag: "Discussion" },
};

// ─── Animations ───────────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (d) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
};
const springTrans = { type: "spring", stiffness: 380, damping: 38, mass: 0.85 };
const fadeTrans   = { duration: 0.2, ease: "easeOut" };

// ─── useIsDesktop ─────────────────────────────────────────────────────────────
function useIsDesktop() {
  const [v, setV] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

// ─── IconBtn ──────────────────────────────────────────────────────────────────
function IconBtn({ icon: Icon, badge, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 36, height: 36, borderRadius: 10,
        border: `1px solid ${hov ? C.accentDim : C.border}`,
        background: C.card, color: hov ? C.text : C.textMuted,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", position: "relative", transition: "all 0.15s",
      }}>
      <Icon size={16} strokeWidth={2} />
      {badge && <span style={{ position: "absolute", top: 7, right: 7, width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 6px ${C.accent}` }} />}
    </button>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ activeSectionId, onNavigate, onHome }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        width: 234, flexShrink: 0,
        background: C.surface, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
      {/* Logo */}
      <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "center" }}>
        <img src="/workspace_logo.png" alt="Workspace"
          style={{ height: 32, width: "auto", mixBlendMode: "screen", filter: "brightness(1.15) contrast(1.05)", userSelect: "none", pointerEvents: "none" }} />
      </div>

      {/* Overview link */}
      <div style={{ padding: "10px 10px 4px" }}>
        {(() => {
          const active = !activeSectionId;
          return (
            <motion.button whileHover={{ x: active ? 0 : 2 }} whileTap={{ scale: 0.97 }} onClick={onHome}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, width: "100%", textAlign: "left", cursor: active ? "default" : "pointer", border: active ? `1px solid ${C.accent}35` : "1px solid transparent", background: active ? `${C.accent}10` : "transparent", transition: "all 0.15s" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${C.accent}${active ? "22" : "14"}`, border: `1px solid ${C.accent}${active ? "38" : "22"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LayoutDashboard size={16} color={C.accent} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.accent : C.textMuted }}>Overview</p>
                {active && <p style={{ margin: "1px 0 0", fontFamily: font, fontSize: 10, color: C.accent, fontWeight: 600, opacity: 0.75 }}>Home</p>}
              </div>
              {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, boxShadow: `0 0 8px ${C.accent}`, flexShrink: 0 }} />}
            </motion.button>
          );
        })()}
      </div>

      <div style={{ margin: "4px 18px", borderTop: `1px solid ${C.border}` }} />

      {/* Section items */}
      <div style={{ padding: "4px 10px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {SECTIONS.map(s => {
          const active = s.id === activeSectionId;
          return (
            <motion.button key={s.id} whileHover={{ x: active ? 0 : 2 }} whileTap={{ scale: 0.97 }}
              onClick={() => !active && onNavigate(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, border: active ? `1px solid ${s.accentColor}35` : "1px solid transparent", background: active ? `${s.accentColor}10` : "transparent", cursor: active ? "default" : "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${s.accentColor}${active ? "22" : "14"}`, border: `1px solid ${s.accentColor}${active ? "38" : "22"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={16} color={s.accentColor} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? s.accentColor : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</p>
                {active && <p style={{ margin: "1px 0 0", fontFamily: font, fontSize: 10, color: s.accentColor, fontWeight: 600, opacity: 0.75 }}>You are here</p>}
              </div>
              {active
                ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.accentColor, boxShadow: `0 0 8px ${s.accentColor}`, flexShrink: 0 }} />
                : s.badge && <span style={{ fontSize: 10, fontWeight: 700, color: s.accentColor, background: `${s.accentColor}18`, border: `1px solid ${s.accentColor}30`, borderRadius: 20, padding: "2px 7px", fontFamily: font, flexShrink: 0 }}>{s.badge}</span>
              }
            </motion.button>
          );
        })}
      </div>
    </motion.aside>
  );
}

// ─── Desktop Section Chip Bar with scroll arrows ───────────────────────────────
function DesktopSectionBar({ activeSectionId, onNavigate, onHome }) {
  const scrollRef = useRef(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateArrows); ro.disconnect(); };
  }, [updateArrows]);

  const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  const ArrowBtn = ({ dir, enabled }) => (
    <motion.button whileTap={{ scale: 0.88 }} onClick={() => scroll(dir)}
      style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: `1px solid ${enabled ? C.border : C.border + "44"}`, background: enabled ? C.card : "transparent", color: enabled ? C.textMuted : C.textDim, display: "flex", alignItems: "center", justifyContent: "center", cursor: enabled ? "pointer" : "default", transition: "all 0.15s", opacity: enabled ? 1 : 0.3 }}>
      {dir < 0 ? <ChevronLeft size={13} strokeWidth={2.2} /> : <ChevronRight size={13} strokeWidth={2.2} />}
    </motion.button>
  );

  const chipStyle = (active, color) => ({
    flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99,
    border: `1px solid ${active ? color + "60" : C.border}`,
    background: active ? `${color}18` : C.card,
    cursor: "pointer", transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <ArrowBtn dir={-1} enabled={canLeft} />

      {/* Overview chip */}
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome} style={chipStyle(!activeSectionId, C.accent)}>
        <LayoutDashboard size={12} color={!activeSectionId ? C.accent : C.textMuted} strokeWidth={1.9} />
        <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: !activeSectionId ? C.accent : C.textMuted, whiteSpace: "nowrap" }}>Overview</span>
      </motion.button>

      {/* Scrollable section chips */}
      <div ref={scrollRef} style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", flex: 1 }}>
        {SECTIONS.map(s => {
          const active = s.id === activeSectionId;
          return (
            <motion.button key={s.id} whileTap={{ scale: 0.93 }} onClick={() => onNavigate(s.id)} style={chipStyle(active, s.accentColor)}>
              <s.icon size={12} color={active ? s.accentColor : C.textMuted} strokeWidth={1.9} />
              <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: active ? s.accentColor : C.textMuted, whiteSpace: "nowrap" }}>{s.label}</span>
              {s.badge && !active && (
                <span style={{ fontSize: 9, fontWeight: 800, color: s.accentColor, background: `${s.accentColor}22`, border: `1px solid ${s.accentColor}35`, borderRadius: 99, padding: "1px 5px", fontFamily: font }}>{s.badge}</span>
              )}
            </motion.button>
          );
        })}
      </div>

      <ArrowBtn dir={1} enabled={canRight} />
    </div>
  );
}

// ─── Mobile Section Chips ─────────────────────────────────────────────────────
function MobileSectionChips({ activeSectionId, onNavigate, onHome }) {
  const chipStyle = (active, color) => ({
    flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 99,
    border: `1px solid ${active ? color + "60" : C.border}`,
    background: active ? `${color}18` : C.card,
    cursor: "pointer", transition: "all 0.15s",
  });
  return (
    <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", padding: "0 2px" }}>
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome} style={chipStyle(!activeSectionId, C.accent)}>
        <LayoutDashboard size={12} color={!activeSectionId ? C.accent : C.textMuted} strokeWidth={1.9} />
        <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: !activeSectionId ? C.accent : C.textMuted, whiteSpace: "nowrap" }}>Overview</span>
      </motion.button>
      {SECTIONS.map(s => {
        const active = s.id === activeSectionId;
        return (
          <motion.button key={s.id} whileTap={{ scale: 0.93 }} onClick={() => onNavigate(s.id)} style={chipStyle(active, s.accentColor)}>
            <s.icon size={12} color={active ? s.accentColor : C.textMuted} strokeWidth={1.9} />
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: active ? s.accentColor : C.textMuted, whiteSpace: "nowrap" }}>{s.label}</span>
            {s.badge && !active && (
              <span style={{ fontSize: 9, fontWeight: 800, color: s.accentColor, background: `${s.accentColor}22`, border: `1px solid ${s.accentColor}35`, borderRadius: 99, padding: "1px 5px", fontFamily: font }}>{s.badge}</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Mobile Top Bar ───────────────────────────────────────────────────────────
function MobileTopBar({ activeSectionId, accent }) {
  const activeSection = SECTIONS.find(s => s.id === activeSectionId);
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f4`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 56, flexShrink: 0 }}>
      <img src="/workspace_logo.png" alt="Workspace" style={{ height: 28, width: "auto", mixBlendMode: "screen", filter: "brightness(1.15) contrast(1.05)", userSelect: "none", display: "block", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {activeSection ? (
            <motion.span key={activeSectionId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={fadeTrans}
              style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: accent || C.text, letterSpacing: "-0.02em", display: "block" }}>
              {activeSection.label}
            </motion.span>
          ) : (
            <motion.span key="overview" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={fadeTrans}
              style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: C.accentLight, letterSpacing: "-0.02em", display: "block" }}>
              Overview
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <IconBtn icon={Search} />
        <IconBtn icon={Bell} badge />
      </div>
    </div>
  );
}

// ─── Activity Item ────────────────────────────────────────────────────────────
function ActivityItem({ icon: Icon, color, label, sub, time, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer", opacity: hov ? 0.75 : 1, transition: "opacity 0.15s" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} color={color} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 12, color: C.textMuted }}>{sub}</p>
      </div>
      <span style={{ fontFamily: font, fontSize: 11, color: C.textDim, flexShrink: 0, paddingTop: 2 }}>{time}</span>
    </div>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ symbol, direction, rr, status, entry, sl, tp, color }) {
  const dirColor = direction === "long" ? C.green : C.red;
  return (
    <div style={{ background: C.card, border: `1px solid ${color}30`, borderRadius: 14, padding: "13px 15px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>{symbol}</span>
          <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: dirColor, background: `${dirColor}18`, border: `1px solid ${dirColor}30`, borderRadius: 6, padding: "2px 7px" }}>{direction.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: status === "active" ? C.green : C.amber, background: status === "active" ? C.greenDim : `${C.amber}15`, border: `1px solid ${status === "active" ? C.green : C.amber}30`, borderRadius: 6, padding: "3px 8px" }}>
          {status === "active" ? "● Active" : "⏳ In Progress"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        {[["Entry", entry, C.textMuted], ["SL", sl, C.red], ["TP", tp, C.green]].map(([lbl, val, col]) => (
          <div key={lbl}>
            <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</p>
            <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 13, fontWeight: 700, color: col }}>{val}</p>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>RR</p>
          <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 13, fontWeight: 700, color: color }}>{rr}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section Preview Card ─────────────────────────────────────────────────────
function PreviewCard({ section, onClick }) {
  const [hov, setHov] = useState(false);
  const post = PREVIEW_POSTS[section.id];
  if (!post) return null;
  const tagColor = post.tag === "Live" ? C.red : section.accentColor;
  return (
    <motion.div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: hov ? C.cardHover : C.card, border: `1px solid ${hov ? section.accentColor + "44" : C.border}`, borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)", boxShadow: hov ? `0 4px 24px ${section.glowColor}` : "none", transform: hov ? "translateY(-2px)" : "translateY(0)" }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${section.accentColor}, transparent)` }} />
      <div style={{ padding: "13px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: `${section.accentColor}20`, border: `1px solid ${section.accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <section.icon size={12} color={section.accentColor} strokeWidth={1.8} />
            </div>
            <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: section.accentColor, textTransform: "uppercase", letterSpacing: "0.07em" }}>{section.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tagColor, background: `${tagColor}18`, border: `1px solid ${tagColor}30`, borderRadius: 20, padding: "2px 8px", fontFamily: font }}>{post.tag}</span>
            <motion.div animate={{ x: hov ? 3 : 0 }} style={{ color: C.textDim }}><ArrowRight size={13} strokeWidth={2} /></motion.div>
          </div>
        </div>
        <h3 style={{ margin: "0 0 4px", fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{post.title}</h3>
        <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.excerpt}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{post.author}</span>
          <span style={{ width: 2, height: 2, borderRadius: "50%", background: C.textDim }} />
          <span style={{ fontFamily: font, fontSize: 11, color: post.timestamp === "Live now" ? C.red : C.textDim }}>{post.timestamp}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Overview Content ─────────────────────────────────────────────────────────
function OverviewContent({ onNavigate, isDesktop: desktop }) {
  const pad = desktop ? "0 28px 48px" : "0 18px 36px";
  const TRADES = [
    { symbol: "XAUUSD", direction: "long",  rr: "1:3.2", status: "active",      entry: "2310.50", sl: "2298.00", tp: "2349.00", color: "#7c4dff" },
    { symbol: "DXY",    direction: "short", rr: "1:2.5", status: "in_progress", entry: "104.200", sl: "104.800", tp: "102.700", color: "#22d3a0" },
  ];
  const ACTIVITY = [
    { icon: FileText,     color: "#22d3a0", label: "Week 20 Recap posted",          sub: "Alex H. · Recaps & Updates",  time: "1h ago",    section: "recaps"         },
    { icon: CalendarDays, color: "#7c4dff", label: "New planning post: DXY Outlook",sub: "Alex H. · Planning",           time: "2h ago",    section: "planning"       },
    { icon: Megaphone,    color: "#f59e0b", label: "Room schedule updated for May", sub: "Admin · Announcements",        time: "Yesterday", section: "announcements"  },
    { icon: Radio,        color: C.red,     label: "Live session started",           sub: "Alex H. · Rooms",              time: "Live",      section: "rooms"          },
    { icon: MessageSquare,color: "#e879f9", label: "12 new messages in Community",  sub: "Community's Chat",             time: "Just now",  section: "community"      },
  ];

  return (
    <div style={{ maxWidth: desktop ? 820 : "none", margin: "0 auto" }}>
      {/* Stat pills */}
      <div style={{ display: "flex", gap: 10, padding: desktop ? "20px 28px 14px" : "16px 18px 10px", overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { icon: TrendingUp, label: "Active Posts",  value: "24",  color: C.green       },
          { icon: Activity,   label: "Updates Today", value: "7",   color: C.amber       },
          { icon: Zap,        label: "Live Rooms",    value: "3",   color: C.blue        },
          { icon: Users,      label: "Online",        value: "128", color: C.accentLight },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
            <stat.icon size={14} color={stat.color} strokeWidth={2} />
            <div>
              <p style={{ margin: 0, fontFamily: font, fontSize: 19, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 11, color: C.textMuted }}>{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 26 }}>

        {/* Active Trade Activity */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Active Trade Activity</p>
            <button onClick={() => onNavigate("planning")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 12, color: C.accentLight, fontWeight: 600 }}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TRADES.map((t, i) => (
              <motion.div key={t.symbol} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.07 }}>
                <TradeCard {...t} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent Activity</p>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "0 16px" }}>
            {ACTIVITY.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <ActivityItem {...a} onClick={() => onNavigate(a.section)} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Latest Updates */}
        <section>
          <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Latest from Each Section</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SECTIONS.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 + i * 0.07 }}>
                <PreviewCard section={s} onClick={() => onNavigate(s.id)} />
              </motion.div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── Community Chat ───────────────────────────────────────────────────────────
function CommunityChatContent({ section }) {
  const [messages, setMessages] = useState([
    { id: 1, author: "Marco V.", text: "Just closed a great XAUUSD long! +120 pips 🔥", time: "2m ago",   avatar: "M" },
    { id: 2, author: "Sarah K.", text: "Nice! I was watching that setup too 😅",          time: "1m ago",   avatar: "S" },
    { id: 3, author: "Alex H.",  text: "Great execution Marco. Clean setup off the 4H.", time: "just now", avatar: "A", isHost: true },
  ]);
  const [msg, setMsg] = useState("");
  const ac = section.accentColor;

  const send = () => {
    if (!msg.trim()) return;
    setMessages(p => [...p, { id: Date.now(), author: "You", text: msg.trim(), time: "just now", avatar: "Y" }]);
    setMsg("");
  };

  return (
    <>
      <div style={{ padding: "8px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
        <span style={{ fontFamily: font, fontSize: 12, color: C.green, fontWeight: 600 }}>128 members online</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${ac}44, ${ac}22)`, border: `1px solid ${ac}40`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{m.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{m.author}</span>
                {m.isHost && <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.accentLight, background: `${C.accent}18`, border: `1px solid ${C.accent}28`, borderRadius: 4, padding: "1px 5px" }}>Host</span>}
                <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{m.time}</span>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "4px 16px 16px 16px", padding: "10px 14px", display: "inline-block", maxWidth: "100%" }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>{m.text}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div style={{ padding: "12px 18px 20px", borderTop: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(16px)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: C.card, border: `1px solid ${msg.trim() ? ac + "55" : C.border}`, borderRadius: 24, padding: "0 16px", transition: "border-color 0.2s" }}>
          <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Message the community…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 14, padding: "11px 0" }} />
        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={send}
          style={{ width: 40, height: 40, borderRadius: "50%", background: msg.trim() ? `linear-gradient(135deg, ${ac}, ${ac}cc)` : C.border, border: "none", color: msg.trim() ? "#fff" : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: msg.trim() ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}>
          <ArrowRight size={17} strokeWidth={2.5} />
        </motion.button>
      </div>
    </>
  );
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
function RoomsContent() {
  const rooms = [
    { id: 1, name: "Pre-Market Session", host: "Alex H.", live: true,  members: 34, scheduled: null       },
    { id: 2, name: "Trade Review — EU",  host: "Alex H.", live: true,  members: 18, scheduled: null       },
    { id: 3, name: "Q&A with Alex",      host: "Alex H.", live: false, members: 0,  scheduled: "3:00 PM"  },
  ];
  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      {rooms.map((r, i) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
          style={{ background: C.card, border: `1px solid ${r.live ? "#60a5fa40" : C.border}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
            {r.live
              ? <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}30`, borderRadius: 6, padding: "3px 8px" }}>🔴 LIVE · {r.members}</span>
              : <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.border, borderRadius: 6, padding: "3px 8px" }}>{r.scheduled}</span>}
          </div>
          <span style={{ fontFamily: font, fontSize: 12, color: C.textMuted }}>Hosted by {r.host}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeSectionId, setActiveSectionId] = useState(null); // null = Overview
  const [direction,       setDirection]       = useState(1);
  const [isHost,          setIsHost]          = useState(true);
  const [openThreadId,    setOpenThreadId]    = useState(null);
  const isDesktop                             = useIsDesktop();

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const navigate = useCallback((sectionId) => {
    if (sectionId === activeSectionId) return;
    setOpenThreadId(null);
    setDirection(activeSectionId === null ? 1 : sectionId ? 1 : -1);
    setActiveSectionId(sectionId);
  }, [activeSectionId]);

  const navigateTo = useCallback((sectionId, threadId) => {
    setOpenThreadId(threadId || null);
    setDirection(1);
    setActiveSectionId(sectionId);
  }, []);

  const goHome = useCallback(() => {
    if (!activeSectionId) return;
    setOpenThreadId(null);
    setDirection(-1);
    setActiveSectionId(null);
  }, [activeSectionId]);

  const activeSection = SECTIONS.find(s => s.id === activeSectionId) || null;
  const accentColor   = activeSection?.accentColor || C.accent;

  function renderContent() {
    if (!activeSectionId)            return <OverviewContent onNavigate={navigate} isDesktop={isDesktop} />;
    if (activeSectionId === "planning")      return <Planning      section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} />;
    if (activeSectionId === "recaps")        return <Recaps        section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} />;
    if (activeSectionId === "community")     return <CommunityChatContent section={activeSection} />;
    if (activeSectionId === "rooms")         return <RoomsContent />;
    return null;
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", overflow: "hidden" }}>
        <Sidebar activeSectionId={activeSectionId} onNavigate={navigate} onHome={goHome} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar with chip scroller */}
          <div style={{ flexShrink: 0, zIndex: 30, background: `${C.surface}f4`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DesktopSectionBar activeSectionId={activeSectionId} onNavigate={navigate} onHome={goHome} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <IconBtn icon={Search} />
              <IconBtn icon={Bell} badge />
              {/* Role toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px" }}>
                <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isHost ? "Host" : "Member"}</span>
                <button onClick={() => setIsHost(h => !h)} style={{ width: 34, height: 18, borderRadius: 9, border: "none", background: isHost ? C.accent : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <motion.div animate={{ x: isHost ? 16 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2 }} />
                </button>
              </div>
            </div>
          </div>

          {/* Section sub-header (shows when inside a section) */}
          <AnimatePresence>
            {activeSection && (
              <motion.div key={activeSection.id + "_hdr"}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={fadeTrans}
                style={{ flexShrink: 0, padding: "13px 24px", borderBottom: `1px solid ${C.border}`, background: `${C.surface}cc`, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${accentColor}20`, border: `1px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <activeSection.icon size={19} color={accentColor} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>{activeSection.label}</h2>
                  <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>{activeSection.subtitle}</p>
                </div>
                <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isHost ? C.accentLight : C.textMuted, background: isHost ? `${C.accent}18` : `${C.border}80`, border: `1px solid ${isHost ? C.accent + "30" : C.border}`, borderRadius: 6, padding: "3px 8px" }}>
                  {isHost ? "Host" : "Member"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated content area */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <AnimatePresence mode="sync" custom={direction}>
              <motion.div key={activeSectionId ?? "overview"} custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={springTrans}
                style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, height: "100vh", background: C.surface, position: "relative", overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 120, borderRadius: "50%", background: `radial-gradient(ellipse, ${C.accentDim}55 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

        {/* Top bar */}
        <MobileTopBar activeSectionId={activeSectionId} accent={accentColor} />

        {/* Chip strip — always visible */}
        <div style={{ flexShrink: 0, padding: "10px 18px", borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(16px)", zIndex: 20 }}>
          <MobileSectionChips activeSectionId={activeSectionId} onNavigate={navigate} onHome={goHome} />
        </div>

        {/* Overview greeting (collapses when switching sections) */}
        <AnimatePresence>
          {!activeSectionId && (
            <motion.div key="greeting"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              style={{ flexShrink: 0, overflow: "hidden" }}>
              <div style={{ padding: "18px 18px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <Sparkles size={13} color={C.accentLight} />
                  <span style={{ color: C.accentLight, fontFamily: font, fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Overview</span>
                </div>
                <h1 style={{ margin: 0, color: C.text, fontFamily: font, fontSize: 23, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                  Good morning,{" "}
                  <span style={{ background: `linear-gradient(90deg, ${C.accentLight}, #c4b5fd)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>team.</span>
                </h1>
                <p style={{ margin: "4px 0 0", color: C.textMuted, fontFamily: font, fontSize: 13 }}>4 new updates since your last visit</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role toggle (dev tool, fixed bottom-right) */}
        <div style={{ position: "fixed", bottom: 20, right: 16, zIndex: 9998, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 4px 4px 10px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isHost ? "Host" : "Member"}</span>
          <button onClick={() => setIsHost(h => !h)} style={{ width: 34, height: 18, borderRadius: 9, border: "none", background: isHost ? C.accent : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <motion.div animate={{ x: isHost ? 16 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2 }} />
          </button>
        </div>

        {/* Main animated content */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
          <AnimatePresence mode="sync" custom={direction}>
            <motion.div key={activeSectionId ?? "overview"} custom={direction} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={springTrans}
              style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
