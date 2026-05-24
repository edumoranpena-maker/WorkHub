import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, FileText, Megaphone, Hash, MessageSquare,
  Bell, Search, ChevronLeft, ChevronRight, ArrowRight,
  Users, BarChart2, TrendingUp, TrendingDown, Star,
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
  gold:        "#d4a843",
  goldLight:   "#f0c866",
  blue:        "#4fa3ff",
  red:         "#ff4f6a",
  orange:      "#f97316",
};
const font = "'DM Sans', sans-serif";

// ─── Section registry ─────────────────────────────────────────────────────────
// null = Perfil (home)
const SECTIONS = [
  { id: "planning",      label: "Planning",       icon: CalendarDays,  subtitle: "Trade plans & market analysis",    accentColor: "#7c4dff", glowColor: "rgba(124,77,255,0.18)",  badge: "4 new"  },
  { id: "recaps",        label: "Updates",        icon: FileText,      subtitle: "Weekly summaries & progress",      accentColor: "#22d3a0", glowColor: "rgba(34,211,160,0.15)",  badge: "1 new"  },
  { id: "announcements", label: "Announcements",  icon: Megaphone,     subtitle: "Official updates from leadership", accentColor: "#f59e0b", glowColor: "rgba(245,158,11,0.15)",  badge: null     },
  { id: "metrics",       label: "Metrics",        icon: BarChart2,     subtitle: "Performance & trade stats",        accentColor: "#22d3a0", glowColor: "rgba(34,211,160,0.15)",  badge: null     },
  { id: "rooms",         label: "Rooms",          icon: Hash,          subtitle: "Live group sessions & channels",   accentColor: "#60a5fa", glowColor: "rgba(96,165,250,0.15)",  badge: "2 live" },
  { id: "community",     label: "Community Chat", icon: MessageSquare, subtitle: "Open chat for all members",        accentColor: "#e879f9", glowColor: "rgba(232,121,249,0.15)", badge: "12 new" },
  { id: "reviews",       label: "Reviews",        icon: Star,          subtitle: "Member reviews & testimonials",    accentColor: "#d4a843", glowColor: "rgba(212,168,67,0.15)",  badge: null     },
];

// Latest post previews per section (for Perfil feed)
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
      style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${hov ? C.accentDim : C.border}`, background: C.card, color: hov ? C.text : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", transition: "all 0.15s" }}>
      <Icon size={16} strokeWidth={2} />
      {badge && <span style={{ position: "absolute", top: 7, right: 7, width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 6px ${C.accent}` }} />}
    </button>
  );
}

