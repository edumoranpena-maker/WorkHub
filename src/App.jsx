import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, FileText, Megaphone, Hash, MessageSquare,
  Bell, Search, ChevronLeft, ChevronRight, ArrowRight,
  Users, BarChart2, TrendingUp, TrendingDown, Star, X, Plus, Zap, Pencil,
} from "lucide-react";
import Planning      from "./sections/Planning";
import HomeFeed      from "./HomeFeed.jsx";
import Recaps        from "./sections/Recaps";
import Announcements from "./sections/Announcements";

// ─── Config + Engine imports ──────────────────────────────────────────────────
import { DEFAULT_PROFILE_CONFIG, mergeProfileConfig } from "./config/profileConfig.js";
import { resolveTheme, tokensToC }                   from "./config/themes.js";
import { resolveIcon, ICON_OPTIONS as ICON_REG_OPTIONS } from "./registry/icons.js";
import { ThemeProvider, useTheme }                   from "./engine/ThemeProvider.jsx";
import { AIPromptPanel }                              from "./engine/AIPromptPanel.jsx";

// ─── Design Tokens ────────────────────────────────────────────────────────────
// C and font are now derived from ThemeProvider at runtime.
// Components inside ThemeProvider use useTheme() to access them.
// For components defined OUTSIDE the provider tree (none currently), use CSS vars.
const font = "'DM Sans', sans-serif"; // still needed for non-themed static strings

// Fallback C for module-level code (replaced by useTheme() inside components)
const C = tokensToC(resolveTheme("dark-purple"));

// ─── Section resolver ─────────────────────────────────────────────────────────
// Converts a config section object (JSON-safe) to a render-ready object with
// the actual icon component resolved from the registry.
function resolveSection(configSection) {
  return {
    ...configSection,
    icon:      resolveIcon(configSection.iconId),
    glowColor: configSection.accentColor + "25",
  };
}

