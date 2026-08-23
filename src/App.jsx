import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, FileText, Megaphone, Hash, MessageSquare,
  Bell, Search, ChevronLeft, ChevronRight, ArrowRight, Mic,
  Users, BarChart2, TrendingUp, TrendingDown, Star, X, Plus, Zap, Pencil, CheckSquare,
} from "lucide-react";
import ProfileRegion from "./components/ProfileRegion.jsx";
import HomeFeed      from "./HomeFeed.jsx";
import { NewDiffusionSheet, InstagramStoryCreator } from "./components/Sheets.jsx";
import ChecklistBlock   from "./components/ChecklistBlock.jsx";
import ChecklistEditor  from "./components/ChecklistEditor.jsx";
import BlockSelector    from "./components/BlockSelector.jsx";
import PostComposer     from "./components/PostComposer.jsx";
import PublishProgressBar from "./components/PublishProgressBar.jsx";
import Post          from "./sections/Post";
import Announcements, { StoryViewer } from "./sections/Announcements";
import Stats          from "./sections/Stats";
import Tools          from "./sections/Tools";
import { PageContainer } from "./lib/layout.jsx";

// ─── API imports ─────────────────────────────────────────────────────────────
import { createRecapThread } from "./lib/recapsApi.js";
import { fetchAllTimeStats } from "./lib/statsApi.js";
import { PublishQueueProvider, usePublishQueue } from "./lib/publishQueue.jsx";
import { ComposerLockProvider, useComposerLock } from "./lib/composerLock.jsx";
import { WorkContextProvider, useWorkContextStore } from "./lib/workContext.jsx";
import { NavigationProvider, useNavigation, sectionIdToRouteId, routeIdToSectionId } from "./lib/navigation.jsx";

// ─── Config + Engine imports ──────────────────────────────────────────────────
import { DEFAULT_PROFILE_CONFIG } from "./config/profileConfig.js";
import { resolveTheme, tokensToC }                   from "./config/themes.js";
import { resolveIcon, ICON_OPTIONS as ICON_REG_OPTIONS } from "./registry/icons.js";
import { ThemeProvider, useTheme }                   from "./engine/ThemeProvider.jsx";

