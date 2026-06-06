/**
 * Post.jsx — Clean rewrite of the Updates/Recaps section.
 *
 * STATE ARCHITECTURE (no re-render bugs):
 *  - threads      → stable, only mutated via setThreads()
 *  - searchInput  → LOCAL to SearchBar (uncontrolled from parent)
 *  - debouncedQ   → derived via useDebounce hook, 350ms
 *  - filtered     → useMemo(threads, debouncedQ)  ← feed never rerenders on keypress
 *  - openThread   → separate state, never collapses feed
 *  - fabOpen      → separate UI-only state
 *
 * Three cleanly separated layers:
 *  1. SearchBar      — fully self-contained, calls onSearch(q) after debounce
 *  2. PostFeed       — stable list, keyed by thread.id only
 *  3. ThreadView     — reused from Recaps, minus the sticky bottom composer
 */

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  ChevronLeft, Search, X, Heart, MessageCircle, Plus,
  Send, Mic, Square, Image, Video,
  Loader, FileText, Check, ChevronRight,
  Bookmark, Share2, Layers, FolderPlus,
} from "lucide-react";
import {
  fetchRecapThreads,
  createRecapThread,
  addThreadUpdate,
  toggleThreadLike,
  toggleUpdateLike,
  addThreadComment,
  updateThreadStatus,
  deleteRecapThread,
  updateRecapThread,
  fetchThreadComments,
} from "../lib/recapsApi.js";
import { uploadFile, storagePath } from "../lib/supabase.js";

// ─── Keyframes ─────────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("post-kf")) {
  const s = document.createElement("style");
  s.id = "post-kf";
  s.textContent = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(s);
}

// ─── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", cardHover: "#19192a",
  border: "#1c1c2e", accent: "#7c4dff", accentLight: "#9d71ff",
  accentDim: "#3d2480", text: "#eaeaf5", textMuted: "#6a6a82", textDim: "#32324a",
  green: "#1ed99a", greenDim: "rgba(30,217,154,0.12)",
  amber: "#f5a623", blue: "#4fa3ff", red: "#ff4f6a",
  teal: "#22d3a0", tealDim: "rgba(34,211,160,0.14)",
  textDim: "#32324a",
};
const font = "'DM Sans', sans-serif";