// ─── Premium Profile Card ─────────────────────────────────────────────────────
function ProfileCard({ onNavigate }) {
  const [followed,   setFollowed]   = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "22px 18px 0" }}>

      {/* ── Row: avatar column + divider + bio ── */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

        {/* Left column: avatar ring + name/handle/verified below */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {/* Avatar with orange story ring — clickable to view announcements stories */}
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => onNavigate && onNavigate("announcements")}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: `conic-gradient(${C.orange} 0deg, #fbbf24 120deg, ${C.orange} 240deg, #fbbf24 360deg)`,
              padding: 3,
              boxShadow: `0 0 18px ${C.orange}55, 0 0 6px ${C.orange}40`,
            }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `3px solid ${C.card}`, overflow: "hidden", background: `linear-gradient(135deg, ${C.accentDim}, #1a0a3a)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: C.accentLight, letterSpacing: "-0.02em" }}>A</span>
              </div>
            </div>
            {/* Live dot */}
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, borderRadius: "50%", background: C.green, border: `2px solid ${C.card}`, boxShadow: `0 0 8px ${C.green}` }} />
          </div>

          {/* Name + verified + handle — below the avatar */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 2 }}>
              <h2 style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>Alex Herrera</h2>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 8, color: "#fff" }}>✓</span>
              </div>
            </div>
            <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.accentLight, fontWeight: 600, letterSpacing: "0.01em" }}>@alexherrera.trades</p>
            {/* Rating */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <div style={{ display: "flex", gap: 1 }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={9} color={C.gold} fill={C.gold} />)}
              </div>
              <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.goldLight }}>4.9</span>
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, background: `linear-gradient(to bottom, transparent, ${C.border} 20%, ${C.border} 80%, transparent)`, flexShrink: 0, alignSelf: "stretch" }} />

        {/* Bio + stats — right of divider */}
        <div style={{ flex: 1, paddingTop: 2 }}>
          <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            Trader & educator — 6+ years in FX & commodities. Sharing live setups, weekly recaps & real-time analysis.{" "}
            <span style={{ color: C.accentLight, fontWeight: 600 }}>XAUUSD · DXY · EURUSD</span>
          </p>

          {/* Mini stats row — Followers · Trades · Winrate · Exp. Value */}
          <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            {[["12.4k", "Followers"], ["147", "Trades"], ["68%", "Winrate"], ["2.8R", "Exp. Value"]].map(([val, lbl]) => (
              <div key={lbl}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, fontWeight: 800, color: C.text }}>{val}</p>
                <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textMuted }}>{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", gap: 9, marginTop: 18, paddingBottom: 18 }}>

        {/* Follow — platform purple */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFollowed(f => !f)}
          style={{
            flex: 1, height: 34, borderRadius: 22, border: "none", cursor: "pointer",
            fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.01em",
            background: followed
              ? "transparent"
              : `linear-gradient(135deg, ${C.accent} 0%, #5c2fff 100%)`,
            border: followed ? `1.5px solid ${C.accent}` : "none",
            color: followed ? C.accent : "#fff",
            boxShadow: followed ? "none" : `0 4px 18px ${C.accent}50`,
            transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
          }}>
          {followed ? "Following" : "Follow"}
        </motion.button>

        {/* Subscribe — gold exclusive */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSubscribed(s => !s)}
          style={{
            flex: 1, height: 34, borderRadius: 22, cursor: "pointer",
            fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
            background: subscribed
              ? "transparent"
              : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldLight} 50%, ${C.gold} 100%)`,
            border: subscribed ? `1.5px solid ${C.gold}` : "none",
            color: subscribed ? C.gold : "#1a0f00",
            boxShadow: subscribed ? "none" : `0 4px 20px ${C.gold}45`,
            transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
          }}>
          {subscribed ? "Subscribed" : "Subscribe"}
        </motion.button>

        {/* Message — modern blue with text */}
        <motion.button whileTap={{ scale: 0.95 }}
          style={{
            flex: 1, height: 34, borderRadius: 22, border: "none", cursor: "pointer",
            fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.01em",
            background: `linear-gradient(135deg, ${C.blue} 0%, #2563eb 100%)`,
            color: "#fff",
            boxShadow: `0 4px 16px ${C.blue}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          Message
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Section Chips ─────────────────────────────────────────────────────────────
// Shared logic, used by both mobile and desktop chip bars
function SectionChips({ activeSectionId, onNavigate, onHome, scrollRef }) {
  const chipStyle = (active, color) => ({
    flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
    padding: "7px 14px", borderRadius: 99,
    border: `1px solid ${active ? color + "60" : C.border}`,
    background: active ? `${color}18` : "transparent",
    cursor: "pointer", transition: "all 0.15s",
  });

  return (
    <div ref={scrollRef} style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "0 1px" }}>
      {/* Perfil chip (home) */}
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome} style={chipStyle(!activeSectionId, C.accent)}>
        <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: !activeSectionId ? C.accent : C.textMuted, whiteSpace: "nowrap" }}>Perfil</span>
      </motion.button>

      {SECTIONS.map(s => {
        const active = s.id === activeSectionId;
        return (
          <motion.button key={s.id} whileTap={{ scale: 0.93 }} onClick={() => onNavigate(s.id)} style={chipStyle(active, s.accentColor)}>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: active ? s.accentColor : C.textMuted, whiteSpace: "nowrap" }}>{s.label}</span>
            {s.badge && !active && (
              <span style={{ fontSize: 9, fontWeight: 800, color: s.accentColor, background: `${s.accentColor}22`, border: `1px solid ${s.accentColor}35`, borderRadius: 99, padding: "1px 5px", fontFamily: font }}>{s.badge}</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Desktop Chip Bar with arrow controls ─────────────────────────────────────
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <ArrowBtn dir={-1} enabled={canLeft} />
      <SectionChips activeSectionId={activeSectionId} onNavigate={onNavigate} onHome={onHome} scrollRef={scrollRef} />
      <ArrowBtn dir={1} enabled={canRight} />
    </div>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ activeSectionId, onNavigate, onHome }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ width: 234, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>

      <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "center" }}>
        <img src="/workspace_logo.png" alt="Workspace" style={{ height: 32, width: "auto", mixBlendMode: "screen", filter: "brightness(1.15) contrast(1.05)", userSelect: "none", pointerEvents: "none" }} />
      </div>

      <div style={{ padding: "10px 10px 4px" }}>
        {(() => {
          const active = !activeSectionId;
          return (
            <motion.button whileHover={{ x: active ? 0 : 2 }} whileTap={{ scale: 0.97 }} onClick={onHome}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, width: "100%", textAlign: "left", cursor: active ? "default" : "pointer", border: active ? `1px solid ${C.accent}35` : "1px solid transparent", background: active ? `${C.accent}10` : "transparent", transition: "all 0.15s" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${C.accent}${active ? "22" : "14"}`, border: `1px solid ${C.accent}${active ? "38" : "22"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={16} color={C.accent} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.accent : C.textMuted }}>Perfil</p>
                {active && <p style={{ margin: "1px 0 0", fontFamily: font, fontSize: 10, color: C.accent, fontWeight: 600, opacity: 0.75 }}>Home</p>}
              </div>
              {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, boxShadow: `0 0 8px ${C.accent}`, flexShrink: 0 }} />}
            </motion.button>
          );
        })()}
      </div>

      <div style={{ margin: "4px 18px", borderTop: `1px solid ${C.border}` }} />

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

// ─── Mobile Top Bar ───────────────────────────────────────────────────────────
function MobileTopBar({ onHome, profileName }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 10, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f4`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 52, flexShrink: 0 }}>
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome}
        style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 8px 4px 2px", borderRadius: 8, color: C.accentLight, flexShrink: 0 }}>
        <ChevronLeft size={16} strokeWidth={2.4} color={C.accentLight} />
        <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.accentLight }}>Home</span>
      </motion.button>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <span style={{ fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileName}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <IconBtn icon={Search} />
        <IconBtn icon={Bell} badge />
      </div>
    </div>
  );
}