// ─── Winrate placeholder persistence ───────────────────────────────────────
// No existing cache/storage mechanism in this project holds a single scalar
// like this one (WorkContextProvider is a TTL'd in-memory store for section
// state like scroll position, not meant to survive a reload — checked
// before adding this), so a small dedicated localStorage key is the
// smallest fit rather than reusing something not built for persistence.
// Only ever written a valid finite number — never null/undefined/"—" (see
// refreshStats in App() below, the only call site for the write side).
const WINRATE_CACHE_KEY = "xplannation:lastWinrate";
function readCachedWinrate() {
  try {
    const raw = localStorage.getItem(WINRATE_CACHE_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; } // private browsing / storage disabled — degrade to no placeholder, never throw
}
function writeCachedWinrate(n) {
  try {
    if (typeof n === "number" && Number.isFinite(n)) localStorage.setItem(WINRATE_CACHE_KEY, String(n));
  } catch { /* ignore — same as above */ }
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
// C and font are now derived from ThemeProvider at runtime.
// Components inside ThemeProvider use useTheme() to access them.
// For components defined OUTSIDE the provider tree (none currently), use CSS vars.
const font = "'DM Sans', sans-serif"; // still needed for non-themed static strings

// Fallback C for module-level code (replaced by useTheme() inside components)
const C = tokensToC(resolveTheme("dark-purple"));

// ─── New Brand Identity (transición en curso) ────────────────────────────────
// PlanSpace's incoming visual identity. NOT a replacement for the theme
// system above — existing components keep using C.accent/etc (today's
// purple) until the full color refactor happens. These two constants are
// only for genuinely NEW or redesigned UI (starting with the TabBar below),
// so new work stops extending the old purple branding without having to
// touch every existing surface today.
const BRAND_PRIMARY = "#6B7DFF"; // blue-gray — the new primary
const BRAND_ACCENT   = "#2DD4BF"; // teal — active states, indicators, key interactive elements

// ─── Desktop Layout System ──────────────────────────────────────────────────
// See lib/layout.jsx for the definitive container system (Reading/Feed/
// Dashboard) — this is the single source of truth for width across the whole
// app now. App.jsx's own chrome (Profile + TabBar, always "feed") uses it
// below; every section/composer/portal picks its own variant at its own
// definition site — see the per-file usage for which variant each uses.

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
  recaps:        { title: "Week 20 — Targets Hit",       excerpt: "XAUUSD confirmed the rejection at 2340. Target hit at 2310. Full breakdown inside.",                           author: "Luis Morp",  timestamp: "Today",     tag: "Post"       },
  announcements: { title: "New Room Schedule — May",     excerpt: "Daily sessions now at 8 AM and 2 PM EST. Check the full calendar inside.",                                    author: "Admin",    timestamp: "Yesterday", tag: "Official"   },
  rooms:         { title: "🔴 Live: Pre-Market Session", excerpt: "Alex H. is hosting a live pre-market session. Join now for real-time analysis and trade setups.",             author: "Alex H.",  timestamp: "Live now",  tag: "Live"       },
};

// ─── Animations ───────────────────────────────────────────────────────────────
// Feed-only transitions: subtle fade + slight horizontal shift
// No full-screen slide — ProfileRegion stays anchored
const feedVariants = {
  enter:  (d) => ({ x: d > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d) => ({ x: d > 0 ? -32 : 32, opacity: 0 }),
};
const feedTrans = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

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

// ─── TopBar ───────────────────────────────────────────────────────────────────
// The one bar in the whole app that's deliberately edge-to-edge, full
// viewport width — everything else (Profile, TabBar, feeds) lives inside
// PageContainer. A 3-column CSS grid (not flex + space-between) is what
// guarantees the profile name is *actually* centered on the viewport
// regardless of how wide the left cluster (chevron + wordmark) or right
// cluster (icons) end up being — flex space-between would bias the center
// toward whichever side is narrower.
function TopBar({ onHome, profileName, onOpenSettings, isDesktop, showProfileName }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
      padding: isDesktop ? "12px 28px" : "8px 14px", gap: 10,
      borderBottom: `1px solid ${C.border}`, background: `${C.surface}f4`,
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      position: "sticky", top: 0, zIndex: 30, minHeight: isDesktop ? 56 : 50, flexShrink: 0,
    }}>
      {/* Left — chevron always, "PlanSpace" wordmark too on desktop (this is
          where it lived back when there was a sidebar; it belongs here now
          that the sidebar is gone) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifySelf: "start", minWidth: 0 }}>
        <motion.button whileTap={{ scale: 0.93 }} onClick={onHome}
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "4px 2px 4px 0", borderRadius: 8, color: C.accentLight, flexShrink: 0 }}>
          <ChevronLeft size={22} strokeWidth={2.6} color={C.accentLight} />
        </motion.button>
        {isDesktop && (
          <span style={{ fontFamily: font, fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, whiteSpace: "nowrap" }}>
            Plan<span style={{ color: BRAND_ACCENT }}>Space</span>
          </span>
        )}
      </div>

      {/* Center — profile name. Contextual: only shown once the Profile
          Header has scrolled out of view (see profileVisible/IntersectionObserver
          in the root component) — the identity lives in exactly one place on
          screen at a time, never duplicated. Grid keeps it truly centered
          regardless of how wide either side ends up being, whether the name
          is currently mounted or not. */}
      <AnimatePresence mode="wait">
        {showProfileName && (
          <motion.span
            key="topbar-profile-name"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{ fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: isDesktop ? 320 : 160, justifySelf: "center" }}>
            {profileName}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Right — actions, flush to the far edge */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, justifySelf: "end", flexShrink: 0 }}>
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
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 15px", flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onNavigate("stats")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Latest Trades</span>
        <span style={{ fontFamily: font, fontSize: 10, color: C.accentLight, fontWeight: 600 }}>→ Stats</span>
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
function PerfilContent({ onNavigate, visibleWidgets, sections, isHost, onCreatePost, isDesktop }) {
  // Sections to show preview cards for (skip metrics — no PREVIEW_POSTS for it)
  const feedSections = (sections || SECTIONS).filter(s => PREVIEW_POSTS[s.id]);

  return (
    <PageContainer isDesktop={isDesktop} variant="feed">
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
    </PageContainer>
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
  const isDesktop = useIsDesktop();
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
    <PageContainer isDesktop={isDesktop} variant="feed">
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
    </PageContainer>
  );
}