// ─── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_THREADS = [
  {
    id: "t1", planningPostId: "p1", title: "Weekly Market Outlook — Week 20",
    content: "Major confluence zones aligning across DXY and XAUUSD. Expecting a corrective move before continuation.",
    hashtags: ["#XAUUSD", "#DXY", "#WeeklyBias"],
    status: "active", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-05-12T09:00:00"),
    likes: 38, liked: false, commentCount: 12, newUpdates: 3,
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80", thumb: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=70" }],
    updates: [
      { id: "u1a", content: "DXY just swept the lows at 104.20.", timestamp: new Date("2026-05-12T14:30:00"), likes: 11, liked: false, media: [], audio: null },
      { id: "u1b", content: "XAUUSD confirmed rejection at 2340.", timestamp: new Date("2026-05-13T08:15:00"), likes: 19, liked: true, media: [], audio: null },
    ],
  },
  {
    id: "t2", planningPostId: "p2", title: "EURUSD Breakout Setup",
    content: "Price is compressing into a key daily resistance zone. A confirmed break above 1.0940 could lead to a 150–200 pip move.",
    hashtags: ["#EURUSD", "#Breakout", "#Forex"],
    status: "closed", visibility: "public",
    author: "Alex H.", timestamp: new Date("2026-05-10T16:00:00"),
    likes: 21, liked: true, commentCount: 5, newUpdates: 0,
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=800&q=80", thumb: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=400&q=70" }],
    updates: [
      { id: "u2a", content: "Breakout confirmed! 4H close above 1.0940.", timestamp: new Date("2026-05-11T10:00:00"), likes: 15, liked: false, media: [], audio: null },
    ],
  },
  {
    id: "t3", planningPostId: "p4", title: "NASDAQ Pre-Market Analysis",
    content: "Watching the 18,200 support level carefully. A bounce could take NQ back to ATH territory.",
    hashtags: ["#NASDAQ", "#NQ", "#Indices"],
    status: "active", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-05-08T08:30:00"),
    likes: 56, liked: false, commentCount: 19, newUpdates: 1,
    media: [],
    updates: [],
  },
  {
    id: "t4", title: "DXY Alert — Live Update",
    content: "Quick heads-up: DXY rejection happening in real-time off the 104.50 zone.",
    hashtags: ["#DXY", "#Live", "#Alert"],
    status: "in_progress", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-04-28T11:20:00"),
    likes: 14, liked: false, commentCount: 7, newUpdates: 0,
    media: [],
    updates: [],
  },
  {
    id: "t5", title: "Gold Weekly Bias — Week 18",
    content: "Higher timeframe structure is bullish. Looking for pullbacks into the 2280–2300 zone.",
    hashtags: ["#XAUUSD", "#Gold", "#WeeklyBias"],
    status: "closed", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-04-20T09:00:00"),
    likes: 44, liked: false, commentCount: 11, newUpdates: 0,
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80", thumb: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=70" }],
    updates: [],
  },
  {
    id: "t6", title: "GBPUSD — Structural Break",
    content: "GBPUSD breaking below key weekly support at 1.2600. Potential move toward 1.2450.",
    hashtags: ["#GBPUSD", "#Structure", "#Forex"],
    status: "closed", visibility: "public",
    author: "Alex H.", timestamp: new Date("2026-03-15T08:00:00"),
    likes: 29, liked: false, commentCount: 8, newUpdates: 0,
    media: [],
    updates: [],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d) {
  if (!d) return "";
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

function fmtTime(d) {
  if (!d) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtAudio(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function monthLabel(d) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByMonth(list) {
  const groups = {};
  list.forEach(t => {
    const k = monthLabel(t.timestamp);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  });
  return groups;
}

// ─── useDebounce — prevents feed re-render on each keystroke ──────────────────
function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function useIsDesktop() {
  const [is, setIs] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setIs(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return is;
}

// ─── StatusChip ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { id: "active",      label: "Active",      color: "#1ed99a", bg: "rgba(30,217,154,0.12)" },
  { id: "in_progress", label: "In Progress", color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  { id: "closed",      label: "Closed",      color: "#6a6a82", bg: "rgba(106,106,130,0.10)" },
];

function StatusChip({ status, isHost, onSetStatus, small }) {
  const [open, setOpen] = useState(false);
  const opt = STATUS_OPTIONS.find(o => o.id === status) || STATUS_OPTIONS[0];
  const chip = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: small ? 4 : 5, padding: small ? "3px 8px" : "4px 10px", borderRadius: 99, border: `1px solid ${opt.color}40`, background: opt.bg }}>
      <span style={{ width: small ? 4 : 5, height: small ? 4 : 5, borderRadius: "50%", background: opt.color, boxShadow: `0 0 6px ${opt.color}` }} />
      <span style={{ fontFamily: font, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: opt.color }}>{opt.label}</span>
      {isHost && <ChevronRight size={9} color={opt.color} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />}
    </div>
  );
  if (!isHost) return chip;
  return (
    <div style={{ position: "relative" }}>
      <motion.button whileTap={{ scale: 0.94 }} onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>{chip}</motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 201, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 150, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.id} onClick={() => { onSetStatus?.(s.id); setOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", background: s.id === status ? `${s.color}14` : "transparent", cursor: "pointer" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: font, fontSize: 13, fontWeight: s.id === status ? 700 : 500, color: s.id === status ? s.color : C.textMuted }}>{s.label}</span>
                  {s.id === status && <Check size={12} color={s.color} style={{ marginLeft: "auto" }} />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accentDim}, ${C.accentDim}88)`, border: `1px solid ${C.accentDim}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: font, fontSize: size * 0.38, fontWeight: 700, color: C.text }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ─── MonthDivider ──────────────────────────────────────────────────────────────
function MonthDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0 10px" }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.border}, transparent)` }} />
      <div style={{ padding: "5px 14px", borderRadius: 99, background: "rgba(14,14,24,0.85)", backdropFilter: "blur(16px)", border: `1px solid rgba(92,47,255,0.22)`, boxShadow: "0 0 20px rgba(124,77,255,0.1)" }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.accentLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, ${C.border}, transparent)` }} />
    </div>
  );
}

// ─── SearchBar — SELF-CONTAINED, parent never re-renders on keypress ──────────
// Uses local state + debounce, notifies parent only after debounce fires.
const SearchBar = memo(function SearchBar({ onSearch }) {
  const [val, setVal] = useState("");
  const debouncedVal = useDebounce(val, 350);

  // Notify parent only when debounced value changes
  useEffect(() => {
    onSearch(debouncedVal.trim());
  }, [debouncedVal, onSearch]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${val ? C.teal + "55" : C.border}`, borderRadius: 14, padding: "0 14px", transition: "border-color 0.2s", height: 44 }}>
      <Search size={15} color={C.textMuted} strokeWidth={2} />
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Search posts…"
        style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 14, padding: "11px 0" }}
      />
      {val && (
        <button onClick={() => setVal("")} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0, display: "flex" }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
});

