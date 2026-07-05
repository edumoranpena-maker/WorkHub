import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, FileText, Megaphone, Hash, MessageSquare,
  Bell, Search, ChevronLeft, ChevronRight, ArrowRight, Mic,
  Users, BarChart2, TrendingUp, TrendingDown, Star, X, Plus, Zap, Pencil, CheckSquare,
  Globe, Instagram, Youtube, Twitter, Linkedin, Github, Link as LinkIcon,
} from "lucide-react";
import HomeFeed      from "./HomeFeed.jsx";
import { NewDiffusionSheet, InstagramStoryCreator } from "./components/Sheets.jsx";
import ChecklistBlock   from "./components/ChecklistBlock.jsx";
import ChecklistEditor  from "./components/ChecklistEditor.jsx";
import BlockSelector    from "./components/BlockSelector.jsx";
import PostComposer     from "./components/PostComposer.jsx";
import PublishProgressBar from "./components/PublishProgressBar.jsx";
import Post          from "./sections/Post";
import Announcements, { StoryViewer } from "./sections/Announcements";

// ─── API imports ─────────────────────────────────────────────────────────────
import { createRecapThread } from "./lib/recapsApi.js";
import { PublishQueueProvider, usePublishQueue } from "./lib/publishQueue.jsx";
import { ComposerLockProvider, useComposerLock } from "./lib/composerLock.jsx";

// ─── Config + Engine imports ──────────────────────────────────────────────────
import { DEFAULT_PROFILE_CONFIG } from "./config/profileConfig.js";
import { resolveTheme, tokensToC }                   from "./config/themes.js";
import { resolveIcon, ICON_OPTIONS as ICON_REG_OPTIONS } from "./registry/icons.js";
import { ThemeProvider, useTheme }                   from "./engine/ThemeProvider.jsx";

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
const SECTIONS = DEFAULT_PROFILE_CONFIG.sections
  .filter(s => s.id !== "planning")
  .map(resolveSection);

// Latest post previews per section (for Perfil feed)
const PREVIEW_POSTS = {
  recaps:        { title: "Week 20 — Targets Hit",       excerpt: "XAUUSD confirmed the rejection at 2340. Target hit at 2310. Full breakdown inside.",                           author: "Alex H.",  timestamp: "Today",     tag: "Post"       },
  announcements: { title: "New Room Schedule — May",     excerpt: "Daily sessions now at 8 AM and 2 PM EST. Check the full calendar inside.",                                    author: "Admin",    timestamp: "Yesterday", tag: "Official"   },
  rooms:         { title: "🔴 Live: Pre-Market Session", excerpt: "Alex H. is hosting a live pre-market session. Join now for real-time analysis and trade setups.",             author: "Alex H.",  timestamp: "Live now",  tag: "Live"       },
};

// ─── Animations ───────────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (d) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
};
// Feed-only transitions: subtle fade + slight horizontal shift
// No full-screen slide — ProfileCard and Chips stay anchored
const feedVariants = {
  enter:  (d) => ({ x: d > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d) => ({ x: d > 0 ? -32 : 32, opacity: 0 }),
};
const feedTrans = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };
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
// State (followed/subscribed) is owned by App so it survives section changes.
// ProfileCard is purely presentational for those toggles.
// Maps a social platform id to an icon. Falls back to a generic globe icon for
// anything not explicitly listed yet — new platforms can be added here later
// without touching the rendering logic below.
const SOCIAL_ICON_MAP = {
  instagram: Instagram,
  x:         Twitter,
  twitter:   Twitter,
  youtube:   Youtube,
  linkedin:  Linkedin,
  github:    Github,
  website:   Globe,
};