// ─── Custom Section ──────────────────────────────────────────────────────────
function CustomSectionContent({ section, checklists, onChecklistsChange }) {
  const isDesktop = useIsDesktop();
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
    <PageContainer isDesktop={isDesktop} variant="feed">
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
    </PageContainer>
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
  const [handle,     setHandle]     = useState("luismorp");
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
  return (
    <WorkContextProvider>
    <PublishQueueProvider>
    <ComposerLockProvider>
    <NavigationProvider>
      <RootShellInner />
    </NavigationProvider>
    </ComposerLockProvider>
    </PublishQueueProvider>
    </WorkContextProvider>
  );
}

// Split out from RootShell only so it can call useNavigation() — that hook
// needs to be BELOW <NavigationProvider> in the tree, and RootShell is what
// mounts the provider.
function RootShellInner() {
  const { route, navigate } = useNavigation();
  const [showSettings, setShowSettings] = useState(false);
  const showHome = route.routeId === "home";

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      {showHome ? (
        <HomeFeed onEnterProfile={() => navigate("profile")} />
      ) : (
        <ErrorBoundary>
          <App
            onGoHome={() => navigate("home")}
            onOpenSettings={() => setShowSettings(true)}
          />
        </ErrorBoundary>
      )}
      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
      <PublishProgressBar />
    </div>
  );
}