// ─── Latest Trades Mini Card ──────────────────────────────────────────────────
function LatestTradesCard({ onNavigate }) {
  const trades = [
    { symbol: "XAUUSD", pnl: "+3.2R",  win: true  },
    { symbol: "DXY",    pnl: "-1.0R",  win: false },
    { symbol: "EURUSD", pnl: "+2.5R",  win: true  },
    { symbol: "GBPUSD", pnl: "+1.8R",  win: true  },
  ];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 15px", flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onNavigate("metrics")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Latest Trades</span>
        <span style={{ fontFamily: font, fontSize: 10, color: C.accentLight, fontWeight: 600 }}>→ Metrics</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {trades.map((t, i) => (
          <motion.div key={t.symbol} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 + i * 0.05 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {t.win
                ? <TrendingUp  size={12} color={C.green} strokeWidth={2.2} />
                : <TrendingDown size={12} color={C.red}  strokeWidth={2.2} />}
              <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{t.symbol}</span>
            </div>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: t.win ? C.green : C.red }}>{t.pnl}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Reviews Mini Card ────────────────────────────────────────────────────────
function ReviewsCard({ onVerMas }) {
  const reviews = [
    { author: "Marco V.", text: "Best trading community I've joined. Alex's analysis is crystal clear.", stars: 5 },
    { author: "Sarah K.", text: "The weekly recaps alone are worth the subscription. Incredible value.", stars: 5 },
  ];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 15px", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Reviews</span>
        <div style={{ display: "flex" }}>
          {[...Array(5)].map((_, i) => <Star key={i} size={9} color={C.gold} fill={C.gold} />)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reviews.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.07 }}>
            <p style={{ margin: "0 0 3px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.text }}>{r.author}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textMuted, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.text}</p>
          </motion.div>
        ))}
      </div>
      <motion.div whileHover={{ x: 2 }} onClick={onVerMas} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, cursor: "pointer" }}>
        <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.accentLight }}>Ver más</span>
        <ArrowRight size={12} color={C.accentLight} strokeWidth={2.5} />
      </motion.div>
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
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: hov ? C.cardHover : C.card, border: `1px solid ${hov ? section.accentColor + "44" : C.border}`, borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)", boxShadow: hov ? `0 4px 24px ${section.glowColor}` : "none", transform: hov ? "translateY(-2px)" : "translateY(0)" }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${section.accentColor}, transparent)` }} />
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: `${section.accentColor}20`, border: `1px solid ${section.accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <section.icon size={11} color={section.accentColor} strokeWidth={1.8} />
            </div>
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: section.accentColor, textTransform: "uppercase", letterSpacing: "0.07em" }}>{section.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tagColor, background: `${tagColor}18`, border: `1px solid ${tagColor}30`, borderRadius: 20, padding: "2px 7px", fontFamily: font }}>{post.tag}</span>
            <motion.div animate={{ x: hov ? 2 : 0 }} style={{ color: C.textDim }}><ArrowRight size={12} strokeWidth={2} /></motion.div>
          </div>
        </div>
        <h3 style={{ margin: "0 0 3px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{post.title}</h3>
        <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.excerpt}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{post.author}</span>
          <span style={{ width: 2, height: 2, borderRadius: "50%", background: C.textDim }} />
          <span style={{ fontFamily: font, fontSize: 11, color: post.timestamp === "Live now" ? C.red : C.textDim }}>{post.timestamp}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Badges Museum ────────────────────────────────────────────────────────────
const BADGES = [
  { id: "b1",  emoji: "🏆", label: "Top Trader",       sub: "Q1 2025",          color: C.gold    },
  { id: "b2",  emoji: "🎯", label: "Sharpshooter",     sub: "10 TP hits",       color: "#7c4dff" },
  { id: "b3",  emoji: "🔥", label: "Win Streak",       sub: "7 wins in a row",  color: C.red     },
  { id: "b4",  emoji: "💎", label: "Diamond Member",   sub: "12 months",        color: "#60a5fa" },
  { id: "b5",  emoji: "📈", label: "Bull Run",         sub: "5 longs closed",   color: C.green   },
  { id: "b6",  emoji: "🧠", label: "Analyst",          sub: "50 posts",         color: "#e879f9" },
  { id: "b7",  emoji: "⚡", label: "Fast Learner",     sub: "Week 1 complete",  color: C.amber   },
  { id: "b8",  emoji: "🌟", label: "Community Star",   sub: "100 reactions",    color: C.goldLight },
];

function BadgesMuseum() {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Badges</p>
        <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{BADGES.length} earned</span>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", padding: "2px 1px 4px" }}>
        {BADGES.map((b, i) => (
          <motion.div key={b.id}
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
            whileHover={{ y: -3, boxShadow: `0 8px 24px ${b.color}35` }}
            style={{ flexShrink: 0, width: 80, background: C.card, border: `1px solid ${b.color}30`, borderRadius: 16, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "default", transition: "box-shadow 0.2s" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${b.color}18`, border: `1.5px solid ${b.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {b.emoji}
            </div>
            <p style={{ margin: 0, fontFamily: font, fontSize: 10, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.3 }}>{b.label}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 9, color: b.color, fontWeight: 600, textAlign: "center" }}>{b.sub}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Perfil Content (replaces old OverviewContent) ───────────────────────────
function PerfilContent({ onNavigate }) {
  // Sections to show preview cards for (skip metrics — no PREVIEW_POSTS for it)
  const feedSections = SECTIONS.filter(s => PREVIEW_POSTS[s.id]);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── Two-column cards row: Latest Trades + Reviews ── */}
      <div style={{ padding: "18px 18px 0", display: "flex", gap: 12 }}>
        <LatestTradesCard onNavigate={onNavigate} />
        <ReviewsCard onVerMas={() => onNavigate("reviews")} />
      </div>

      {/* ── Latest post from each section ── */}
      <div style={{ padding: "22px 18px 0" }}>
        <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Latest from Sections</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {feedSections.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06 }}>
              <PreviewCard section={s} onClick={() => onNavigate(s.id)} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Badges Museum ── */}
      <div style={{ padding: "26px 18px 0" }}>
        <BadgesMuseum />
      </div>
    </div>
  );
}

// ─── Reviews Section ─────────────────────────────────────────────────────────
const ALL_REVIEWS = [
  { author: "Marco V.",   text: "Best trading community I've joined. Alex's analysis is crystal clear.",             stars: 5, date: "May 2025"   },
  { author: "Sarah K.",   text: "The weekly recaps alone are worth the subscription. Incredible value.",             stars: 5, date: "Apr 2025"   },
  { author: "Lena M.",    text: "Alex explains every trade step by step. I went from losing to consistent.",         stars: 5, date: "Apr 2025"   },
  { author: "Tom R.",     text: "The live sessions are gold. Real-time setups with real results.",                   stars: 5, date: "Mar 2025"   },
  { author: "James P.",   text: "Community is super supportive. Everyone shares knowledge freely.",                  stars: 4, date: "Mar 2025"   },
  { author: "Elena W.",   text: "Announcements keep you ahead of the market. Never miss a setup.",                  stars: 5, date: "Feb 2025"   },
  { author: "Carlos M.",  text: "Worth every penny. My win rate has gone from 40% to 65% in 3 months.",             stars: 5, date: "Feb 2025"   },
  { author: "Diana L.",   text: "Alex is transparent and honest about every trade. Rare quality.",                  stars: 5, date: "Jan 2025"   },
];

function ReviewsContent({ onBack }) {
  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 14 }}>
        <motion.button whileTap={{ scale: 0.93 }} onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.gold, fontFamily: font, fontSize: 14, fontWeight: 600, padding: 0 }}>
          <ChevronLeft size={17} strokeWidth={2.2} /> Back
        </motion.button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text }}>Reviews</h2>
          <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>What members are saying</p>
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {[...Array(5)].map((_, i) => <Star key={i} size={14} color={C.gold} fill={C.gold} />)}
        </div>
      </div>

      {/* Average badge */}
      <div style={{ margin: "16px 20px", background: C.card, border: `1px solid ${C.gold}30`, borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 36, fontWeight: 900, color: C.goldLight, letterSpacing: "-0.03em" }}>4.9</p>
          <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textMuted }}>out of 5</p>
        </div>
        <div style={{ width: 1, height: 40, background: C.border }} />
        <div>
          <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{ALL_REVIEWS.length} reviews</p>
          {[5,4,3].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, width: 8 }}>{s}</span>
              <div style={{ width: 80, height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: s === 5 ? "90%" : s === 4 ? "8%" : "2%", background: C.gold, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {ALL_REVIEWS.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{r.author}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", gap: 1 }}>
                  {[...Array(r.stars)].map((_, j) => <Star key={j} size={10} color={C.gold} fill={C.gold} />)}
                </div>
                <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted }}>{r.date}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{r.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Metrics Placeholder ─────────────────────────────────────────────────────
function MetricsContent() {
  const stats = [
    { label: "Total Trades",    value: "147",   color: C.accentLight },
    { label: "Win Rate",        value: "68%",   color: C.green       },
    { label: "Avg RR",          value: "1:2.8", color: C.amber       },
    { label: "Best Month",      value: "+22R",  color: C.green       },
    { label: "Current Streak",  value: "5W",    color: C.green       },
    { label: "Realized P&L",    value: "+83R",  color: C.green       },
  ];
  return (
    <div style={{ padding: "20px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
          </motion.div>
        ))}
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
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} style={{ display: "flex", gap: 10 }}>
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
          <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message the community…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 14, padding: "11px 0" }} />
        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={send} style={{ width: 40, height: 40, borderRadius: "50%", background: msg.trim() ? `linear-gradient(135deg, ${ac}, ${ac}cc)` : C.border, border: "none", color: msg.trim() ? "#fff" : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: msg.trim() ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}>
          <ArrowRight size={17} strokeWidth={2.5} />
        </motion.button>
      </div>
    </>
  );
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
function RoomsContent() {
  const rooms = [
    { id: 1, name: "Pre-Market Session", host: "Alex H.", live: true,  members: 34, scheduled: null      },
    { id: 2, name: "Trade Review — EU",  host: "Alex H.", live: true,  members: 18, scheduled: null      },
    { id: 3, name: "Q&A with Alex",      host: "Alex H.", live: false, members: 0,  scheduled: "3:00 PM" },
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
  const [activeSectionId, setActiveSectionId] = useState(null); // null = Perfil
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
    setDirection(activeSectionId === null ? 1 : 1);
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
    if (!activeSectionId)                    return <PerfilContent onNavigate={navigate} />;
    if (activeSectionId === "planning")      return <Planning      section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} />;
    if (activeSectionId === "recaps")        return <Recaps        section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} />;
    if (activeSectionId === "metrics")       return <MetricsContent />;
    if (activeSectionId === "community")     return <CommunityChatContent section={activeSection} />;
    if (activeSectionId === "reviews")       return <ReviewsContent onBack={goHome} />;
    if (activeSectionId === "rooms")         return <RoomsContent />;
    return null;
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", overflow: "hidden" }}>
        <Sidebar activeSectionId={activeSectionId} onNavigate={navigate} onHome={goHome} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{ flexShrink: 0, zIndex: 30, background: `${C.surface}f4`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <IconBtn icon={MessageSquare} />
              <IconBtn icon={Search} />
              <IconBtn icon={Bell} badge />
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px" }}>
                <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isHost ? "Host" : "Member"}</span>
                <button onClick={() => setIsHost(h => !h)} style={{ width: 34, height: 18, borderRadius: 9, border: "none", background: isHost ? C.accent : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <motion.div animate={{ x: isHost ? 16 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2 }} />
                </button>
              </div>
            </div>
          </div>

          {/* Profile card on desktop Perfil view */}
          <AnimatePresence>
            {!activeSectionId && (
              <motion.div key="profile_desktop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeTrans} style={{ flexShrink: 0 }}>
                <ProfileCard onNavigate={navigate} />
              </motion.div>
            )}
          </AnimatePresence>



          {/* Animated content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <AnimatePresence mode="sync" custom={direction}>
              <motion.div key={activeSectionId ?? "perfil"} custom={direction} variants={slideVariants}
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

  // ── MOBILE ── Tabs integradas: perfil fijo arriba, feed cambia por chip/swipe
  const MOBILE_TABS = [null, ...SECTIONS.map(s => s.id)]; // null = Perfil/home feed
  const mobileTabIdx = MOBILE_TABS.indexOf(activeSectionId);

  // Swipe horizontal — solo afecta al feed
  const swipeStart = useRef(null);
  const handleTouchStart = (e) => { swipeStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (swipeStart.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) < 40) return; // umbral mínimo
    if (dx < 0 && mobileTabIdx < MOBILE_TABS.length - 1) {
      // swipe izq→der : siguiente sección
      setDirection(1);
      setActiveSectionId(MOBILE_TABS[mobileTabIdx + 1]);
    } else if (dx > 0 && mobileTabIdx > 0) {
      // swipe der→izq : sección anterior
      setDirection(-1);
      setActiveSectionId(MOBILE_TABS[mobileTabIdx - 1]);
    }
  };

  // Render del feed móvil según sección activa — sin navegar a página nueva
  function renderMobileFeed() {
    if (!activeSectionId) return <PerfilContent onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} />;
    if (activeSectionId === "planning")      return <Planning      section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} mobileTab />;
    if (activeSectionId === "recaps")        return <Recaps        section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} mobileTab />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} mobileTab />;
    if (activeSectionId === "metrics")       return <MetricsContent />;
    if (activeSectionId === "community")     return <CommunityChatContent section={activeSection} />;
    if (activeSectionId === "reviews")       return <ReviewsContent onBack={goHome} />;
    if (activeSectionId === "rooms")         return <RoomsContent />;
    return null;
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, height: "100vh", background: C.surface, position: "relative", overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 120, borderRadius: "50%", background: `radial-gradient(ellipse, ${C.accentDim}55 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

        {/* ── TOP BAR: ← Home + nombre perfil (fija siempre) ── */}
        <MobileTopBar onHome={goHome} profileName="Alex Herrera" />

        {/* ── PERFIL SUPERIOR: foto, nombre, stats, botones (sticky, se oculta al scroll) ── */}
        <div style={{ flexShrink: 0, zIndex: 10, background: C.surface }}>
          <ProfileCard onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} />
        </div>

        {/* ── CHIPS STICKY: siempre visibles sobre el feed ── */}
        <div style={{ flexShrink: 0, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: `${C.surface}f8`, backdropFilter: "blur(16px)", zIndex: 20, position: "sticky", top: 52 }}>
          <SectionChips activeSectionId={activeSectionId} onNavigate={(id) => { setDirection(MOBILE_TABS.indexOf(id) > mobileTabIdx ? 1 : -1); setActiveSectionId(id); }} onHome={() => { setDirection(-1); setActiveSectionId(null); }} />
        </div>

        {/* Role toggle dev tool */}
        <div style={{ position: "fixed", bottom: 20, right: 16, zIndex: 9998, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 4px 4px 10px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isHost ? "Host" : "Member"}</span>
          <button onClick={() => setIsHost(h => !h)} style={{ width: 34, height: 18, borderRadius: 9, border: "none", background: isHost ? C.accent : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <motion.div animate={{ x: isHost ? 16 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2 }} />
          </button>
        </div>

        {/* ── FEED: solo esta zona cambia con chip/swipe ── */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <AnimatePresence mode="sync" custom={direction}>
            <motion.div key={activeSectionId ?? "perfil"} custom={direction} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={springTrans}
              style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
              {renderMobileFeed()}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