// Legacy SECTIONS constant for backward compat with non-config code
// (replaced at runtime by profileConfig.sections)
const SECTIONS = DEFAULT_PROFILE_CONFIG.sections.map(resolveSection);

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
function ProfileCard({ onNavigate, hideButtons, profile, onEditAvatar }) {
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
          {/* Avatar with orange story ring + pencil edit button */}
          <div style={{ position: "relative" }}>
            <div style={{ cursor: "pointer" }} onClick={() => onNavigate && onNavigate("announcements")}>
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
            </div>
            {/* Live dot */}
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, borderRadius: "50%", background: C.green, border: `2px solid ${C.card}`, boxShadow: `0 0 8px ${C.green}` }} />
            {/* Pencil edit button */}
            {onEditAvatar && (
              <motion.button whileTap={{ scale: 0.88 }} onClick={onEditAvatar}
                style={{ position: "absolute", bottom: 0, left: 0, width: 24, height: 24, borderRadius: "50%", background: C.accent, border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 2px 8px ${C.accent}60` }}>
                <Pencil size={11} color="#fff" strokeWidth={2.5} />
              </motion.button>
            )}
          </div>

          {/* Name + verified + handle — below the avatar */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 2 }}>
              <h2 style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{profile?.name ?? "Alex Herrera"}</h2>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 8, color: "#fff" }}>✓</span>
              </div>
            </div>
<<<<<<< HEAD
            <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.accentLight, fontWeight: 600, letterSpacing: "0.01em" }}>{profile?.handle ?? "@alexherrera.trades"}</p>
=======
            <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.accentLight, fontWeight: 600, letterSpacing: "0.01em" }}>@alexherrera.trades</p>
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
            {/* Rating */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <div style={{ display: "flex", gap: 1 }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={9} color={C.gold} fill={C.gold} />)}
              </div>
<<<<<<< HEAD
              {(profile?.showRating !== false) && <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.goldLight }}>{profile?.rating ?? 4.9}</span>}
=======
              <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.goldLight }}>4.9</span>
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, background: `linear-gradient(to bottom, transparent, ${C.border} 20%, ${C.border} 80%, transparent)`, flexShrink: 0, alignSelf: "stretch" }} />

        {/* Bio + stats — right of divider */}
        <div style={{ flex: 1, paddingTop: 2 }}>
          {(profile?.showBio !== false) && <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            {profile?.bio ?? "Trader & educator — 6+ years in FX & commodities."}{" "}
            {profile?.bioHighlight && <span style={{ color: C.accentLight, fontWeight: 600 }}>{profile.bioHighlight}</span>}
          </p>}

<<<<<<< HEAD
          {(profile?.showStats !== false) && <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            {(profile?.stats ?? [{value:"12.4k",label:"Followers"},{value:"147",label:"Trades"},{value:"68%",label:"Winrate"},{value:"2.8R",label:"Exp. Value"}]).map((s) => (
              <div key={s.label}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, fontWeight: 800, color: C.text }}>{s.value}</p>
                <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textMuted }}>{s.label}</p>
=======
          {/* Mini stats row — Followers · Trades · Winrate · Exp. Value */}
          <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            {[["12.4k", "Followers"], ["147", "Trades"], ["68%", "Winrate"], ["2.8R", "Exp. Value"]].map(([val, lbl]) => (
              <div key={lbl}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, fontWeight: 800, color: C.text }}>{val}</p>
                <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textMuted }}>{lbl}</p>
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
              </div>
            ))}
          </div>}
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
      </div>}
    </motion.div>
  );
}

// ─── Section Chips ─────────────────────────────────────────────────────────────
// Shared logic, used by both mobile and desktop chip bars
function SectionChips({ activeSectionId, onNavigate, onHome, scrollRef, onSections, onAddSection }) {
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

      {(onSections || SECTIONS).map(s => {
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
      {/* Añadir sección */}
      {onAddSection && (
        <motion.button whileTap={{ scale: 0.93 }} onClick={onAddSection}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 99, border: `1px dashed ${C.border}`, background: "transparent", cursor: "pointer" }}>
          <Plus size={11} color={C.textMuted} strokeWidth={2.5} />
          <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>Añadir</span>
        </motion.button>
      )}
    </div>
  );
}

// ─── Desktop Chip Bar with arrow controls ─────────────────────────────────────
function DesktopSectionBar({ activeSectionId, onNavigate, onHome, onSections, onAddSection }) {
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
      <SectionChips activeSectionId={activeSectionId} onNavigate={onNavigate} onHome={onHome} scrollRef={scrollRef} onSections={onSections} onAddSection={onAddSection} />
      <ArrowBtn dir={1} enabled={canRight} />
    </div>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ activeSectionId, onNavigate, onHome, onSections, onAddSection }) {
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
        {(onSections || SECTIONS).map(s => {
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
<<<<<<< HEAD
function MobileTopBar({ onHome, profileName, onAIPanel, onOpenSettings }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", gap: 10, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f4`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 50, flexShrink: 0 }}>
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome}
        style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 6px 4px 0", borderRadius: 8, color: C.accentLight, flexShrink: 0 }}>
=======
function MobileTopBar({ onHome, profileName }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 10, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f4`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 52, flexShrink: 0 }}>
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome}
        style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 8px 4px 2px", borderRadius: 8, color: C.accentLight, flexShrink: 0 }}>
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
        <ChevronLeft size={16} strokeWidth={2.4} color={C.accentLight} />
        <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.accentLight }}>Home</span>
      </motion.button>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <span style={{ fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileName}</span>
      </div>
      {/* Right icons: AI, avatar (→ settings), bell, message, search */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onAIPanel}
          style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(124,77,255,0.15)", border: "1px solid rgba(124,77,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Zap size={13} color="#9d71ff" />
        </motion.button>
        {/* Avatar → opens Settings */}
        <motion.div whileTap={{ scale: 0.88 }} onClick={onOpenSettings}
          style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accentDim}, #1a0a3a)`, border: `1.5px solid ${C.accent}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
          <span style={{ fontFamily: font, fontSize: 11, fontWeight: 800, color: C.accentLight }}>A</span>
        </motion.div>
        <IconBtn icon={Bell} badge />
        <IconBtn icon={MessageSquare} />
        <IconBtn icon={Search} />
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
        <ReviewsCard onVerMas={() => onNavigate("rooms")} />
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
  const [reviews, setReviews] = useState(ALL_REVIEWS.map((r, i) => ({
    ...r, id: i, likes: Math.floor(Math.random() * 24) + 2, liked: false,
    replies: [], showReply: false, replyText: "",
  })));
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [newText, setNewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleLike = (id) => setReviews(rs => rs.map(r =>
    r.id === id ? { ...r, liked: !r.liked, likes: r.liked ? r.likes - 1 : r.likes + 1 } : r
  ));
  const toggleReply = (id) => setReviews(rs => rs.map(r =>
    r.id === id ? { ...r, showReply: !r.showReply } : r
  ));
  const setReplyText = (id, val) => setReviews(rs => rs.map(r =>
    r.id === id ? { ...r, replyText: val } : r
  ));
  const submitReply = (id) => setReviews(rs => rs.map(r => {
    if (r.id !== id || !r.replyText.trim()) return r;
    return { ...r, replies: [...r.replies, { author: "Alex H.", text: r.replyText.trim(), isHost: true }], replyText: "", showReply: false };
  }));
  const submitReview = async () => {
    if (!newRating || !newText.trim()) return;
    setSubmitting(true);
    await new Promise(res => setTimeout(res, 600));
    setReviews(rs => [{ id: Date.now(), author: "You", stars: newRating, date: "just now", text: newText.trim(), likes: 0, liked: false, replies: [], showReply: false, replyText: "" }, ...rs]);
    setNewRating(0); setNewText(""); setSubmitting(false);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header — no back button, integrated as tab */}
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text }}>Reviews</h2>
          <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>What members are saying</p>
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {[...Array(5)].map((_, i) => <Star key={i} size={14} color={C.gold} fill={C.gold} />)}
        </div>
      </div>

      {/* Average badge */}
      <div style={{ margin: "14px 20px 0", background: C.card, border: `1px solid ${C.gold}30`, borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 36, fontWeight: 900, color: C.goldLight, letterSpacing: "-0.03em" }}>4.9</p>
          <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: C.textMuted }}>out of 5</p>
        </div>
        <div style={{ width: 1, height: 40, background: C.border }} />
        <div>
          <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{reviews.length} reviews</p>
          {[5,4,3].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, width: 8 }}>{s}</span>
              <div style={{ width: 80, height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: s === 5 ? "88%" : s === 4 ? "9%" : "3%", background: C.gold, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Write a Review form ── */}
      <div style={{ margin: "14px 20px 0", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 18px" }}>
        <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>Write a Review</p>
        {/* Star rating selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[1,2,3,4,5].map(s => (
            <motion.button key={s} whileTap={{ scale: 0.85 }}
              onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
              onClick={() => setNewRating(s)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <Star size={26} strokeWidth={1.5}
                color={(hoverRating || newRating) >= s ? C.gold : C.border}
                fill={(hoverRating || newRating) >= s ? C.gold : "none"} />
            </motion.button>
          ))}
          {newRating > 0 && (
            <span style={{ fontFamily: font, fontSize: 12, color: C.goldLight, fontWeight: 600, alignSelf: "center", marginLeft: 4 }}>
              {["", "Poor", "Fair", "Good", "Great", "Excellent"][newRating]}
            </span>
          )}
        </div>
        {/* Textarea */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Share your experience with this community…"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", resize: "none",
              background: `${C.bg}cc`, border: `1.5px solid ${newText.trim() ? C.accent + "55" : C.border}`,
              borderRadius: 12, padding: "11px 14px", color: C.text,
              fontFamily: font, fontSize: 13, lineHeight: 1.55,
              outline: "none", transition: "border-color 0.2s",
              caretColor: C.accentLight,
            }}
          />
          <span style={{ position: "absolute", bottom: 8, right: 12, fontFamily: font, fontSize: 10, color: C.textDim }}>
            {newText.length}/500
          </span>
        </div>
        {/* Submit */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={submitReview}
          disabled={!newRating || !newText.trim() || submitting}
          style={{
            width: "100%", height: 40, borderRadius: 12, border: "none", cursor: (!newRating || !newText.trim()) ? "default" : "pointer",
            fontFamily: font, fontSize: 13, fontWeight: 700,
            background: (!newRating || !newText.trim())
              ? C.border
              : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldLight} 100%)`,
            color: (!newRating || !newText.trim()) ? C.textMuted : "#1a0f00",
            transition: "all 0.2s",
            boxShadow: (!newRating || !newText.trim()) ? "none" : `0 4px 16px ${C.gold}40`,
          }}>
          {submitting ? "Submitting…" : "Submit Review"}
        </motion.button>
      </div>

      {/* ── Review list with likes + creator reply ── */}
      <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {reviews.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{r.author}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", gap: 1 }}>
                  {[...Array(r.stars)].map((_, j) => <Star key={j} size={10} color={C.gold} fill={C.gold} />)}
                </div>
                <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted }}>{r.date}</span>
              </div>
            </div>
            {/* Review text */}
            <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{r.text}</p>
            {/* Actions: helpful + reply */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => toggleLike(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: r.liked ? `${C.gold}18` : "transparent", border: `1px solid ${r.liked ? C.gold + "55" : C.border}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", transition: "all 0.18s" }}>
                <span style={{ fontSize: 12 }}>👍</span>
                <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: r.liked ? C.goldLight : C.textMuted }}>
                  Helpful {r.likes > 0 ? `(${r.likes})` : ""}
                </span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => toggleReply(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>
                <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Reply</span>
              </motion.button>
            </div>
            {/* Creator replies */}
            {r.replies.map((rep, ri) => (
              <div key={ri} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${C.accent}44, ${C.accent}22)`, border: `1px solid ${C.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 11, fontWeight: 800, color: C.accentLight }}>A</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.text }}>{rep.author}</span>
                    {rep.isHost && <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.accentLight, background: `${C.accent}18`, border: `1px solid ${C.accent}28`, borderRadius: 4, padding: "1px 5px" }}>Creator</span>}
                  </div>
                  <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{rep.text}</p>
                </div>
              </div>
            ))}
            {/* Reply input */}
            {r.showReply && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <input value={r.replyText} onChange={e => setReplyText(r.id, e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitReply(r.id)}
                  placeholder="Add a reply…"
                  style={{ flex: 1, background: `${C.bg}cc`, border: `1.5px solid ${C.accent}44`, borderRadius: 10, padding: "8px 12px", color: C.text, fontFamily: font, fontSize: 12, outline: "none" }} />
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => submitReply(r.id)}
                  style={{ padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: "#fff", fontFamily: font, fontSize: 12, fontWeight: 700 }}>
                  Send
                </motion.button>
              </div>
            )}
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
  const [activeTab, setActiveTab] = useState("rooms"); // rooms | chat | reviews
  const rooms = [
    { id: 1, name: "Pre-Market Session", host: "Alex H.", live: true,  members: 34, scheduled: null      },
    { id: 2, name: "Trade Review — EU",  host: "Alex H.", live: true,  members: 18, scheduled: null      },
    { id: 3, name: "Q&A with Alex",      host: "Alex H.", live: false, members: 0,  scheduled: "3:00 PM" },
  ];
  const RoomBlue = "#60a5fa";

  const tabs = [
    { id: "rooms",    label: "Live Rooms",     badge: "2 live" },
    { id: "chat",     label: "Community Chat", badge: "12" },
    { id: "reviews",  label: "Reviews",        badge: null },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {tabs.map(t => {
          const active = t.id === activeTab;
          return (
            <motion.button key={t.id} whileTap={{ scale: 0.93 }} onClick={() => setActiveTab(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 99, border: `1px solid ${active ? RoomBlue + "55" : C.border}`, background: active ? `${RoomBlue}14` : "transparent", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: active ? RoomBlue : C.textMuted, transition: "all 0.15s" }}>
              {t.label}
              {t.badge && <span style={{ fontSize: 9, fontWeight: 800, color: active ? RoomBlue : C.textMuted, background: active ? `${RoomBlue}22` : C.border, border: `1px solid ${active ? RoomBlue + "35" : "transparent"}`, borderRadius: 99, padding: "1px 5px" }}>{t.badge}</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          {activeTab === "rooms" && (
            <motion.div key="rooms" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", height: "100%" }}>
              {rooms.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  style={{ background: C.card, border: `1px solid ${r.live ? RoomBlue + "40" : C.border}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
                    {r.live
                      ? <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}30`, borderRadius: 6, padding: "3px 8px" }}>🔴 LIVE · {r.members}</span>
                      : <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.border, borderRadius: 6, padding: "3px 8px" }}>{r.scheduled}</span>}
                  </div>
                  <span style={{ fontFamily: font, fontSize: 12, color: C.textMuted }}>Hosted by {r.host}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
          {activeTab === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <CommunityChatContent section={{ accentColor: RoomBlue }} />
            </motion.div>
          )}
          {activeTab === "reviews" && (
            <motion.div key="reviews" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              style={{ overflowY: "auto", height: "100%" }}>
              <ReviewsContent onBack={() => setActiveTab("rooms")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

// ─── Custom Section ──────────────────────────────────────────────────────────
function CustomSectionContent({ section }) {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const submit = () => {
    if (!text.trim()) return;
    setPosts(p => [{ id: Date.now(), text: text.trim(), author: "You", time: "just now" }, ...p]);
    setText("");
  };
  const color = section.accentColor || "#7c4dff";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <section.icon size={22} color={color} />
            </div>
            <p style={{ fontFamily: font, fontSize: 14, color: C.textMuted }}>No posts yet in {section.label}</p>
          </div>
        )}
        {posts.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{p.author}</span>
              <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{p.time}</span>
            </div>
            <p style={{ margin: 0, fontFamily: font, fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>{p.text}</p>
          </motion.div>
        ))}
      </div>
      <div style={{ padding: "10px 16px 20px", borderTop: `1px solid ${C.border}`, background: `${C.surface}f4`, backdropFilter: "blur(16px)", flexShrink: 0 }}>
        <div style={{ background: C.card, border: `1.5px solid ${focused ? color + "55" : C.border}`, borderRadius: 14, padding: "0 4px 4px 14px", transition: "border-color 0.2s" }}>
          <textarea value={text} onChange={e => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder={`Post in ${section.label}…`} rows={2}
            style={{ width: "100%", boxSizing: "border-box", background: "none", border: "none", outline: "none", resize: "none", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.55, padding: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={submit}
              style={{ padding: "7px 18px", borderRadius: 10, border: "none", cursor: text.trim() ? "pointer" : "default", background: text.trim() ? `linear-gradient(135deg, ${color}, ${color}cc)` : C.border, color: text.trim() ? "#fff" : C.textMuted, fontFamily: font, fontSize: 13, fontWeight: 700, transition: "all 0.2s" }}>
              Post
            </motion.button>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Add Section Modal ────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  { id: "hash",       icon: Hash,         label: "Channel"  },
  { id: "star",       icon: Star,         label: "Reviews"  },
  { id: "calendar",   icon: CalendarDays, label: "Schedule" },
  { id: "chart",      icon: BarChart2,    label: "Stats"    },
  { id: "users",      icon: Users,        label: "Community"},
  { id: "message",    icon: MessageSquare,label: "Chat"     },
  { id: "trending",   icon: TrendingUp,   label: "Signals"  },
  { id: "megaphone",  icon: Megaphone,    label: "Announce" },
];
const COLOR_OPTIONS = ["#7c4dff","#22d3a0","#f59e0b","#60a5fa","#e879f9","#ff4f6a","#d4a843","#34d399"];

function AddSectionModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [iconId, setIconId] = useState("hash");
  const [color, setColor] = useState("#7c4dff");

  const selectedIcon = ICON_OPTIONS.find(o => o.id === iconId) || ICON_OPTIONS[0];

  const submit = () => {
    if (!name.trim()) return;
    const id = `custom_${Date.now()}`;
    onAdd({
      id, label: name.trim(), subtitle: desc.trim() || `Custom section`,
      icon: selectedIcon.icon, accentColor: color, glowColor: `${color}25`,
      badge: null, isCustom: true,
    });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,8,14,0.88)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
        style={{ width: "100%", maxWidth: 420, background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: "24px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text }}>Nueva Sección</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={19} /></button>
        </div>

        {/* Preview chip */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 99, border: `1.5px solid ${color}60`, background: `${color}14` }}>
            <selectedIcon.icon size={14} color={color} />
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color }}>{name || "Mi Sección"}</span>
          </div>
        </div>

        {/* Name */}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la sección…"
          style={{ width: "100%", boxSizing: "border-box", background: `${C.bg}cc`, border: `1.5px solid ${name ? color + "55" : C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 14, fontWeight: 700, outline: "none", marginBottom: 10, transition: "border-color 0.2s" }} />

        {/* Description */}
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)…"
          style={{ width: "100%", boxSizing: "border-box", background: `${C.bg}cc`, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 13, outline: "none", marginBottom: 16 }} />

        {/* Icon selector */}
        <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textMuted }}>Ícono</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {ICON_OPTIONS.map(o => {
            const active = o.id === iconId;
            return (
              <motion.button key={o.id} whileTap={{ scale: 0.88 }} onClick={() => setIconId(o.id)}
                style={{ width: 42, height: 42, borderRadius: 12, border: `1.5px solid ${active ? color + "70" : C.border}`, background: active ? `${color}18` : C.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                <o.icon size={17} color={active ? color : C.textMuted} />
              </motion.button>
            );
          })}
        </div>

        {/* Color selector */}
        <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textMuted }}>Color</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          {COLOR_OPTIONS.map(c => (
            <motion.button key={c} whileTap={{ scale: 0.88 }} onClick={() => setColor(c)}
              style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `2.5px solid ${c === color ? "#fff" : "transparent"}`, cursor: "pointer", boxShadow: c === color ? `0 0 12px ${c}80` : "none", transition: "all 0.15s" }} />
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.95 }} onClick={submit}
          disabled={!name.trim()}
          style={{ width: "100%", height: 44, borderRadius: 14, border: "none", cursor: name.trim() ? "pointer" : "default", fontFamily: font, fontSize: 14, fontWeight: 800, background: name.trim() ? `linear-gradient(135deg, ${color}, ${color}bb)` : C.border, color: name.trim() ? "#fff" : C.textMuted, boxShadow: name.trim() ? `0 4px 20px ${color}44` : "none", transition: "all 0.2s" }}>
          Crear Sección
        </motion.button>
      </motion.div>
    </motion.div>
  );
}


// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ onClose }) {
  const [username,   setUsername]   = useState("Alex Herrera");
  const [handle,     setHandle]     = useState("alexherrera.trades");
  const [privacy,    setPrivacy]    = useState("members");
  const [saved,      setSaved]      = useState(false);
  const [activeTab,  setActiveTab]  = useState("account");

  const tabs = [
    { id: "account",  label: "Account"  },
    { id: "privacy",  label: "Privacy"  },
    { id: "security", label: "Security" },
  ];

  const save = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(8,8,14,0.88)", backdropFilter: "blur(16px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        style={{ width: "100%", maxWidth: 480, background: C.surface, borderRadius: "22px 22px 0 0", border: `1px solid ${C.border}`, borderBottom: "none", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "14px auto 0" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
          <span style={{ fontFamily: font, fontSize: 17, fontWeight: 800, color: C.text }}>Settings</span>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={20} /></motion.button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "14px 20px 0" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding: "7px 16px", borderRadius: 99, border: `1px solid ${activeTab === t.id ? C.accent + "55" : C.border}`, background: activeTab === t.id ? C.accent + "18" : "transparent", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: activeTab === t.id ? C.accentLight : C.textMuted, transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

          {activeTab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Avatar edit */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accentDim}, #1a0a3a)`, border: `3px solid ${C.accent}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: C.accentLight }}>A</span>
                  </div>
                  <motion.div whileTap={{ scale: 0.88 }}
                    style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: C.accent, border: `2px solid ${C.surface}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 2px 8px ${C.accent}60` }}>
                    <Pencil size={12} color="#fff" strokeWidth={2.5} />
                  </motion.div>
                </div>
                <span style={{ fontFamily: font, fontSize: 12, color: C.accentLight, fontWeight: 600, cursor: "pointer" }}>Change photo</span>
              </div>

              {[
                { label: "Display name", value: username, set: setUsername, placeholder: "Your name" },
                { label: "Username", value: handle, set: setHandle, placeholder: "@handle", prefix: "@" },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</p>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 14, outline: "none", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = C.accent + "55"}
                    onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              ))}

              {/* Switch account */}
              <div style={{ marginTop: 4 }}>
                <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Accounts</p>
                {["Alex Herrera", "Trading Alt"].map((acc, i) => (
                  <motion.div key={acc} whileTap={{ scale: 0.97 }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, background: i === 0 ? `${C.accent}12` : "transparent", border: `1px solid ${i === 0 ? C.accent + "30" : C.border}`, marginBottom: 8, cursor: "pointer" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: i === 0 ? `linear-gradient(135deg, ${C.accentDim}, #1a0a3a)` : C.card, border: `2px solid ${i === 0 ? C.accent + "44" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: C.accentLight }}>{acc[0]}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{acc}</p>
                      {i === 0 && <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.accentLight }}>Active</p>}
                    </div>
                    {i === 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />}
                  </motion.div>
                ))}
                <motion.button whileTap={{ scale: 0.95 }}
                  style={{ width: "100%", padding: "10px", borderRadius: 14, border: `1px dashed ${C.border}`, background: "transparent", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600, color: C.textMuted }}>
                  + Add account
                </motion.button>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Default post visibility</p>
              {["public", "members", "private"].map(p => (
                <motion.div key={p} whileTap={{ scale: 0.97 }} onClick={() => setPrivacy(p)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 14, background: privacy === p ? `${C.accent}12` : C.card, border: `1px solid ${privacy === p ? C.accent + "35" : C.border}`, cursor: "pointer" }}>
                  <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: privacy === p ? C.accentLight : C.text, textTransform: "capitalize" }}>{p}</span>
                  {privacy === p && <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, color: "#fff" }}>✓</span></div>}
                </motion.div>
              ))}
              <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ margin: "0 0 3px", fontFamily: font, fontSize: 13, fontWeight: 600, color: C.text }}>Allow DMs</p>
                    <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textMuted }}>Members can message you</p>
                  </div>
                  <div style={{ width: 42, height: 24, borderRadius: 12, background: C.green, cursor: "pointer", position: "relative" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, right: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Change password",       sub: "Update your login password"      },
                { label: "Two-factor auth",        sub: "Add an extra layer of security"  },
                { label: "Active sessions",        sub: "Manage where you're logged in"   },
                { label: "Download my data",       sub: "Export your account data"        },
              ].map(item => (
                <motion.div key={item.label} whileTap={{ scale: 0.97 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontFamily: font, fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</p>
                    <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textMuted }}>{item.sub}</p>
                  </div>
                  <ChevronRight size={16} color={C.textMuted} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: "12px 20px 28px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {activeTab === "account" && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={save}
              style={{ width: "100%", height: 46, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 800, background: saved ? `linear-gradient(135deg, ${C.green}, #0ea876)` : `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: saved ? "#000" : "#fff", transition: "all 0.2s", boxShadow: `0 4px 20px ${C.accent}44` }}>
              {saved ? "Saved ✓" : "Save Changes"}
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.95 }}
            style={{ width: "100%", height: 44, borderRadius: 14, border: `1px solid ${C.red}30`, background: `${C.red}10`, cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 700, color: C.red }}>
            Log Out
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Root Shell ───────────────────────────────────────────────────────────────
// ─── Error Boundary ───────────────────────────────────────────────────────────
import React from "react";
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#08080e", color: "#ff4f6a", fontFamily: "monospace", padding: 24, height: "100vh" }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Render Error (check console):</p>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "#eaeaf5" }}>{this.state.error.message}</pre>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", color: "#6a6a82", marginTop: 8 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RootShell() {
  const [showHome,     setShowHome]     = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#08080e" }}>
      {showHome ? (
        <HomeFeed onEnterProfile={() => setShowHome(false)} />
      ) : (
        <ErrorBoundary>
          <App
            onGoHome={() => setShowHome(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </ErrorBoundary>
      )}
      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Workspace App ────────────────────────────────────────────────────────────
function App({ onGoHome, onOpenSettings }) {
  const [activeSectionId, setActiveSectionId] = useState(null); // null = Perfil
  const [direction,       setDirection]       = useState(1);
  const [isHost,          setIsHost]          = useState(true);
  const [openThreadId,    setOpenThreadId]    = useState(null);
  const [showAddSection,  setShowAddSection]  = useState(false);
  const [showAIPanel,     setShowAIPanel]     = useState(false);

  // ── Central profile config — AI modifies this, render engine reads it ──────
  const [profileConfig, setProfileConfig] = useState(DEFAULT_PROFILE_CONFIG);

  const applyConfig = useCallback((newConfig) => {
    setProfileConfig(newConfig);
  }, []);

  // Derive runtime data from profileConfig
  const allSections   = useMemo(
    () => profileConfig.sections.filter(s => s.visible).sort((a,b) => a.order - b.order).map(resolveSection),
    [profileConfig.sections]
  );
  const visibleWidgets = useMemo(
    () => profileConfig.feedWidgets.filter(w => w.visible).sort((a,b) => a.order - b.order),
    [profileConfig.feedWidgets]
  );

  const isDesktop = useIsDesktop();

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

  const activeSection = allSections.find(s => s.id === activeSectionId) || null;
  const accentColor   = activeSection?.accentColor || C.accent;

  function renderContent() {
    if (!activeSectionId)                    return <PerfilContent onNavigate={navigate} visibleWidgets={visibleWidgets} sections={allSections} />;
    if (activeSectionId === "planning")      return <Planning      section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} />;
    if (activeSectionId === "recaps")        return <Recaps        section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} />;
    if (activeSectionId === "metrics")       return <MetricsContent />;
    if (activeSectionId === "rooms")         return <RoomsContent />;
    const customSec = allSections.find(s => s.id === activeSectionId && !["planning","recaps","announcements","metrics","rooms"].includes(activeSectionId));
    if (customSec) return <CustomSectionContent section={customSec} />;
    return null;
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <ThemeProvider themeConfig={profileConfig.theme}>
      <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", overflow: "hidden" }}>
        <Sidebar activeSectionId={activeSectionId} onNavigate={navigate} onHome={goHome} onSections={allSections} onAddSection={() => setShowAddSection(true)} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{ flexShrink: 0, zIndex: 30, background: `${C.surface}f4`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {/* AI Studio button */}
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowAIPanel(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, border: `1px solid ${showAIPanel ? C.accent + "55" : C.border}`, background: showAIPanel ? `${C.accent}18` : C.card, cursor: "pointer", transition: "all 0.15s" }}>
                <Zap size={14} color={showAIPanel ? C.accentLight : C.textMuted} />
                <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: showAIPanel ? C.accentLight : C.textMuted }}>AI Studio</span>
              </motion.button>
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
                <ProfileCard onNavigate={navigate} profile={{ ...profileConfig.identity, ...profileConfig.layout, stats: profileConfig.stats }} onEditAvatar={onOpenSettings} />
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

      <AnimatePresence>
        {showAIPanel && (
          <AIPromptPanel
            currentConfig={profileConfig}
            onApply={applyConfig}
            onClose={() => setShowAIPanel(false)}
          />
        )}
      </AnimatePresence>
      </ThemeProvider>
    );
  }

  // ── MOBILE ── Tabs integradas: perfil fijo arriba, feed cambia por chip/swipe
<<<<<<< HEAD
  const MOBILE_TABS = [null, ...allSections.map(s => s.id)]; // null = Perfil/home feed
  const mobileTabIdx = MOBILE_TABS.indexOf(activeSectionId);

  // Swipe horizontal — deliberate (Twitter/Whop style): vertical always wins
  const swipeState = useRef({ x: 0, y: 0, locked: null }); // locked: "h"|"v"|null
  const handleTouchStart = (e) => {
    swipeState.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null };
  };
  const handleTouchMove = (e) => {
    const s = swipeState.current;
    if (s.locked) return;
    const dx = Math.abs(e.touches[0].clientX - s.x);
    const dy = Math.abs(e.touches[0].clientY - s.y);
    // Lock direction once we have 8px of movement
    if (dx > 8 || dy > 8) {
      s.locked = dx > dy * 1.5 ? "h" : "v"; // horizontal only if clearly dominant
    }
  };
  const handleTouchEnd = (e) => {
    const s = swipeState.current;
    if (s.locked !== "h") return; // vertical scroll or undecided → ignore
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = Math.abs(e.changedTouches[0].clientY - s.y);
    swipeState.current = { x: 0, y: 0, locked: null };
    // Require strong horizontal swipe: min 72px, ratio 2.5:1 over vertical
    if (Math.abs(dx) < 72 || Math.abs(dx) < dy * 2.5) return;
    if (dx < 0 && mobileTabIdx < MOBILE_TABS.length - 1) {
      setDirection(1);
      setActiveSectionId(MOBILE_TABS[mobileTabIdx + 1]);
    } else if (dx > 0 && mobileTabIdx > 0) {
=======
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
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
      setDirection(-1);
      setActiveSectionId(MOBILE_TABS[mobileTabIdx - 1]);
    }
  };

  // Render del feed móvil según sección activa — sin navegar a página nueva
  function renderMobileFeed() {
<<<<<<< HEAD
    if (!activeSectionId) return <PerfilContent onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} visibleWidgets={visibleWidgets} sections={allSections} />;