// ─── Workspace App ────────────────────────────────────────────────────────────
function App({ onGoHome, onOpenSettings }) {
  const { route, navigate: navigateRoute, goBack: goBackRoute } = useNavigation();
  // activeSectionId is now DERIVED from the real route — there's no local
  // state that can drift out of sync with the URL, because there's only
  // one thing that can change it (navigateRoute, below every entry point:
  // chips, sidebar, mobile swipe, the Perfil grid, FAB shortcuts). Same
  // vocabulary App's render tree already used (recaps/announcements/stats/
  // tools/rooms, or null for Perfil) — routeIdToSectionId is the one place
  // that translates to/from the route table.
  const activeSectionId = routeIdToSectionId(route.routeId);
  const { locked: navLocked } = useComposerLock();
  // Guarded direct section-setter — every call site that used to flip
  // activeSectionId state directly now goes through this, which is what
  // makes the URL and the visible section impossible to disagree: there is
  // only one function in the whole component that can change either.
  const setActiveSectionId = useCallback((id) => {
    if (navLocked) return;
    navigateRoute(sectionIdToRouteId(id));
  }, [navLocked, navigateRoute]);
  const [direction,       setDirection]       = useState(1);
  const [isHost,          setIsHost]          = useState(true);
  // openThreadId/threadId/subtemaId now come straight from the URL's own
  // params — Post.jsx already expected an "openThreadId" prop from before
  // deep-linking existed at all, so it keeps that exact contract; it's just
  // sourced from the route now instead of local App state.
  const openThreadId = (route.routeId === "thread" || route.routeId === "subtema") ? route.params.threadId : null;
  const openSubtemaId = route.routeId === "subtema" ? route.params.subtemaId : null;
  const openToolId = route.routeId === "tool" ? route.params.toolId : null;
  // openUpdateId/openAnnouncementId: the old deep-link system used to seed
  // these from a parsed URL for a one-shot "please open this specific
  // thing" request; Post.jsx/Announcements.jsx still take them as props for
  // that same purpose (not for "what's currently open" — that's
  // openThreadId/openSubtemaId above, which now IS the URL). Real deep
  // links for updates/announcement-stories aren't in this pass's scope
  // (see the navigation.jsx header — Announcements isn't touched here), so
  // these simply stay null, same as they did right after the last removal.
  const [openUpdateId,       setOpenUpdateId]       = useState(null); // → Post
  const [openAnnouncementId, setOpenAnnouncementId] = useState(null); // → Announcements
  const [showAddSection,  setShowAddSection]  = useState(false);
  const [checklists,      setChecklists]      = useState([]); // master checklist store
  const [fabOpen,           setFabOpen]           = useState(false);
  // Freezes whichever section is mounted underneath (unified scroll + hidden
  // profile header) while ANY fullscreen portal overlay is open on top of it —
  // Thread (Post.jsx) or the Stats Dashboard portal. Both report in via the
  // same boolean, same as Post.jsx's onThreadChange / Stats.jsx's
  // onDashboardChange contracts.
  const [insideFullscreenOverlay, setInsideFullscreenOverlay] = useState(false);

  // "Registrar" (Post/Subtema → Doers Journal → Nuevo Trade). Lifted here,
  // same reasoning as insideFullscreenOverlay just above: Registrar lives in
  // Post.jsx, but the Dashboard portal that needs to read it lives in
  // Stats.jsx — two permanently-mounted sibling sections with no shared
  // parent state of their own, so App.jsx is the natural (and, per this
  // task's own instructions, preferred) place to hold it temporarily.
  //
  // Not itself a navigation mechanism — navigateRoute("statsDashboard")
  // right below is what actually moves the user there; this is purely the
  // "what was I registering for" payload that rides along for the ~one
  // screen's worth of time between Registrar and Doers Journal confirming
  // trade:saved (or the user cancelling). Cleared by Stats.jsx's
  // handleCloseDashboard on EVERY dashboard close — success or cancel —
  // so it can never leak into an unrelated later Registrar session.
  const [pendingTradeContext, setPendingTradeContext] = useState(null);

  // Post/ThreadView's "Registrar" action calls this with
  // { source: "post", postId } or { source: "subtema", postId, subtemaId }.
  // navigate("statsDashboard") — never replace(), never navigating straight
  // to "stats" — is what stacks the Dashboard on top of whatever Post/
  // Subtema route the user was already on, so goBack() (fired either by
  // the Dashboard's own topbar Back button or by a valid trade:saved)
  // lands the user back on that exact instance.
  const handleRegisterTrade = useCallback((context) => {
    setPendingTradeContext(context);
    navigateRoute("statsDashboard");
  }, [navigateRoute]);

  // Fires once, right after Stats.jsx's DashboardOverlay successfully
  // records a new Post↔Trade link (see postTradeLinksApi.js) following a
  // valid trade:saved — never on a normal "Ver Dashboard completo" visit,
  // which never has a pendingTradeContext to link against. Post.jsx reacts
  // to this to optimistically bump its own tradeCounts map by 1 for that
  // postId, so "Registrar (N)" updates the instant the user is back,
  // without waiting on a full re-fetch. The link itself is already
  // persisted in Supabase by the time this fires, so a page reload
  // recomputes the same true count independently — this is purely the
  // "don't make the user wait for it" optimistic layer on top of that.
  const [tradeLinkedSignal, setTradeLinkedSignal] = useState(null); // { postId, at } | null
  const handleTradeLinked = useCallback((postId) => {
    setTradeLinkedSignal({ postId, at: Date.now() });
  }, []);

  // ── All-Time stats (Doers) — single source of truth, shared by Stats.jsx's
  // own summary cards AND Perfil's Winrate stat ──────────────────────────────
  // This USED to be two independent fetchAllTimeStats() calls: one here
  // (refetching only when tradeLinkedSignal changed — i.e. only after a
  // NEW trade was registered via Registrar) and one inside Stats.jsx
  // itself (refetching on mount AND every time the Dashboard portal
  // closed, for ANY reason). That mismatch was exactly why Perfil lagged
  // behind Stats: deleting a trade in Doers never touched
  // tradeLinkedSignal at all, so Perfil never found out, while Stats
  // always refreshes on close regardless of add/delete.
  //
  // Now there's exactly one fetchAllTimeStats() call site, one piece of
  // state, and one refresh trigger — Stats.jsx no longer keeps its own
  // copy, it reads these as props and calls refreshStats (passed down as
  // onRefreshStats) at the same close-the-Dashboard moment it always did.
  // tradeLinkedSignal is untouched and still exists — Post.jsx's
  // "Registrar (N)" counter still depends on it, that's a separate concern
  // from Winrate.
  const [allTimeStats, setAllTimeStats] = useState(null);
  const [statsLoaded,  setStatsLoaded]  = useState(false);

  // Last known Winrate, used ONLY as a placeholder while a fresh fetch is
  // in flight (or hasn't started yet) — the live allTimeStats.winrate above
  // always wins the moment it's available; this is never the value that's
  // considered authoritative, purely what's shown instead of "—" so the
  // header isn't blank on every load. Seeded from localStorage so it
  // survives a reload/reopen — "durante la sesión" isn't enough per this
  // round's spec, it has to survive closing the app entirely.
  const [lastKnownWinrate, setLastKnownWinrate] = useState(() => readCachedWinrate());

  const refreshStats = useCallback(() => {
    fetchAllTimeStats().then(stats => {
      setAllTimeStats(stats);
      setStatsLoaded(true);
      if (stats && typeof stats.winrate === "number" && Number.isFinite(stats.winrate)) {
        setLastKnownWinrate(stats.winrate);
        writeCachedWinrate(stats.winrate); // only ever a valid finite number — never null/undefined/"—"
      }
    });
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  // Close the purple speed-dial and reset thread flag whenever the section changes
  useEffect(() => { setFabOpen(false); setInsideFullscreenOverlay(false); }, [activeSectionId]);

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

  // profileConfig.stats stays exactly what it is (the user-editable config,
  // untouched) — this only overlays the Winrate value onto the "winrate"
  // entry at render time. Lives here, right after profileConfig itself is
  // declared (reads profileConfig — see the TDZ note this comment used to
  // carry, now resolved by this placement).
  //
  // allTimeStats (the live, shared value — same one Stats.jsx's own cards
  // read via summaryFromStats) always wins when present. The ONLY case
  // where allTimeStats is null AND we don't show "—" is before the very
  // first fetch of this page load has resolved (!statsLoaded) — that's the
  // narrow window lastKnownWinrate (seeded from localStorage) exists for.
  //
  // Critically: once statsLoaded is true, a null allTimeStats is trusted
  // exactly like Stats.jsx trusts it (→ "—"), never masked by
  // lastKnownWinrate. Gating on statsLoaded was the actual missing piece —
  // without it, a refetch that legitimately (or transiently) resolves to
  // null after the first load would keep showing the stale cached number
  // in Profile while Stats correctly went to "—", which is exactly the
  // "Profile lags behind Stats" symptom: not a timing difference, a
  // permanent fallback that never let go once the first value arrived.
  const profileStats = useMemo(
    () => profileConfig.stats.map(s =>
      s.key === "winrate"
        ? { ...s, value: allTimeStats ? `${allTimeStats.winrate.toFixed(1)}%` : (!statsLoaded && lastKnownWinrate != null ? `${lastKnownWinrate.toFixed(1)}%` : "—") }
        : s
    ),
    [profileConfig.stats, allTimeStats, statsLoaded, lastKnownWinrate]
  );

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
    setDirection(1);
    navigateRoute(sectionIdToRouteId(sectionId));
  }, [activeSectionId, navLocked, navigateRoute]);

  // Second argument opens a specific Thread directly (used by the Post
  // composer's post-publish flow, and by Post.jsx itself for a normal
  // feed-card tap) — goes straight to the "thread" route with a real
  // threadId param instead of a bare section switch.
  const navigateTo = useCallback((sectionId, threadId) => {
    if (navLocked) return;
    setDirection(1);
    if (threadId) navigateRoute("thread", { threadId });
    else navigateRoute(sectionIdToRouteId(sectionId));
  }, [navLocked, navigateRoute]);

  const goHome = useCallback(() => {
    if (navLocked) return;
    // If we're in a section, first go to Perfil tab — same 2-step collapse
    // as before, now a real navigation (pushes/pops an actual history
    // entry) instead of local state, so the physical back button retraces
    // exactly these same steps too.
    if (activeSectionId) {
      setDirection(-1);
      navigateRoute("profile");
      return;
    }
    // Already on Perfil tab — hand off to RootShell to leave App entirely.
    if (onGoHome) onGoHome();
  }, [activeSectionId, onGoHome, navLocked, navigateRoute]);

  // Deep-linking is implemented above via lib/navigation.jsx — `route` is
  // the single source of truth for activeSectionId/openThreadId/
  // openSubtemaId/openToolId, all derived, never independently settable.
  // A deep link or a page refresh both "just work" because App's render
  // tree reads the same derived values a normal tap would produce — there's
  // no separate "consume the URL once on mount" step to keep in sync.

  const activeSection = allSections.find(s => s.id === activeSectionId) || null;
  const accentColor   = activeSection?.accentColor || C.accent;

  // ── UNIFIED SHELL ────────────────────────────────────────────────────────
  // One layout for both desktop and mobile now (per the nav redesign: "quiero
  // que la web tenga prácticamente la misma experiencia que la app móvil, no
  // dos aplicaciones diferentes"). The old desktop-only branch (Sidebar +
  // separate top bar + slide-per-section transitions) is gone; `isDesktop`
  // now only adjusts widths/paddings below, it no longer picks between two
  // different render trees. This also removes a latent hooks-order risk the
  // old code had: every hook from here down used to only run when
  // `isDesktop` was false, which is unsound if isDesktop can change after
  // mount (it can, on window resize).
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
  const contentWrapperRef = useRef(null); // the section-content div, right after profile+chips
  const workStore = useWorkContextStore();
  const sectionScrollKey = `scroll:${activeSectionId ?? "perfil"}`;

  // ── Profile ↔ TopBar name handoff ────────────────────────────────────────
  // The single derived value this region of the app produces: whether the
  // Profile Header is currently visible. The detection mechanism itself
  // (IntersectionObserver) now lives inside ProfileRegion — App.jsx just
  // holds the resulting boolean and hands it to TopBar. One piece of state,
  // one source of truth, consumed by two places (TopBar's name, implicitly
  // the tab strip's sticky CSS which needs no state of its own at all).
  const [profileVisible, setProfileVisible] = useState(true);

  // Thread/Subtema are real fullscreen overlays now — position:fixed, siblings
  // of the document below, which never unmounts and never has its scrollTop
  // touched. The ONLY thing that needs to happen here is blocking the
  // underlying document from being scrolled while an overlay covers it (so a
  // stray touch can't move the feed hidden behind it) — a plain CSS
  // overflow toggle, nothing measured, nothing saved, nothing restored.

  // Continuously record this section's own scroll position (a plain write to
  // the shared store, not React state — no re-renders from scrolling).
  useEffect(() => {
    const el = unifiedScrollRef.current;
    if (!el) return;
    const onScroll = () => { workStore.set(sectionScrollKey, el.scrollTop); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [sectionScrollKey]); // eslint-disable-line

  // On every section switch: exact restore if there's valid memory for it;
  // otherwise cap the inherited scroll at this section's own real starting
  // point (measured from the DOM, not estimated) — never past it, and never
  // forced further than wherever the user currently is.
  useLayoutEffect(() => {
    const el = unifiedScrollRef.current;
    if (!el) return;
    const apply = () => {
      const saved = workStore.get(sectionScrollKey);
      if (saved !== undefined) {
        el.scrollTop = saved; // within the memory window — exact restore, no correction
        return;
      }
      const cap = contentWrapperRef.current?.offsetTop;
      if (typeof cap === "number") el.scrollTop = Math.min(el.scrollTop, cap);
    };
    apply();
    // Safety net: the feed swap animates (mode="wait", ~180ms) before the new
    // section's content actually mounts — reapply once more right after so a
    // late mount can't leave it in the wrong spot.
    const t = setTimeout(apply, 220);
    return () => clearTimeout(t);
  }, [activeSectionId]); // eslint-disable-line

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
  // Sections are rendered ALL AT ONCE and stay permanently mounted — switching
  // sections only toggles which one is visible (display:none on the rest).
  // This is what makes Thread/composer-draft/filter state survive navigation
  // for free: React never tears the component down, so its own useState never
  // resets. Only the shared scroll document (handled above) still needs an
  // explicit memory system, because that's the one thing that isn't "a
  // component's own state" — it's a single number every section shares.
  const customSections = allSections.filter(s => !["recaps", "announcements", "stats", "rooms", "tools"].includes(s.id));

  function renderMobileSections() {
    const visible = (id) => ({ display: activeSectionId === id ? "block" : "none", minHeight: "100%" });
    return (
      <>
        <div style={visible(null)}>
          <PerfilContent onNavigate={(id) => { setDirection(1); setActiveSectionId(id); }} visibleWidgets={visibleWidgets} sections={allSections} isHost={isHost} onCreatePost={() => { navigateTo("recaps"); }} isDesktop={isDesktop} />
        </div>
        <div style={visible("recaps")}>
          <Post section={{ ...activeSection, label: "Post" }} onBack={goHome} isHost={isHost} onNavigate={navigateTo} openThreadId={openThreadId} openSubtemaId={openSubtemaId} openUpdateId={openUpdateId} onUpdateResolved={() => setOpenUpdateId(null)} onThreadChange={setInsideFullscreenOverlay} onRegisterPostCallback={cb => { onPostCreatedRef.current = cb; }} onRegisterTrade={handleRegisterTrade} tradeLinkedSignal={tradeLinkedSignal} />
        </div>
        <div style={visible("announcements")}>
          <Announcements section={allSections.find(s => s.id === "announcements") ?? activeSection} onBack={goHome} isHost={isHost} onNavigate={navigateTo} mobileTab openComposerSignal={annComposerSignal} openStorySignal={annStorySignal} onShowComposer={() => setShowAnnComposer(true)} onRegisterAnnPublish={cb => { annPublishRef.current = cb; }} onShowStory={() => setShowAnnStory(true)} onRegisterAnnStory={cb => { annStoryRef.current = cb; }} onShowStoryViewer={i => setViewingAnnStory(i)} onRegisterAnnStories={arr => setAnnStories(arr)} openAnnouncementId={openAnnouncementId} onOpenAnnouncementHandled={() => setOpenAnnouncementId(null)} />
        </div>
        <div style={visible("stats")}>
          <Stats onDashboardChange={setInsideFullscreenOverlay} pendingTradeContext={pendingTradeContext} onClearPendingTrade={() => setPendingTradeContext(null)} onTradeLinked={handleTradeLinked} allTimeStats={allTimeStats} statsLoaded={statsLoaded} onRefreshStats={refreshStats} onStatsUpdate={setAllTimeStats} />
        </div>
        <div style={visible("rooms")}>
          <RoomsContent />
        </div>
        <div style={visible("tools")}>
          <Tools onToolsPortalChange={setInsideFullscreenOverlay} openToolId={openToolId} />
        </div>
        {customSections.map(cs => (
          <div key={cs.id} style={visible(cs.id)}>
            <CustomSectionContent section={cs} checklists={checklists} onChecklistsChange={setChecklists} />
          </div>
        ))}
      </>
    );
  }

  return (
    <ThemeProvider themeConfig={profileConfig.theme}>
    {/* Root — this is the ONLY element that owns "100% of the viewport".
        Background fills edge to edge always; it never depends on where the
        content column happens to end. On desktop, the sides of the screen
        are still this same background + the TopBar above, so they read as
        part of PlanSpace, not empty margin. */}
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Ambient glow — purely decorative, unrelated to content width */}
      <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 120, borderRadius: "50%", background: `radial-gradient(ellipse, ${C.accentDim}55 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* ── TOPBAR — full viewport width, own 3-zone layout (see component) ── */}
      <TopBar
        onHome={goHome}
        profileName={profileConfig.identity.name}
        onOpenSettings={onOpenSettings}
        isDesktop={isDesktop}
        showProfileName={!profileVisible}
      />

      {/*
        ── SINGLE SCROLL CONTAINER — never remounts ─────────────────────────
        Full viewport width too (background keeps filling edge to edge while
        scrolling). PageContainer below is what actually centers/caps the
        content living inside it — Profile, TabBar and the section content
        all share that one column, which is the whole point: no section
        decides its own width anymore.
      */}
      <div
        ref={unifiedScrollRef}
        style={{
          flex: 1, overflowX: "hidden", position: "relative", zIndex: 1, background: C.bg,
          overflowY: insideFullscreenOverlay ? "hidden" : "auto", // block the background from scrolling while a Thread/Dashboard overlay covers it
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── ProfileRegion — the one persistent identity region ──────────────
            Avatar, name, bio, stats, action buttons and the tab strip, all
            mounted here once. Rendered directly inside unifiedScrollRef with
            no wrapper of its own — see ProfileRegion.jsx's own file header
            for why: it renders its header and its sticky tab strip as two
            direct siblings of this scroll container on purpose, and wrapping
            them together (even just for a visibility toggle) breaks the tab
            strip's position:sticky by giving it a short shared parent to
            stick within instead of this tall one. `hidden` is passed straight
            through instead; ProfileRegion applies visibility:hidden to each
            of its two pieces individually. isOwner is hardcoded false for
            now: there's no auth yet, so every visitor sees the same "viewer"
            actions (Follow/Subscribe/Message) — see ProfileRegion.jsx's file
            header for how this becomes real once auth exists.

            `hidden` (not a conditional unmount) is what keeps
            unifiedScrollRef's scrollHeight constant while a fullscreen
            portal overlay is open — a conditional `{!x && <ProfileRegion/>}`
            here shrinks scrollHeight by ProfileRegion's full height on open
            and grows it back on close, and on a short section (Tools/Stats,
            whose own content alone often doesn't fill the viewport) that
            shrink forces the browser to clamp scrollTop down to fit —
            usually to 0 — a clamp that doesn't reverse itself when the
            content grows back, since nothing asks scrollTop to return to
            where it was. Post's feed never showed this because it's long
            enough that a portal open/close was never actually forcing a
            clamp in the first place — same underlying defect, just not
            triggered there. */}
        <ProfileRegion
          hidden={insideFullscreenOverlay}
          profile={{ ...profileConfig.identity, ...profileConfig.layout, stats: profileStats, socials: profileConfig.socials }}
          isOwner={false}
          onEditAvatar={onOpenSettings}
          followed={followed}
          onToggleFollow={() => setFollowed(f => !f)}
          subscribed={subscribed}
          onToggleSubscribe={() => setSubscribed(s => !s)}
          activeSectionId={activeSectionId}
          onNavigate={(id) => { setDirection(MOBILE_TABS.indexOf(id) > mobileTabIdx ? 1 : -1); setActiveSectionId(id); }}
          onHome={() => { setDirection(-1); setActiveSectionId(null); }}
          onSections={allSections}
          onAddSection={() => setShowAddSection(true)}
          isDesktop={isDesktop}
          onVisibilityChange={setProfileVisible}
        />

        {/* Section content — all sections stay permanently mounted (visibility
            toggled via CSS in renderMobileSections), so this div's own size
            is just whichever section is currently visible. minHeight:100%
            (of the scroll container, not the viewport) guarantees the
            document is always at least as tall as what's visible, so the
            browser never clamps scrollTop back down for a short/loading
            section. Thread/Subtema no longer live here at all — they're
            position:fixed overlays rendered by Post.jsx itself, completely
            independent of this container.
            Deliberately full-width here, NOT wrapped in PageContainer — each
            section picks its own container variant (reading/feed/dashboard)
            at its own definition site (see lib/layout.jsx). This is the one
            other place besides the portals that isn't feed-width by default:
            Announcements below wraps itself in "reading", everything else in
            "feed". */}
        <div
          ref={contentWrapperRef}
          style={{ position: "relative", minHeight: "100%" }}>
          {renderMobileSections()}
          <div style={{ height: 40 }} />
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

        {/* ══ UNIVERSAL FAB ══════════════════════════════════════════════════════
          Rendered as a direct child of the root div — OUTSIDE all overflow:hidden
          and transform containers. position:fixed works reliably here.
          Shows on: Home, Profile, Post main feed.
          Hidden on: inside a thread, settings, modals.
      ══════════════════════════════════════════════════════════════════════════ */}
      {isHost && (!activeSectionId || activeSectionId === "recaps") && !insideFullscreenOverlay ? (
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