// ─── PostCard — 2-column grid card with image thumbnail ───────────────────────
const PostCard = memo(function PostCard({ thread, onClick }) {
  const [hov, setHov] = useState(false);
  const thumb = thread.media?.[0]?.thumb || thread.media?.[0]?.url || null;
  const opt = STATUS_OPTIONS.find(o => o.id === thread.status) || STATUS_OPTIONS[0];

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        background: C.card,
        border: `1px solid ${hov ? C.teal + "40" : C.border}`,
        boxShadow: hov ? `0 8px 32px rgba(34,211,160,0.12)` : "0 2px 8px rgba(0,0,0,0.3)",
        transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
        transform: hov ? "translateY(-2px)" : "none",
        position: "relative",
      }}
    >
      {/* Thumbnail area */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: thumb ? "transparent" : `linear-gradient(135deg, ${C.accentDim}44, ${C.tealDim})`, overflow: "hidden" }}>
        {thumb ? (
          <img
            src={thumb}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
              filter: hov ? "brightness(0.75)" : "brightness(0.65)",
              transition: "filter 0.25s" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={28} color={C.textDim} strokeWidth={1.5} />
          </div>
        )}

        {/* Blur overlay at bottom */}
        {thumb && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(8,8,14,0.92) 0%, rgba(8,8,14,0.4) 50%, transparent 100%)",
          }} />
        )}

        {/* New updates badge */}
        {thread.newUpdates > 0 && (
          <div style={{ position: "absolute", top: 8, right: 8, background: C.teal, borderRadius: 99, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, boxShadow: `0 0 10px ${C.teal}80` }}>
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 800, color: "#000" }}>+{thread.newUpdates}</span>
          </div>
        )}

        {/* Title overlay on image */}
        {thumb && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 12px 8px" }}>
            <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {thread.title || "Untitled"}
            </p>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "10px 12px 12px" }}>
        {/* Title (when no image) */}
        {!thumb && (
          <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {thread.title || "Untitled"}
          </p>
        )}

        {/* Status chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: opt.color, boxShadow: `0 0 5px ${opt.color}`, flexShrink: 0 }} />
          <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: opt.color }}>{opt.label}</span>
        </div>

        {/* Footer: date */}
        <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textDim, fontWeight: 500 }}>
          {fmtDate(thread.timestamp)}
        </p>
      </div>
    </motion.div>
  );
});