=======
    if (!activeSectionId) return <PerfilContent onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} />;
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
    if (activeSectionId === "planning")      return <Planning      section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} mobileTab />;
    if (activeSectionId === "recaps")        return <Recaps        section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} mobileTab />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} mobileTab />;
    if (activeSectionId === "metrics")       return <MetricsContent />;
<<<<<<< HEAD
=======
    if (activeSectionId === "community")     return <CommunityChatContent section={activeSection} />;
    if (activeSectionId === "reviews")       return <ReviewsContent onBack={goHome} />;
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
    if (activeSectionId === "rooms")         return <RoomsContent />;
    return null;
  }

  return (
    <ThemeProvider themeConfig={profileConfig.theme}>
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, height: "100vh", background: C.surface, position: "relative", overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 120, borderRadius: "50%", background: `radial-gradient(ellipse, ${C.accentDim}55 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

        {/* ── TOP BAR: ← Home + nombre perfil (fija siempre) ── */}
<<<<<<< HEAD
        <MobileTopBar onHome={goHome} profileName={profileConfig.identity.name} onAIPanel={() => setShowAIPanel(v => !v)} onOpenSettings={onOpenSettings} />

        {/* ── STICKY BAR: Follow/Subscribe/Message + chips — always visible below topbar ── */}
        <div style={{ flexShrink: 0, zIndex: 20, background: `${C.surface}fa`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}` }}>
          {/* Action buttons row */}
          <div style={{ padding: "8px 14px 6px", display: "flex", gap: 8 }}>
            <motion.button whileTap={{ scale: 0.95 }}
              style={{ flex: 1, height: 34, borderRadius: 22, border: "none", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg, ${C.accent} 0%, #5c2fff 100%)`, color: "#fff", boxShadow: `0 4px 18px ${C.accent}50` }}>
              Follow
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }}
              style={{ flex: 1, height: 34, borderRadius: 22, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldLight} 50%, ${C.gold} 100%)`, border: "none", color: "#1a0f00", boxShadow: `0 4px 20px ${C.gold}45` }}>
              Subscribe
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }}
              style={{ flex: 1, height: 34, borderRadius: 22, border: "none", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg, ${C.blue} 0%, #2563eb 100%)`, color: "#fff", boxShadow: `0 4px 16px ${C.blue}40` }}>
              Message
            </motion.button>
          </div>
          {/* Chips */}
          <div style={{ padding: "4px 14px 8px" }}>
            <SectionChips activeSectionId={activeSectionId} onNavigate={(id) => { setDirection(MOBILE_TABS.indexOf(id) > mobileTabIdx ? 1 : -1); setActiveSectionId(id); }} onHome={() => { setDirection(-1); setActiveSectionId(null); }} onSections={allSections} onAddSection={() => setShowAddSection(true)} />
          </div>