function ProfileHeader({ onNavigate, hideButtons, profile, onEditAvatar,
                       followed, onToggleFollow, subscribed, onToggleSubscribe }) {
  const stats = profile?.stats ?? [
    { key: "followers", label: "Followers", value: "12.4k" },
    { key: "posts",      label: "Posts",     value: "86" },
    { key: "ev",         label: "Exp Value", value: "2.8R" },
  ];
  const socials = profile?.socials ?? [];

  return (
    <motion.div
      data-profile-card="1"
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ padding: "28px 20px 0" }}>

      {/* Avatar + name + handle — centered, like the leading social apps */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <div style={{ cursor: "pointer" }} onClick={() => onNavigate && onNavigate("announcements")}>
            <div style={{
              width: 84, height: 84, borderRadius: "50%",
              background: `conic-gradient(${C.orange} 0deg, #fbbf24 120deg, ${C.orange} 240deg, #fbbf24 360deg)`,
              padding: 3,
              boxShadow: `0 0 10px ${C.orange}30`,
            }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `3px solid ${C.bg}`, overflow: "hidden", background: `linear-gradient(135deg, ${C.accentDim}, #1a0a3a)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: C.accentLight, letterSpacing: "-0.02em" }}>A</span>
              </div>
            </div>
          </div>
          {profile?.showLiveDot !== false && (
            <div style={{ position: "absolute", bottom: 5, right: 5, width: 14, height: 14, borderRadius: "50%", background: C.green, border: `2px solid ${C.bg}`, boxShadow: `0 0 6px ${C.green}70` }} />
          )}
          {onEditAvatar && (
            <motion.button whileTap={{ scale: 0.88 }} onClick={onEditAvatar}
              style={{ position: "absolute", bottom: 0, left: 0, width: 25, height: 25, borderRadius: "50%", background: C.accent, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Pencil size={11} color="#fff" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <h2 style={{ margin: 0, fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{profile?.name ?? "Luis Morp"}</h2>
            {profile?.verified && (
              <div style={{ width: 15, height: 15, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: "#fff" }}>✓</span>
              </div>
            )}
          </div>
          <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 12, color: C.accentLight, fontWeight: 600, letterSpacing: "0.01em" }}>{profile?.handle ?? "@alexherrera.trades"}</p>
        </div>
      </div>

      {/* Stats — the main information block, full width, plenty of room */}
      {(profile?.showStats !== false) && (
        <div style={{ display: "flex", marginTop: 20 }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{
              flex: 1, textAlign: "center", padding: "0 8px",
              borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
            }}>
              <p style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>{s.value}</p>
              <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 11, color: C.textMuted }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bio */}
      {(profile?.showBio !== false) && (
        <p style={{ margin: "18px 0 0", fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.6, textAlign: "center" }}>
          {profile?.bio ?? "Trader & educator — 6+ years in FX & commodities."}{" "}
          {profile?.bioHighlight && <span style={{ color: C.accentLight, fontWeight: 600 }}>{profile.bioHighlight}</span>}
        </p>
      )}

      {/* Social links — ready for future integrations; empty by default, renders nothing until connected */}
      {socials.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
          {socials.map((s) => {
            const Icon = SOCIAL_ICON_MAP[s.platform] ?? LinkIcon;
            return (
              <motion.a key={s.platform + s.url} href={s.url} target="_blank" rel="noopener noreferrer" whileTap={{ scale: 0.88 }}
                style={{ width: 34, height: 34, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, cursor: "pointer" }}>
                <Icon size={15} strokeWidth={2} />
              </motion.a>
            );
          })}
        </div>
      )}

      {/* Action buttons — same functions, much quieter presentation */}
      {!hideButtons && <div style={{ display: "flex", gap: 9, marginTop: 20, paddingBottom: 18 }}>

        <motion.button whileTap={{ scale: 0.95 }} onClick={onToggleFollow}
          style={{
            flex: 1, height: 36, borderRadius: 22, cursor: "pointer",
            fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.01em",
            background: followed ? "transparent" : C.accent,
            border: followed ? `1.5px solid ${C.accent}` : "none",
            color: followed ? C.accent : "#fff",
            transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
          }}>
          {followed ? "Following" : "Follow"}
        </motion.button>

        <motion.button whileTap={{ scale: 0.95 }} onClick={onToggleSubscribe}
          style={{
            flex: 1, height: 36, borderRadius: 22, cursor: "pointer",
            fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
            background: subscribed ? "transparent" : C.gold,
            border: subscribed ? `1.5px solid ${C.gold}` : "none",
            color: subscribed ? C.gold : "#1a0f00",
            transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
          }}>
          {subscribed ? "Subscribed" : "Subscribe"}
        </motion.button>

        <motion.button whileTap={{ scale: 0.95 }}
          style={{
            flex: 1, height: 36, borderRadius: 22, border: "none", cursor: "pointer",
            fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.01em",
            background: C.blue,
            color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          Message
        </motion.button>
      </div>}
    </motion.div>
  );
}
// Backward-compatible alias — "Profile Card" no longer exists as a concept,
// this is now an integrated page header (see ProfileHeader above).
const ProfileCard = ProfileHeader;

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
        <motion.button whileTap={{ scale: 0.96 }} onClick={onHome}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em", color: "#eaeaf5" }}>
            Plan<span style={{ color: "#a78bfa" }}>Space</span>
          </span>
        </motion.button>
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
function MobileTopBar({ onHome, profileName, onOpenSettings }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", gap: 10, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f4`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 50, flexShrink: 0 }}>
      <motion.button whileTap={{ scale: 0.93 }} onClick={onHome}
        style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "4px 8px 4px 2px", borderRadius: 8, color: C.accentLight, flexShrink: 0 }}>
        <ChevronLeft size={22} strokeWidth={2.6} color={C.accentLight} />
      </motion.button>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <span style={{ fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileName}</span>
      </div>
      {/* Right icons: avatar (→ settings), bell, message, search */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
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
            <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.text, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.text}</p>
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
        <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.text, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.excerpt}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{post.author}</span>
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
function PerfilContent({ onNavigate, visibleWidgets, sections, isHost, onCreatePost }) {
  // Sections to show preview cards for (skip metrics — no PREVIEW_POSTS for it)
  const feedSections = (sections || SECTIONS).filter(s => PREVIEW_POSTS[s.id]);

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
            <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.55 }}>{r.text}</p>
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
                  <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{rep.text}</p>
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
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, color: C.text, lineHeight: 1.55 }}>{m.text}</p>
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
function CustomSectionContent({ section, checklists, onChecklistsChange }) {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCl, setEditingCl] = useState(null);

  const submit = () => {
    if (!text.trim()) return;
    setPosts(p => [{ id: Date.now(), text: text.trim(), author: "You", time: "just now" }, ...p]);
    setText("");
  };

  const color = section.accentColor || C.accent;
  const sectionChecklists = (checklists || []).filter(cl => cl.sectionId === section.id);

  const handleBlockSelect = (typeId) => {
    setShowSelector(false);
    if (typeId === "checklist") { setEditingCl(null); setShowEditor(true); }
  };

  const handleSaveChecklist = (cl) => {
    const withSection = { ...cl, sectionId: section.id };
    if (editingCl) {
      onChecklistsChange?.(checklists.map(c => c.id === cl.id ? withSection : c));
    } else {
      onChecklistsChange?.([...(checklists || []), withSection]);
    }
    setShowEditor(false);
    setEditingCl(null);
  };

  const handleDeleteChecklist = (id) => {
    onChecklistsChange?.((checklists || []).filter(c => c.id !== id));
  };

  const handleChecklistChange = (updated) => {
    onChecklistsChange?.((checklists || []).map(c => c.id === updated.id ? updated : c));
  };

  const isEmpty = posts.length === 0 && sectionChecklists.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>{section.label}</span>
        {editMode ? (
          <>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowSelector(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.teal}40`, background: `${C.teal}0e`, cursor: "pointer" }}>
              <Plus size={14} color={C.teal} strokeWidth={2.5} />
              <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.teal }}>Añadir bloque</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setEditMode(false)}
              style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted }}>
              Done
            </motion.button>
          </>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setEditMode(true)}
              style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted }}>
              Edit Panel
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }}
              style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.accent}30`, background: `${C.accent}0e`, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.accentLight }}>
              AI Designer
            </motion.button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {isEmpty && !editMode && (
          <div style={{ textAlign: "center", padding: "56px 24px" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <section.icon size={24} color={color} />
            </div>
            <p style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
              ¿Qué tienes planeado hacer aquí?
            </p>
            <p style={{ fontFamily: font, fontSize: 13, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>
              Usa el panel de edición para añadir contenido a esta sección.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => setEditMode(true)}
                style={{ padding: "9px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>
                Edit Panel
              </motion.button>
              <motion.button whileTap={{ scale: 0.92 }}
                style={{ padding: "9px 20px", borderRadius: 12, border: `1px solid ${C.accent}35`, background: `${C.accent}12`, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.accentLight }}>
                AI Designer
              </motion.button>
            </div>
          </div>
        )}

        {sectionChecklists.map(cl => (
          <div key={cl.id}>
            <ChecklistBlock checklist={cl} onChange={handleChecklistChange} accentColor={C.teal} />
            {editMode && (
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button onClick={() => { setEditingCl(cl); setShowEditor(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 11, fontWeight: 700, padding: "2px 0" }}>Edit</button>
                <button onClick={() => handleDeleteChecklist(cl.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4f6a", fontFamily: font, fontSize: 11, fontWeight: 700, padding: "2px 0" }}>Delete</button>
              </div>
            )}
          </div>
        ))}

        {posts.map(p => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{p.author}</span>
              <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{p.time}</span>
            </div>
            <p style={{ margin: 0, fontFamily: font, fontSize: 14, color: C.text, lineHeight: 1.55 }}>{p.text}</p>
          </motion.div>
        ))}
      </div>

      {/* Composer */}
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

      <AnimatePresence>
        {showSelector && <BlockSelector onSelect={handleBlockSelect} onClose={() => setShowSelector(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showEditor && <ChecklistEditor initial={editingCl} onSave={handleSaveChecklist} onClose={() => { setShowEditor(false); setEditingCl(null); }} />}
      </AnimatePresence>
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
  const [username,   setUsername]   = useState("Luis Morp");
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
                {["Luis Morp", "Trading Alt"].map((acc, i) => (
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
        <div style={{ background: "#000000", color: "#ff4f6a", fontFamily: "monospace", padding: 24, height: "100vh" }}>
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
    <PublishQueueProvider>
    <ComposerLockProvider>
      <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
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
        <PublishProgressBar />
      </div>
    </ComposerLockProvider>
    </PublishQueueProvider>
  );
}

// ─── Workspace App ────────────────────────────────────────────────────────────
function App({ onGoHome, onOpenSettings }) {
  const [activeSectionId, _setActiveSectionId] = useState(null); // null = Perfil
  const { locked: navLocked } = useComposerLock();
  // Guarded setter: while an Update/Subtema composer is open, every navigation
  // entry point (chips, sidebar, mobile swipe) becomes a no-op automatically.
  const setActiveSectionId = useCallback((id) => {
    if (navLocked) return;
    _setActiveSectionId(id);
  }, [navLocked]);
  const [direction,       setDirection]       = useState(1);
  const [isHost,          setIsHost]          = useState(true);
  const [openThreadId,    setOpenThreadId]    = useState(null);
  const [showAddSection,  setShowAddSection]  = useState(false);
  const [checklists,      setChecklists]      = useState([]); // master checklist store
  const [fabOpen,           setFabOpen]           = useState(false);
  const [insideThread,      setInsideThread]      = useState(false);

  // Close the purple speed-dial and reset thread flag whenever the section changes
  useEffect(() => { setFabOpen(false); setInsideThread(false); }, [activeSectionId]);

  const [showNewStory,      setShowNewStory]      = useState(false);
  const [showFullPostSheet, setShowFullPostSheet]  = useState(false);
  // Callback ref: Post registers this so App can prepend a created thread to the feed
  const onPostCreatedRef = useRef(null);
  // Callback ref: Announcements registers its handlePublishPost for mobile NewDiffusionSheet
  const annPublishRef = useRef(null);
  const { enqueue: enqueuePublish } = usePublishQueue();

  // Shared submit handler for the Post composer (create mode) — closes the
  // composer immediately (PostComposer already does this) and runs the actual
  // Supabase save in the background via the publish queue.
  const handlePublishNewPost = useCallback(({ title, content, mediaFiles, audio, visibility, checklist }) => {
    const rawFiles = (mediaFiles || []).filter(m => m.file).map(m => ({ file: m.file, type: m.type }));
    enqueuePublish("Publicando post…", async () => {
      const saved = await createRecapThread({
        title: title || null,
        content: content || "",
        privacy: visibility,
        audio,
        mediaFiles: rawFiles,
      });
      if (!saved) { console.error("[App] createRecapThread returned null — post was NOT saved"); return; }
      if (checklist) saved.checklist = checklist; // client-side only, not persisted (no Supabase column yet)
      onPostCreatedRef.current?.(saved);
    });
    setShowFullPostSheet(false);
    navigateTo("recaps");
  }, [enqueuePublish]); // eslint-disable-line

  // Callback ref: Announcements registers its handlePublishStory for mobile InstagramStoryCreator
  const annStoryRef = useRef(null);
  const [showAnnStory, setShowAnnStory] = useState(false);
  // Stories array + viewer index for mobile StoryViewer, rendered at App's root
  const [annStories, setAnnStories]         = useState([]);
  const [viewingAnnStory, setViewingAnnStory] = useState(null);
  const [annComposerSignal, setAnnComposerSignal]  = useState(0); // increment to trigger
  const [annStorySignal,    setAnnStorySignal]     = useState(0);
  const [showAnnComposer,   setShowAnnComposer]    = useState(false); // mobile fullscreen sheet
  // ── Persistent button state — survives section changes ──────────────────────
  const [followed,        setFollowed]        = useState(false);
  const [subscribed,      setSubscribed]      = useState(false);

  // ── Central profile config — static source of truth, render engine reads it ──
  const [profileConfig, setProfileConfig] = useState(DEFAULT_PROFILE_CONFIG);

  // Derive runtime data from profileConfig
  const allSections   = useMemo(
    () => profileConfig.sections
      .filter(s => s.visible && s.id !== "planning")
      .sort((a,b) => a.order - b.order)
      .map(resolveSection),
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
    if (navLocked) return;
    if (sectionId === activeSectionId) return;
    setOpenThreadId(null);
    setDirection(activeSectionId === null ? 1 : 1);
    setActiveSectionId(sectionId);
  }, [activeSectionId, navLocked]);

  const navigateTo = useCallback((sectionId, threadId) => {
    setOpenThreadId(threadId || null);
    setDirection(1);
    setActiveSectionId(sectionId);
  }, []);

  const goHome = useCallback(() => {
    if (navLocked) return;
    // If we're in a section, first go to Perfil tab
    if (activeSectionId) {
      setOpenThreadId(null);
      setDirection(-1);
      setActiveSectionId(null);
      return;
    }
    // If already on Perfil tab, go back to HomeFeed
    if (onGoHome) onGoHome();
  }, [activeSectionId, onGoHome, navLocked]);

  const activeSection = allSections.find(s => s.id === activeSectionId) || null;
  const accentColor   = activeSection?.accentColor || C.accent;

  function renderContent() {
    if (!activeSectionId)                    return <PerfilContent onNavigate={navigate} visibleWidgets={visibleWidgets} sections={allSections} isHost={isHost} onCreatePost={(text) => { navigateTo("recaps"); }} />;
    // planning removed
    if (activeSectionId === "recaps")        return <Post          section={{ ...activeSection, label: "Post" }} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} onThreadChange={setInsideThread} onRegisterPostCallback={cb => { onPostCreatedRef.current = cb; }} />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openComposerSignal={annComposerSignal} openStorySignal={annStorySignal} />;
    if (activeSectionId === "metrics")       return <MetricsContent />;
    if (activeSectionId === "rooms")         return <RoomsContent />;
    const customSec = allSections.find(s => s.id === activeSectionId && !["recaps","announcements","metrics","rooms"].includes(activeSectionId));
    if (customSec) return <CustomSectionContent section={customSec} checklists={checklists} onChecklistsChange={setChecklists} />;
    return null;
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <ThemeProvider themeConfig={profileConfig.theme}>
      <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", overflow: "hidden" }}>
        <Sidebar activeSectionId={activeSectionId} onNavigate={navigate} onHome={goHome} onSections={allSections} onAddSection={() => setShowAddSection(true)} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar — Perfil web: profile name left, actions right */}
          <div style={{ flexShrink: 0, zIndex: 30, background: `${C.surface}f4`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: "flex", alignItems: "center" }}>
            {/* Left: profile name */}
            <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", flexShrink: 0 }}>
              {profileConfig.identity.name}
            </span>

            {/* Center spacer */}
            <div style={{ flex: 1 }} />

            {/* Right: actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <IconBtn icon={Search} />
              <IconBtn icon={MessageSquare} />
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
                <ProfileCard
                  onNavigate={navigate}
                  profile={{ ...profileConfig.identity, ...profileConfig.layout, stats: profileConfig.stats, socials: profileConfig.socials }}
                  onEditAvatar={onOpenSettings}
                  followed={followed}
                  onToggleFollow={() => setFollowed(f => !f)}
                  subscribed={subscribed}
                  onToggleSubscribe={() => setSubscribed(s => !s)}
                />
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

      {/* ── PURPLE FAB — desktop: Post feed ── */}
      {isHost && (!activeSectionId || activeSectionId === "recaps") && !insideThread && (
        <>
          <AnimatePresence>
            {fabOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setFabOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(8,8,14,0.55)", backdropFilter: "blur(6px)" }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ position: "fixed", bottom: 100, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}
              >
                {[
                  { label: "Crear Post",     icon: FileText,  color: C.accent, action: () => { setFabOpen(false); setShowFullPostSheet(true); } },
                  { label: "Crear Difusión", icon: Megaphone, color: C.orange, action: () => { setFabOpen(false); navigateTo("announcements"); setTimeout(() => setAnnComposerSignal(n => n + 1), 300); } },
                  { label: "Crear Story",    icon: Zap,       color: C.gold,   action: () => { setFabOpen(false); navigateTo("announcements"); setTimeout(() => setAnnStorySignal(n => n + 1), 300); } },
                ].map((opt, i) => (
                  <motion.div key={opt.label} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.05 }}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                      {opt.label}
                    </span>
                    <motion.button whileTap={{ scale: 0.88 }} onClick={opt.action}
                      style={{ width: 46, height: 46, borderRadius: "50%", background: `${opt.color}22`, border: `2px solid ${opt.color}55`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 16px ${opt.color}40` }}>
                      <opt.icon size={18} color={opt.color} />
                    </motion.button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }} onClick={() => setFabOpen(v => !v)}
            style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: fabOpen ? `linear-gradient(135deg, #1a1a2e, #2d2d4a)` : `linear-gradient(135deg, ${C.accent}, #5c2fff)`, boxShadow: fabOpen ? `0 4px 20px rgba(0,0,0,0.5)` : `0 6px 28px ${C.accent}70, 0 0 0 1px ${C.accent}30` }}>
            <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
              <Plus size={26} color="#fff" strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        </>
      )}

      {/* ── ORANGE FAB — desktop: Announcements ── */}
      {isHost && activeSectionId === "announcements" && (
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}
          onClick={() => setAnnComposerSignal(n => n + 1)}
          style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 28px rgba(245,158,11,0.7), 0 0 0 1px rgba(245,158,11,0.3)" }}>
          <Plus size={26} color="#000" strokeWidth={2.5} />
        </motion.button>
      )}

      {/* Full New Post Sheet */}
      <AnimatePresence>
        {showFullPostSheet && (
          <PostComposer
            mode="post"
            checklists={checklists}
            onSubmit={handlePublishNewPost}
            onClose={() => setShowFullPostSheet(false)}
          />
        )}
      </AnimatePresence>

      </ThemeProvider>
    );
  }

  // ── MOBILE ── Tabs integradas: perfil fijo arriba, feed cambia por chip/swipe
  const MOBILE_TABS = [null, ...allSections.map(s => s.id)]; // null = Perfil/home feed
  const mobileTabIdx = MOBILE_TABS.indexOf(activeSectionId);

  // Swipe horizontal — deliberate (Twitter/Whop style): vertical always wins
  const swipeState = useRef({ x: 0, y: 0, locked: null }); // locked: "h"|"v"|null

  // ── UNIFIED SCROLL (Instagram-style) ────────────────────────────────────────
  // Single scroll container holds the profile header + Chips + Feed as one
  // document. The header disappears naturally as part of the flow, like any
  // ordinary page header — no special hidden-state tracking needed for it.
  // Chips are position:sticky so they lock below the topbar automatically.
  const unifiedScrollRef = useRef(null);
  const savedScrollTop   = useRef({});   // persist scroll position per section
  const preThreadScrollTop = useRef(0);  // exact scroll position from right before a thread was opened

  // Thread reading-mode: hide the profile header, freeze the background scroll,
  // and restore the exact prior scroll position on exit.
  useEffect(() => {
    const el = unifiedScrollRef.current;
    if (!el) return;
    if (insideThread) {
      preThreadScrollTop.current = el.scrollTop;
      el.scrollTop = 0; // header is about to unmount — chips should sit pinned at the very top, not wherever they were stuck before
    } else {
      el.scrollTop = preThreadScrollTop.current;
    }
  }, [insideThread]);

  // When section changes, restore saved scroll position
  const onSectionChange = useCallback((id) => {
    // Save current scroll
    if (unifiedScrollRef.current) {
      savedScrollTop.current[activeSectionId ?? "perfil"] = unifiedScrollRef.current.scrollTop;
    }
  }, [activeSectionId]);

  // scrollProps is kept for passing to child sections that have own scroll containers
  // For sections that DON'T have their own scroll (Perfil), the unified container handles it
  const handleFeedScroll = useCallback(() => {}, []); // no-op: unified scroll handles everything
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
      setDirection(-1);
      setActiveSectionId(MOBILE_TABS[mobileTabIdx - 1]);
    }
  };

  // Render del feed móvil según sección activa — sin navegar a página nueva
  function renderMobileFeed() {
    // No scrollProps — unified scroll container handles scrolling for all sections
    if (!activeSectionId) return <PerfilContent onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} visibleWidgets={visibleWidgets} sections={allSections} isHost={isHost} onCreatePost={() => { navigateTo("recaps"); }} />;
    if (activeSectionId === "recaps")        return <Post          section={{ ...activeSection, label: "Post" }} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} onThreadChange={setInsideThread} onRegisterPostCallback={cb => { onPostCreatedRef.current = cb; }} />;
    if (activeSectionId === "announcements") return <Announcements section={activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} mobileTab openComposerSignal={annComposerSignal} openStorySignal={annStorySignal} onShowComposer={() => setShowAnnComposer(true)} onRegisterAnnPublish={cb => { annPublishRef.current = cb; }} onShowStory={() => setShowAnnStory(true)} onRegisterAnnStory={cb => { annStoryRef.current = cb; }} onShowStoryViewer={i => setViewingAnnStory(i)} onRegisterAnnStories={arr => setAnnStories(arr)} />;
    if (activeSectionId === "metrics")       return <MetricsContent />;
    if (activeSectionId === "rooms")         return <RoomsContent />;
    return null;
  }

  return (
    <ThemeProvider themeConfig={profileConfig.theme}>
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, height: "100vh", background: C.surface, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,0.7)" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 120, borderRadius: "50%", background: `radial-gradient(ellipse, ${C.accentDim}55 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

        {/* ── TOPBAR — always fixed above everything ── */}
        <div style={{ flexShrink: 0, zIndex: 30 }}>
          <MobileTopBar
            onHome={goHome}
            profileName={profileConfig.identity.name}
            onOpenSettings={onOpenSettings}
          />
        </div>

        {/*
          ── SINGLE SCROLL CONTAINER — never remounts ─────────────────────────
          ProfileCard and Chips live here permanently.
          Only the feed content area transitions between sections.
        */}
        <div
          ref={unifiedScrollRef}
          style={{
            flex: 1, overflowX: "hidden", position: "relative", zIndex: 1, background: C.surface,
            overflowY: insideThread ? "hidden" : "auto",
            ...(insideThread ? { display: "flex", flexDirection: "column" } : {}),
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* 1. Profile header — hidden completely while reading a Thread (independent reading mode) */}
          {!insideThread && (
            <ProfileCard
              onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }}
              profile={{ ...profileConfig.identity, ...profileConfig.layout, stats: profileConfig.stats, socials: profileConfig.socials }}
              onEditAvatar={onOpenSettings}
              followed={followed}
              onToggleFollow={() => setFollowed(f => !f)}
              subscribed={subscribed}
              onToggleSubscribe={() => setSubscribed(s => !s)}
            />
          )}
          {/* 2. Chips — sticky, always mounted, never animates */}
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 25,
            flexShrink: 0,
            background: `${C.surface}fd`,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ padding: "6px 14px 8px" }}>
              <SectionChips
                activeSectionId={activeSectionId}
                onNavigate={(id) => { onSectionChange(id); setDirection(MOBILE_TABS.indexOf(id) > mobileTabIdx ? 1 : -1); setActiveSectionId(id); }}
                onHome={() => { onSectionChange(null); setDirection(-1); setActiveSectionId(null); }}
                onSections={allSections}
                onAddSection={() => setShowAddSection(true)}
              />
            </div>
          </div>

          {/* 3. Feed — only this area transitions. Bounded height while inside a
              Thread so its own internal scroll becomes the ONLY scrollable region
              (this is what stops scroll-chaining back into the ProfileCard). */}
          <div style={insideThread
            ? { position: "relative", background: C.bg, flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
            : { position: "relative", background: C.bg, minHeight: "50vh" }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeSectionId ?? "perfil"}
                custom={direction}
                variants={feedVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={feedTrans}
                style={insideThread ? { willChange: "opacity, transform", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : { willChange: "opacity, transform" }}
              >
                {renderMobileFeed()}
                {!insideThread && <div style={{ height: 40 }} />}
              </motion.div>
            </AnimatePresence>
          </div>

        </div>

        {/* Role toggle */}
        <div style={{ position: "fixed", bottom: 20, right: 16, zIndex: 9998, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 4px 4px 10px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isHost ? "Host" : "Member"}</span>
          <button onClick={() => setIsHost(h => !h)} style={{ width: 34, height: 18, borderRadius: 9, border: "none", background: isHost ? C.accent : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <motion.div animate={{ x: isHost ? 16 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2 }} />
          </button>
        </div>

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
                  icon: sec.icon,
                };
                setProfileConfig(c => ({ ...c, sections: [...c.sections, { ...newSec }] }));
              }}
              onClose={() => setShowAddSection(false)}
            />
          )}
        </AnimatePresence>

      </div>

      {/* ══ UNIVERSAL FAB ══════════════════════════════════════════════════════
          Rendered as a direct child of the root div — OUTSIDE all overflow:hidden
          and transform containers. position:fixed works reliably here.
          Shows on: Home, Profile, Post main feed.
          Hidden on: inside a thread, settings, modals.
      ══════════════════════════════════════════════════════════════════════════ */}
      {isHost && (!activeSectionId || activeSectionId === "recaps") && !insideThread ? (
        <>
          {/* Backdrop */}
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setFabOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(8,8,14,0.55)", backdropFilter: "blur(6px)" }}
              />
            )}
          </AnimatePresence>

          {/* Speed-dial options */}
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ position: "fixed", bottom: 100, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}
              >
                {[
                  { label: "Crear Post",       icon: FileText,  color: C.accent,    action: () => { setFabOpen(false); setShowFullPostSheet(true); } },
                  { label: "Crear Difusión",   icon: Megaphone, color: C.orange,    action: () => { setFabOpen(false); navigateTo("announcements"); setTimeout(() => setShowAnnComposer(true), 50); } },
                  { label: "Crear Story",      icon: Zap,       color: C.gold,      action: () => { setFabOpen(false); navigateTo("announcements"); setTimeout(() => setShowAnnStory(true), 50); } },
                ].map((opt, i) => (
                  <motion.div
                    key={opt.label}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                      {opt.label}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={opt.action}
                      style={{ width: 46, height: 46, borderRadius: "50%", background: `${opt.color}22`, border: `2px solid ${opt.color}55`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 16px ${opt.color}40` }}
                    >
                      <opt.icon size={18} color={opt.color} />
                    </motion.button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main FAB — purple, always fixed, always visible */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.88 }}
            onClick={() => setFabOpen(v => !v)}
            style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: fabOpen ? `linear-gradient(135deg, #1a1a2e, #2d2d4a)` : `linear-gradient(135deg, ${C.accent}, #5c2fff)`, boxShadow: fabOpen ? `0 4px 20px rgba(0,0,0,0.5)` : `0 6px 28px ${C.accent}70, 0 0 0 1px ${C.accent}30` }}
          >
            <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
              <Plus size={26} color="#fff" strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        </>
      ) : null}

      {/* ── ORANGE FAB — Announcements, fixed at App level ── */}
      {isHost && activeSectionId === "announcements" && (
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}
          onClick={() => setShowAnnComposer(true)}
          style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 28px rgba(245,158,11,0.7), 0 0 0 1px rgba(245,158,11,0.3)" }}
        >
          <Plus size={26} color="#000" strokeWidth={2.5} />
        </motion.button>
      )}


      {/* ── NEW DIFFUSION SHEET — mobile fullscreen, at root to escape stacking contexts ── */}
      <AnimatePresence>
        {showAnnComposer && (
          <NewDiffusionSheet
            onClose={() => setShowAnnComposer(false)}
            onPublish={(data) => {
              if (annPublishRef.current) {
                annPublishRef.current({ type: data.postType, content: data.text, imgPreview: data.mediaFiles?.[0]?.url || null, status: data.status });
              }
              setShowAnnComposer(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── STORY CREATOR — mobile fullscreen, at root to escape stacking contexts ── */}
      <AnimatePresence>
        {showAnnStory && (
          <InstagramStoryCreator
            onClose={() => setShowAnnStory(false)}
            onPublish={(data) => {
              if (annStoryRef.current) { annStoryRef.current(data); }
              setShowAnnStory(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── STORY VIEWER (Announcements) — mobile fullscreen, at root to escape stacking contexts ──
          Reuses the exact same StoryViewer component used on desktop (imported from
          Announcements.jsx), fed by the stories array Announcements registers via
          onRegisterAnnStories. Same component, same logic — no duplication. */}
      <AnimatePresence>
        {viewingAnnStory !== null && (
          <StoryViewer
            stories={annStories}
            startIndex={viewingAnnStory}
            onClose={() => setViewingAnnStory(null)}
            isHost={isHost}
          />
        )}
      </AnimatePresence>

      {/* Full New Post Sheet */}
      <AnimatePresence>
        {showFullPostSheet && (
          <PostComposer
            mode="post"
            checklists={checklists}
            onSubmit={handlePublishNewPost}
            onClose={() => setShowFullPostSheet(false)}
          />
        )}
      </AnimatePresence>


      {/* Story Creator — InstagramStoryCreator */}
      <AnimatePresence>
        {showNewStory && (
          <InstagramStoryCreator
            onClose={() => setShowNewStory(false)}
            onPublish={() => { setShowNewStory(false); navigateTo("announcements"); }}
          />
        )}
      </AnimatePresence>
    </div>
    </ThemeProvider>
  );
}