// ─── PostFeed — stable grid, never recreated on search keypress ───────────────
// Receives debouncedQuery (changes max 1x per 350ms), not raw input.
const PostFeed = memo(function PostFeed({ threads, debouncedQuery, onOpenThread }) {
  const filtered = useMemo(() => {
    let list = [...threads].sort((a, b) => b.timestamp - a.timestamp);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.content?.toLowerCase().includes(q) ||
        t.hashtags?.some(h => h.toLowerCase().includes(q))
      );
    }
    return list;
  }, [threads, debouncedQuery]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  if (filtered.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ textAlign: "center", padding: "56px 20px", color: C.textMuted, fontFamily: font, fontSize: 14 }}>
        No posts found
      </motion.div>
    );
  }

  return (
    <>
      {Object.entries(grouped).map(([month, items]) => (
        <div key={month}>
          <MonthDivider label={month} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            {items.map(t => (
              <PostCard key={t.id} thread={t} onClick={() => onOpenThread(t)} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ height: 80 }} />
    </>
  );
});

// ─── AudioPlayer ───────────────────────────────────────────────────────────────
function AudioPlayer({ audio, accentColor }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const acc = accentColor || C.teal;
  const wf = audio.waveform || Array.from({ length: 20 }, () => 0.5);

  const toggle = () => {
    if (playing) {
      clearInterval(timerRef.current);
      setPlaying(false);
    } else {
      setPlaying(true);
      timerRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 100) { clearInterval(timerRef.current); setPlaying(false); return 0; }
          return p + (100 / (audio.duration * 10));
        });
      }, 100);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  const elapsed = Math.floor((progress / 100) * audio.duration);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${acc}10`, border: `1px solid ${acc}25`, borderRadius: 12, padding: "10px 14px" }}>
      <motion.button whileTap={{ scale: 0.88 }} onClick={toggle}
        style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: acc, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: `0 0 12px ${acc}60` }}>
        {playing ? <Square size={12} fill="#000" /> : <svg width="10" height="13" viewBox="0 0 10 13" fill="#000"><path d="M0 0L10 6.5L0 13V0Z"/></svg>}
      </motion.button>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, height: 28, overflow: "hidden" }}>
        {wf.map((h, i) => {
          const filled = (i / wf.length) * 100 <= progress;
          return <div key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, borderRadius: 2, background: filled ? acc : `${acc}30`, transition: "background 0.1s" }} />;
        })}
      </div>
      <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: acc, minWidth: 30, textAlign: "right" }}>{fmtAudio(elapsed)}</span>
    </div>
  );
}

// ─── UpdateBubble ──────────────────────────────────────────────────────────────
function UpdateBubble({ update, index }) {
  const [liked, setLiked] = useState(update.liked);
  const [likeCount, setLikeCount] = useState(update.likes);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    await toggleUpdateLike(update.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
        <div style={{ width: 2, height: 16, background: `${C.teal}40` }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 8px ${C.teal}60`, flexShrink: 0 }} />
      </div>
      <div style={{ flex: 1, background: C.card, border: `1px solid ${C.teal}22`, borderRadius: "4px 16px 16px 16px", padding: "12px 14px", marginBottom: 8 }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.6 }}>{update.content}</p>
        {update.media?.length > 0 && (
          <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", aspectRatio: "16/9" }}>
            <img src={update.media[0].thumb || update.media[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        {update.audio && <div style={{ marginTop: 10 }}><AudioPlayer audio={update.audio} accentColor={C.teal} /></div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{fmtDate(update.timestamp)} · {fmtTime(update.timestamp)}</span>
          <div style={{ flex: 1 }} />
          <motion.button whileTap={{ scale: 0.88 }} onClick={toggleLike}
            style={{ display: "flex", alignItems: "center", gap: 4, background: liked ? `${C.red}14` : "transparent", border: `1px solid ${liked ? C.red + "40" : C.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: liked ? C.red : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 500, transition: "all 0.15s" }}>
            <Heart size={12} fill={liked ? C.red : "none"} /> {likeCount}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CommentsSheet ─────────────────────────────────────────────────────────────
function CommentsSheet({ threadId, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 260], [1, 0]);

  useEffect(() => {
    let cancelled = false;
    fetchThreadComments(threadId)
      .then(data => { if (!cancelled) { if (data.length > 0) setComments(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threadId]);

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
    else y.set(0);
  };

  const submit = async () => {
    if (!newComment.trim() || submitting) return;
    const text = newComment.trim();
    setNewComment("");
    setSubmitting(true);
    const temp = { id: `c_temp_${Date.now()}`, author: "You", avatar: "Y", text, likes: 0, liked: false, time: "just now" };
    setComments(prev => [...prev, temp]);
    const saved = await addThreadComment(threadId, { author: "You", text });
    if (saved) setComments(prev => prev.map(c => c.id === temp.id ? saved : c));
    setSubmitting(false);
  };

  return (
    <AnimatePresence>
      <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }} />
      <motion.div key="sh" style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 430, margin: "0 auto", y, opacity, zIndex: 501, background: "rgba(14,14,24,0.92)", backdropFilter: "blur(32px)", borderRadius: "28px 28px 0 0", border: `1px solid rgba(92,47,255,0.2)`, borderBottom: "none", boxShadow: "0 -4px 60px rgba(124,77,255,0.18)", maxHeight: "78vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        drag="y" dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={handleDragEnd} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px", cursor: "grab", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: `rgba(124,77,255,0.5)` }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 14px", flexShrink: 0, borderBottom: `1px solid rgba(124,77,255,0.12)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Comments</span>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: C.accentLight, background: `${C.accent}20`, border: `1px solid ${C.accent}35`, borderRadius: 20, padding: "2px 9px" }}>{comments.length}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 18 }}>
          {loading && <div style={{ textAlign: "center", padding: "32px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Loader size={14} color={C.teal} style={{ animation: "spin 1s linear infinite" }} /><span style={{ color: C.textMuted, fontFamily: font, fontSize: 14 }}>Loading…</span></div>}
          {!loading && comments.length === 0 && <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 14, padding: "32px 0" }}>No comments yet — be first 👇</p>}
          {comments.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} style={{ display: "flex", gap: 12 }}>
              <Avatar name={c.avatar} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{c.author}</span>
                  <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{c.time}</span>
                </div>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{c.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{ padding: "12px 16px 20px", borderTop: `1px solid rgba(124,77,255,0.12)`, background: "rgba(8,8,14,0.6)", backdropFilter: "blur(16px)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <Avatar name="Y" size={32} />
          <div style={{ flex: 1, position: "relative" }}>
            <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Write a comment…"
              style={{ width: "100%", background: "rgba(19,19,31,0.9)", border: `1px solid ${newComment.trim() ? C.accent + "55" : C.border}`, borderRadius: 22, padding: "10px 48px 10px 16px", color: C.text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} />
            <motion.button whileTap={{ scale: 0.88 }} onClick={submit} disabled={submitting}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: newComment.trim() && !submitting ? `linear-gradient(135deg, ${C.accent}, #5c2fff)` : C.border, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: newComment.trim() && !submitting ? "pointer" : "default", transition: "background 0.2s" }}>
              {submitting ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── UpdateComposer (host only, floating inside ThreadView) ───────────────────
function UpdateComposer({ onSubmit }) {
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const timerRef = useRef(null);
  const secsRef = useRef(0);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => { secsRef.current = recordSecs; }, [recordSecs]);

  const startRecord = () => {
    navigator.mediaDevices?.getUserMedia({ audio: true }).then(stream => {
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const dur = secsRef.current;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const wf = Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2);
        setRecording(false); setUploadingAudio(true);
        try {
          const path = storagePath("updates/audio", "recording.webm");
          const url = await uploadFile("audio", blob, path);
          onSubmit({ content: content.trim(), audio: { url: url || URL.createObjectURL(blob), duration: dur, waveform: wf } });
        } finally { setUploadingAudio(false); }
        setContent(""); setRecordSecs(0);
      };
      mr.start();
      setRecording(true); setRecordSecs(0);
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    }).catch(() => alert("Microphone access denied"));
  };

  const stopRecord = () => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current.stop();
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit({ content: content.trim(), audio: null });
    setContent("");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 430, margin: "0 auto", zIndex: 40, background: "rgba(14,14,24,0.92)", backdropFilter: "blur(28px)", borderTop: `1px solid rgba(92,47,255,0.2)`, boxShadow: "0 -4px 40px rgba(34,211,160,0.1)", padding: "10px 14px 20px" }}>
      {recording ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: `${C.red}14`, border: `1px solid ${C.red}30`, borderRadius: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}`, animation: "pulse-dot 1s infinite" }} />
          <span style={{ fontFamily: font, fontSize: 14, color: C.red, fontWeight: 600, flex: 1 }}>Recording… {fmtAudio(recordSecs)}</span>
          <button onClick={stopRecord} style={{ display: "flex", alignItems: "center", gap: 6, background: C.red, border: "none", borderRadius: 10, padding: "7px 14px", cursor: "pointer", color: "#fff", fontFamily: font, fontSize: 13, fontWeight: 600 }}>
            <Square size={13} fill="#fff" /> Done
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: C.card, border: `1px solid ${focused ? C.teal + "55" : C.border}`, borderRadius: 18, overflow: "hidden", transition: "all 0.2s" }}>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <textarea value={content} onChange={e => setContent(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Share an update…" rows={2}
                style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.55, padding: "12px 14px" }} />
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleSubmit}
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, margin: "0 8px 8px 0", background: content.trim() ? `linear-gradient(135deg, ${C.teal}, #0ea876)` : C.border, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: content.trim() ? "pointer" : "default", transition: "all 0.2s" }}>
                <Send size={15} />
              </motion.button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {[{ icon: Image, label: "Photo" }, { icon: Video, label: "Video" }].map(a => (
              <motion.button key={a.label} whileTap={{ scale: 0.93 }} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 11, fontWeight: 600 }}>
                <a.icon size={13} /> {a.label}
              </motion.button>
            ))}
            <motion.button whileTap={{ scale: 0.93 }} onClick={startRecord} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 11, fontWeight: 600 }}>
              <Mic size={13} /> Audio
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── ThreadView — reutilizado de Recaps, SIN sticky bottom bar en el feed ─────
function ThreadView({ thread: initialThread, onBack, isHost, onStatusChange }) {
  const [thread, setThread] = useState(initialThread);
  const [liked, setLiked] = useState(initialThread.liked);
  const [likeCount, setLikeCount] = useState(initialThread.likes);
  const [showComments, setShowComments] = useState(false);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    await toggleThreadLike(thread.id);
  };

  const handleNewUpdate = async ({ content, audio }) => {
    const tempId = `u_temp_${Date.now()}`;
    const temp = { id: tempId, content, timestamp: new Date(), likes: 0, liked: false, media: [], audio: audio || null };
    setThread(t => ({ ...t, updates: [...t.updates, temp] }));
    const saved = await addThreadUpdate(thread.id, { content, audio });
    if (saved) setThread(t => ({ ...t, updates: t.updates.map(u => u.id === tempId ? saved : u) }));
  };

  const COMPOSER_H = isHost ? 130 : 0;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.surface }}>
      {showComments && <CommentsSheet threadId={thread.id} onClose={() => setShowComments(false)} />}

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {/* TopBar */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 56 }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: C.teal, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
            <ChevronLeft size={19} strokeWidth={2.2} /> Back
          </button>
          <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", textAlign: "center", marginRight: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {thread.title || "Post"}
          </span>
        </motion.div>

        {/* Root Post */}
        <div style={{ background: `${C.teal}08`, borderBottom: `1px solid ${C.teal}18`, padding: "20px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar name={thread.author} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>{thread.author}</span>
                <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accentLight, background: `${C.accent}18`, border: `1px solid ${C.accent}28`, borderRadius: 4, padding: "1px 5px" }}>Host</span>
              </div>
              <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{fmtDate(thread.timestamp)}</span>
            </div>
            <StatusChip status={thread.status} isHost={isHost} onSetStatus={s => { setThread(t => ({ ...t, status: s })); onStatusChange?.(thread.id, s); }} />
          </div>

          {thread.title && (
            <div style={{ display: "inline-flex", alignItems: "center", background: "linear-gradient(135deg, rgba(124,77,255,0.2), rgba(157,113,255,0.12))", border: "1px solid rgba(124,77,255,0.35)", borderRadius: 999, padding: "5px 14px", marginBottom: 10 }}>
              <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.accentLight }}>{thread.title}</span>
            </div>
          )}

          <p style={{ margin: 0, fontFamily: font, fontSize: 14, lineHeight: 1.65, color: C.textMuted }}>{thread.content}</p>

          {thread.hashtags?.length > 0 && (
            <p style={{ margin: "8px 0 0", fontFamily: font, fontSize: 12, color: C.accent }}>{thread.hashtags.join(" ")}</p>
          )}

          {thread.media?.length > 0 && (
            <div style={{ marginTop: 12, borderRadius: 12, overflow: "hidden", aspectRatio: "16/10" }}>
              <img src={thread.media[0].thumb || thread.media[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 14 }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={toggleLike}
              style={{ display: "flex", alignItems: "center", gap: 5, background: liked ? `${C.red}14` : "transparent", border: `1px solid ${liked ? C.red + "40" : C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: liked ? C.red : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 500, transition: "all 0.18s" }}>
              <Heart size={13} fill={liked ? C.red : "none"} /> {likeCount}
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowComments(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 500 }}>
              <MessageCircle size={13} /> {thread.commentCount}
            </motion.button>
            <div style={{ flex: 1 }} />
            <button style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 6 }}><Bookmark size={14} /></button>
            <button style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 6 }}><Share2 size={14} /></button>
          </div>
        </div>

        {/* Updates */}
        <div style={{ padding: "16px 16px 0" }}>
          {thread.updates.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${C.teal}40, transparent)` }} />
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {thread.updates.length} Update{thread.updates.length !== 1 ? "s" : ""}
              </span>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(270deg, ${C.teal}40, transparent)` }} />
            </div>
          )}
          <div style={{ paddingLeft: 4 }}>
            {thread.updates.map((u, i) => (
              <UpdateBubble key={u.id} update={u} index={i} />
            ))}
          </div>
          {thread.updates.length === 0 && !isHost && (
            <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 13, padding: "24px 0" }}>No updates yet.</p>
          )}
        </div>

        <div style={{ height: COMPOSER_H + 24 }} />
      </div>

      {/* FAB — fixed, always visible, only for hosts inside a thread */}
      {isHost && <FAB onAddUpdate={() => {}} onCreateSubtema={() => {}} />}

      {/* Host composer — sticky bottom bar ONLY inside ThreadView */}
      {isHost && <UpdateComposer onSubmit={handleNewUpdate} />}
    </div>
  );
}

// ─── FAB — Floating Action Button with menu ────────────────────────────────────
function FAB({ onAddUpdate, onCreateSubtema }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: 28, right: 20, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />

            {/* Añadir Update */}
            <motion.button
              initial={{ opacity: 0, y: 12, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.88 }}
              transition={{ delay: 0.05 }}
              onClick={() => { setOpen(false); onAddUpdate(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${C.green}, #0ea876)`, border: "none", borderRadius: 99, padding: "10px 18px", cursor: "pointer", color: "#000", fontFamily: font, fontSize: 13, fontWeight: 700, boxShadow: `0 6px 24px ${C.green}50`, whiteSpace: "nowrap" }}>
              <FolderPlus size={16} /> Añadir Update
            </motion.button>

            {/* Crear Subtema */}
            <motion.button
              initial={{ opacity: 0, y: 12, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.88 }}
              transition={{ delay: 0.0 }}
              onClick={() => { setOpen(false); onCreateSubtema(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${C.teal}, #0ea876)`, border: "none", borderRadius: 99, padding: "10px 18px", cursor: "pointer", color: "#000", fontFamily: font, fontSize: 13, fontWeight: 700, boxShadow: `0 6px 24px ${C.teal}50`, whiteSpace: "nowrap" }}>
              <Layers size={16} /> Crear Subtema
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        onClick={() => setOpen(o => !o)}
        style={{ width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.green}, #0ea876)`, boxShadow: open ? `0 8px 32px ${C.green}80` : `0 6px 24px ${C.green}60`, color: "#fff", transition: "box-shadow 0.2s", zIndex: 51 }}>
        <Plus size={24} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}

// ─── SubtemaComposer sheet ─────────────────────────────────────────────────────
function SubtemaSheet({ onSubmit, onClose }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: desc.trim() });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,8,14,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}
        style={{ width: "100%", maxWidth: 560, background: C.card, borderRadius: "22px 22px 0 0", border: `1px solid ${C.teal}30`, borderBottom: "none", padding: "20px 20px 32px" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${C.teal}20`, border: `1px solid ${C.teal}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={15} color={C.teal} />
            </div>
            <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Crear Subtema</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={18} /></button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del subtema…"
          style={{ width: "100%", boxSizing: "border-box", background: `${C.bg}cc`, border: `1.5px solid ${title ? C.teal + "55" : C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 14, fontWeight: 700, outline: "none", marginBottom: 10, transition: "border-color 0.2s" }} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)…" rows={3}
          style={{ width: "100%", boxSizing: "border-box", resize: "none", background: `${C.bg}cc`, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 13, outline: "none", marginBottom: 12, lineHeight: 1.55 }} />
        <motion.button whileTap={{ scale: 0.95 }} onClick={submit} disabled={!title.trim()}
          style={{ width: "100%", height: 44, borderRadius: 14, border: "none", cursor: title.trim() ? "pointer" : "default", fontFamily: font, fontSize: 14, fontWeight: 800, background: title.trim() ? `linear-gradient(135deg, ${C.teal}, #0ea876)` : C.border, color: title.trim() ? "#000" : C.textMuted, transition: "all 0.2s" }}>
          Crear Subtema
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── NewPostSheet ──────────────────────────────────────────────────────────────
function NewPostSheet({ onSubmit, onClose }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), content: content.trim() });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,8,14,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}
        style={{ width: "100%", maxWidth: 560, background: C.card, borderRadius: "22px 22px 0 0", border: `1px solid ${C.green}30`, borderBottom: "none", padding: "20px 20px 32px" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${C.green}20`, border: `1px solid ${C.green}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderPlus size={15} color={C.green} />
            </div>
            <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Nuevo Post</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={18} /></button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del post…"
          style={{ width: "100%", boxSizing: "border-box", background: `${C.bg}cc`, border: `1.5px solid ${title ? C.green + "55" : C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 14, fontWeight: 700, outline: "none", marginBottom: 10, transition: "border-color 0.2s" }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Contenido del post…" rows={4}
          style={{ width: "100%", boxSizing: "border-box", resize: "none", background: `${C.bg}cc`, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 13, outline: "none", marginBottom: 12, lineHeight: 1.55 }} />
        <motion.button whileTap={{ scale: 0.95 }} onClick={submit} disabled={!title.trim()}
          style={{ width: "100%", height: 44, borderRadius: 14, border: "none", cursor: title.trim() ? "pointer" : "default", fontFamily: font, fontSize: 14, fontWeight: 800, background: title.trim() ? `linear-gradient(135deg, ${C.green}, #0ea876)` : C.border, color: title.trim() ? "#000" : C.textMuted, transition: "all 0.2s" }}>
          Publicar
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── PostSection (default export) — Root component ────────────────────────────
// STATE SEPARATION:
//   threads        → feed data (stable)
//   openThread     → navigation (separate)
//   debouncedQuery → search (read-only in PostFeed)
//   fabOpen / sheets → UI only
export default function Post({ section, onBack, isHost, onNavigate, openThreadId, mobileTab }) {
  // ── Feed state — never mutated by search or UI events ─────────────────────
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [loadingThreads, setLoadingThreads] = useState(true);

  // ── Navigation state ───────────────────────────────────────────────────────
  const [openThread, setOpenThread] = useState(null);
  const [direction, setDirection] = useState(1);
  const feedScrollRef = useRef(0);
  const feedContainerRef = useRef(null);

  // ── Search state — SearchBar manages its own input, only debounced val here ─
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // onSearch is called by SearchBar after its own debounce — stable ref
  const handleSearch = useCallback((q) => setDebouncedQuery(q), []);

  // ── UI-only state ──────────────────────────────────────────────────────────
  const [showNewPost, setShowNewPost] = useState(false);
  const [showSubtema, setShowSubtema] = useState(false);

  const isDesktop = useIsDesktop();

  // ── Load from Supabase ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchRecapThreads().then(data => {
      if (cancelled) return;
      if (data.length > 0) setThreads(data);
      setLoadingThreads(false);
      if (openThreadId) {
        const t = openThreadId.startsWith("p")
          ? data.find(th => th.planningPostId === openThreadId)
          : data.find(th => th.id === openThreadId);
        const fallback = openThreadId.startsWith("p")
          ? MOCK_THREADS.find(th => th.planningPostId === openThreadId)
          : MOCK_THREADS.find(th => th.id === openThreadId);
        if (t || fallback) { setDirection(1); setOpenThread(t || fallback); }
      }
    }).catch(() => setLoadingThreads(false));
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!openThreadId) return;
    const t = openThreadId.startsWith("p")
      ? threads.find(th => th.planningPostId === openThreadId)
      : threads.find(th => th.id === openThreadId);
    if (t) { setDirection(1); setOpenThread(t); }
  }, [openThreadId]); // eslint-disable-line

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(async (threadId, newStatus) => {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, status: newStatus } : t));
    setOpenThread(t => t?.id === threadId ? { ...t, status: newStatus } : t);
    await updateThreadStatus(threadId, newStatus);
  }, []);

  const handleCreateThread = useCallback(async (data) => {
    const newThread = {
      id: `t${Date.now()}`, planningPostId: null,
      title: data.title || "New Post", content: data.content || "",
      hashtags: [], status: "active", visibility: "members",
      author: "Alex H.", timestamp: new Date(),
      likes: 0, liked: false, commentCount: 0, newUpdates: 0,
      media: [], updates: [],
    };
    setThreads(prev => [newThread, ...prev]);
    try { await createRecapThread(newThread); } catch {}
  }, []);

  const handleCreateSubtema = useCallback((data) => {
    const newThread = {
      id: `t${Date.now()}`, planningPostId: null,
      title: data.title, content: data.description || "",
      hashtags: [], status: "active", visibility: "members",
      isSubtema: true,
      author: "Alex H.", timestamp: new Date(),
      likes: 0, liked: false, commentCount: 0, newUpdates: 0,
      media: [], updates: [],
    };
    setThreads(prev => [newThread, ...prev]);
  }, []);

  const openThreadView = useCallback((thread) => {
    if (feedContainerRef.current) feedScrollRef.current = feedContainerRef.current.scrollTop;
    setDirection(1); setOpenThread(thread);
  }, []);

  const closeThread = useCallback(() => {
    setDirection(-1); setOpenThread(null);
  }, []);

  // Restore scroll on back
  useEffect(() => {
    if (!openThread && feedContainerRef.current) {
      feedContainerRef.current.scrollTop = feedScrollRef.current;
    }
  }, [openThread]);

  const slideVariants = {
    enter: d => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: d => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };
  const springTrans = { type: "spring", stiffness: 380, damping: 38, mass: 0.85 };

  // ── Feed panel ─────────────────────────────────────────────────────────────
  // Two modes:
  //   Desktop: absolute-positioned full-height flex column (own scroll)
  //   Mobile:  normal document flow — no height constraint, no inner overflow
  //            Parent (unified scroll in App.jsx) handles scroll

  const FeedPanelDesktop = () => (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <AnimatePresence mode="popLayout" custom={direction}>
        {!openThread ? (
          <motion.div key="post-feed" initial={false} animate={{}} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: C.surface }}>
            <div style={{ padding: "12px 28px 10px", flexShrink: 0 }}>
              <SearchBar onSearch={handleSearch} />
            </div>
            <div ref={feedContainerRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 28px 24px" }}>
              {loadingThreads ? (
                <div style={{ textAlign: "center", padding: "48px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <Loader size={16} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ color: C.textMuted, fontFamily: font, fontSize: 14 }}>Loading posts…</span>
                </div>
              ) : (
                <PostFeed threads={threads} debouncedQuery={debouncedQuery} onOpenThread={openThreadView} />
              )}
            </div>
            {/* FAB only in thread view */}
          </motion.div>
        ) : (
          <motion.div key={openThread.id} custom={direction} variants={slideVariants}
            initial="enter" animate="center" exit="exit" transition={springTrans}
            style={{ position: "absolute", inset: 0, background: C.surface }}>
            <ThreadView thread={openThread} onBack={closeThread} isHost={isHost} onStatusChange={handleStatusChange} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showNewPost && <NewPostSheet onSubmit={handleCreateThread} onClose={() => setShowNewPost(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSubtema && <SubtemaSheet onSubmit={handleCreateSubtema} onClose={() => setShowSubtema(false)} />}
      </AnimatePresence>
    </div>
  );

  // Mobile: pure flow, no position:absolute, no overflow — parent scroll handles it
  const FeedPanelMobile = () => (
    <div style={{ background: C.surface, minHeight: 400 }}>
      {!openThread ? (
        <>
          {/* Search bar */}
          <div style={{ padding: "12px 14px 10px" }}>
            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Posts list — flows naturally */}
          <div ref={feedContainerRef} style={{ padding: "0 14px 24px" }}>
            {loadingThreads ? (
              <div style={{ textAlign: "center", padding: "48px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Loader size={16} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ color: C.textMuted, fontFamily: font, fontSize: 14 }}>Loading posts…</span>
              </div>
            ) : (
              <PostFeed threads={threads} debouncedQuery={debouncedQuery} onOpenThread={openThreadView} />
            )}
          </div>

          {/* FAB only appears inside ThreadView, not in the main feed list */}
        </>
      ) : (
        /* Thread view in mobile: fills the unified scroll naturally */
        <div style={{ background: C.surface }}>
          <ThreadView thread={openThread} onBack={closeThread} isHost={isHost} onStatusChange={handleStatusChange} />
        </div>
      )}

      <AnimatePresence>
        {showNewPost && <NewPostSheet onSubmit={handleCreateThread} onClose={() => setShowNewPost(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSubtema && <SubtemaSheet onSubmit={handleCreateSubtema} onClose={() => setShowSubtema(false)} />}
      </AnimatePresence>
    </div>
  );

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.surface}f2`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.teal, fontFamily: font, fontSize: 14, fontWeight: 600, padding: 0, marginRight: 4 }}>
                <ChevronLeft size={17} strokeWidth={2.2} /> Back
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.teal}20`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={18} color={C.teal} strokeWidth={1.8} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text }}>Post</h2>
                <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>Posts & threads</p>
              </div>
            </div>
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isHost ? C.accentLight : C.textMuted, background: isHost ? `${C.accent}18` : C.border + "80", border: `1px solid ${isHost ? C.accent + "30" : C.border}`, borderRadius: 6, padding: "3px 7px" }}>
              {isHost ? "Host" : "Member"}
            </span>
          </div>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <FeedPanelDesktop />
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  // Render as plain flow — unified scroll in App.jsx handles overflow
  return <FeedPanelMobile />;
}