=======
        <MobileTopBar onHome={goHome} profileName="Alex Herrera" />

        {/* ── PERFIL SUPERIOR: foto, nombre, stats, botones (sticky, se oculta al scroll) ── */}
        <div style={{ flexShrink: 0, zIndex: 10, background: C.surface }}>
          <ProfileCard onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} />
        </div>

        {/* ── CHIPS STICKY: siempre visibles sobre el feed ── */}
        <div style={{ flexShrink: 0, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: `${C.surface}f8`, backdropFilter: "blur(16px)", zIndex: 20, position: "sticky", top: 52 }}>
          <SectionChips activeSectionId={activeSectionId} onNavigate={(id) => { setDirection(MOBILE_TABS.indexOf(id) > mobileTabIdx ? 1 : -1); setActiveSectionId(id); }} onHome={() => { setDirection(-1); setActiveSectionId(null); }} />
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
        </div>

        {/* Role toggle dev tool */}
        <div style={{ position: "fixed", bottom: 20, right: 16, zIndex: 9998, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 4px 4px 10px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isHost ? "Host" : "Member"}</span>
          <button onClick={() => setIsHost(h => !h)} style={{ width: 34, height: 18, borderRadius: 9, border: "none", background: isHost ? C.accent : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <motion.div animate={{ x: isHost ? 16 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2 }} />
          </button>
        </div>

<<<<<<< HEAD
        {/* Add Section Modal */}
        <AnimatePresence>
          {showAddSection && (
            <AddSectionModal
              onAdd={(sec) => {
                const newSec = {
                  id: sec.id, label: sec.label, subtitle: sec.subtitle,
                  iconId: ICON_REG_OPTIONS.find(o => o.id === sec.iconId)?.id ?? "Hash",
                  accentColor: sec.accentColor, badge: null,
                  visible: true, order: allSections.length + 1, isBuiltIn: false,
                  icon: sec.icon, // runtime only
                };
                setProfileConfig(c => ({
                  ...c,
                  sections: [...c.sections, { ...newSec }],
                }));
              }}
              onClose={() => setShowAddSection(false)}
            />
          )}
        </AnimatePresence>

        {/* ── FEED: profile card scrolls away inside here, chips+buttons stay above ── */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
=======
        {/* ── FEED: solo esta zona cambia con chip/swipe ── */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
          <AnimatePresence mode="sync" custom={direction}>
            <motion.div key={activeSectionId ?? "perfil"} custom={direction} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={springTrans}
              style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
<<<<<<< HEAD
              {/* Profile header scrolls away inside the feed */}
              {!activeSectionId && (
                <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}20` }}>
                  <ProfileCard onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} hideButtons profile={{ ...profileConfig.identity, ...profileConfig.layout, stats: profileConfig.stats }} onEditAvatar={onOpenSettings} />
                </div>
              )}
=======
>>>>>>> 177ec30fcb6ef272b4e54fe703ef579a6529e380
              {renderMobileFeed()}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      <AnimatePresence>
        {showAIPanel && (
          <AIPromptPanel
            currentConfig={profileConfig}
            onApply={applyConfig}
            onClose={() => setShowAIPanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
    </ThemeProvider>
  );
}
