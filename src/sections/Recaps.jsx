import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  ChevronLeft, Search, X, Heart, MessageCircle, Image, Video,
  Mic, MicOff, Send, Play, Pause, Square, Globe, Users, Lock,
  CalendarDays, Filter, Check, ChevronDown, ChevronRight,
  Bookmark, Share2, Clock, MoreHorizontal, FileText, Megaphone, Hash, Plus, MessageSquare
} from "lucide-react";

// ─── useIsDesktop ─────────────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isDesktop;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", cardHover: "#19192a",
  border: "#1c1c2e", accent: "#7c4dff", accentLight: "#9d71ff",
  accentDim: "#3d2480", text: "#eaeaf5", textMuted: "#6a6a82", textDim: "#32324a",
  green: "#1ed99a", greenDim: "rgba(30,217,154,0.12)",
  amber: "#f5a623", blue: "#4fa3ff", red: "#ff4f6a",
  teal: "#22d3a0", tealDim: "rgba(34,211,160,0.14)",
};
const font = "'DM Sans', sans-serif";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_THREADS = [
  {
    id: "t1", planningPostId: "p1", title: "Weekly Market Outlook — Week 20",
    content: "Major confluence zones aligning across DXY and XAUUSD. Expecting a corrective move before continuation. Watch the 4H structure closely and monitor liquidity sweeps below recent lows before looking for long setups.",
    hashtags: ["#XAUUSD", "#DXY", "#WeeklyBias"],
    status: "active", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-05-12T09:00:00"),
    likes: 38, liked: false, commentCount: 12,
    newUpdates: 3,
    media: [],
    updates: [
      {
        id: "u1a", content: "DXY just swept the lows at 104.20. Watching for reversal structure on 15M before entries.",
        timestamp: new Date("2026-05-12T14:30:00"), likes: 11, liked: false,
        media: [], audio: null,
      },
      {
        id: "u1b", content: "XAUUSD confirmed the rejection at 2340 with a strong bearish engulfing on H4. Bias shifts to short-term bearish.",
        timestamp: new Date("2026-05-13T08:15:00"), likes: 19, liked: true,
        media: [{ type: "image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80", thumb: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=70" }],
        audio: null,
      },
      {
        id: "u1c", content: "Target hit at 2310. Closed 80% of the position. Leaving 20% running with SL at break-even.",
        timestamp: new Date("2026-05-14T11:00:00"), likes: 27, liked: false,
        media: [], audio: { duration: 24, waveform: [0.2,0.5,0.8,0.6,0.9,0.4,0.7,0.3,0.6,0.8,0.5,0.4,0.9,0.7,0.3,0.6,0.5,0.8,0.4,0.6] },
      },
    ],
  },
  {
    id: "t2", planningPostId: "p2", title: "EURUSD Breakout Setup",
    content: "Price is compressing into a key daily resistance zone. A confirmed break with a 4H close above 1.0940 could lead to a 150–200 pip move. Waiting for retest confirmation. Risk management is critical — size accordingly.",
    hashtags: ["#EURUSD", "#Breakout", "#Forex"],
    status: "closed", visibility: "public",
    author: "Alex H.", timestamp: new Date("2026-05-10T16:00:00"),
    likes: 21, liked: true, commentCount: 5,
    newUpdates: 0,
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=800&q=80", thumb: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=400&q=70" }],
    updates: [
      {
        id: "u2a", content: "Breakout confirmed! 4H close above 1.0940 with strong volume. Targets: 1.1050 / 1.1120.",
        timestamp: new Date("2026-05-11T10:00:00"), likes: 15, liked: false,
        media: [], audio: null,
      },
    ],
  },
  {
    id: "t3", planningPostId: "p4", title: "NASDAQ Pre-Market Analysis — May 8",
    content: "Watching the 18,200 support level carefully. A bounce here could take NQ back to ATH territory. Macro data Thursday will be the real catalyst — NFP expectations already priced in by most desks.",
    hashtags: ["#NASDAQ", "#NQ", "#Indices"],
    status: "active", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-05-08T08:30:00"),
    likes: 56, liked: false, commentCount: 19,
    newUpdates: 1,
    media: [],
    updates: [
      {
        id: "u3a", content: "NQ bounced exactly off 18,200. Now testing 18,400 resistance. Watching for breakout.",
        timestamp: new Date("2026-05-08T15:00:00"), likes: 22, liked: true,
        media: [], audio: { duration: 47, waveform: [0.3,0.6,0.9,0.5,0.4,0.8,0.7,0.2,0.5,0.9,0.6,0.3,0.7,0.5,0.8,0.4,0.6,0.9,0.3,0.7] },
      },
    ],
  },
  {
    id: "t4", planningPostId: "p3", title: "DXY Alert — Live Update",
    content: "Quick heads-up: DXY rejection happening in real-time off the 104.50 zone. Pairs like EURUSD and GBPUSD may see upside pressure. Stay alert and adjust open positions accordingly.",
    hashtags: ["#DXY", "#Live", "#Alert"],
    status: "closed", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-04-28T11:20:00"),
    likes: 14, liked: false, commentCount: 7,
    newUpdates: 0,
    media: [],
    updates: [],
  },
  {
    id: "t5", title: "Gold Weekly Bias — Week 18",
    content: "Higher timeframe structure is bullish. Looking for pullbacks into the 2280–2300 zone for high probability long setups. Key risk events this week: CPI Tuesday, FOMC minutes Wednesday.",
    hashtags: ["#XAUUSD", "#Gold", "#WeeklyBias"],
    status: "closed", visibility: "members",
    author: "Alex H.", timestamp: new Date("2026-04-20T09:00:00"),
    likes: 44, liked: false, commentCount: 11,
    newUpdates: 0,
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80", thumb: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=70" }],
    updates: [
      {
        id: "u5a", content: "Price pulled back to 2290. Long setup triggered. SL below 2278, TP1 at 2320.",
        timestamp: new Date("2026-04-21T10:00:00"), likes: 18, liked: false,
        media: [], audio: null,
      },
      {
        id: "u5b", content: "TP1 hit at 2320. Moving SL to entry. Targeting 2340 for full close.",
        timestamp: new Date("2026-04-22T14:00:00"), likes: 31, liked: true,
        media: [], audio: null,
      },
    ],
  },
  {
    id: "t6", title: "GBPUSD — Structural Break",
    content: "GBPUSD breaking below key weekly support at 1.2600. If confirmed, potential move toward 1.2450. Risk-off tone dominating — position sizing is key.",
    hashtags: ["#GBPUSD", "#Structure", "#Forex"],
    status: "closed", visibility: "public",
    author: "Alex H.", timestamp: new Date("2026-03-15T08:00:00"),
    likes: 29, liked: false, commentCount: 8,
    newUpdates: 0,
    media: [],
    updates: [],
  },
];

const MOCK_COMMENTS = {
  t1: [
    { id: "c1", author: "Marco V.", avatar: "M", text: "Great analysis! The liquidity sweep angle makes sense.", likes: 8, liked: false, time: "1h ago" },
    { id: "c2", author: "Sarah K.", avatar: "S", text: "Been tracking XAUUSD all week — matches my daily view.", likes: 3, liked: false, time: "1h ago" },
    { id: "c3", author: "James P.", avatar: "J", text: "Is the target still 2340 or shifted after CPI data?", likes: 1, liked: false, time: "45m ago" },
  ],
  t2: [
    { id: "c4", author: "Tom R.", avatar: "T", text: "Waiting for that retest myself. Great entry criteria!", likes: 4, liked: false, time: "4h ago" },
    { id: "c5", author: "Ana B.", avatar: "A", text: "The 200 pip target is conservative — might run further.", likes: 2, liked: false, time: "3h ago" },
  ],
  t3: [
    { id: "c6", author: "Yuki T.", avatar: "Y", text: "NFP is the wildcard this week. Great context.", likes: 6, liked: false, time: "2d ago" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatDate(d) {
  if (!d) return "";
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`;
}

function formatTime(d) {
  if (!d) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function monthLabel(d) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByMonth(threads) {
  const groups = {};
  threads.forEach((t) => {
    const key = monthLabel(t.timestamp);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

function fmtAudioDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${C.accentDim}, ${C.accentDim}88)`,
      border: `1px solid ${C.accentDim}66`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontFamily: font, fontSize: size * 0.38, fontWeight: 700, color: C.text,
    }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ─── StatusChip (dropdown) ────────────────────────────────────────────────────
const STATUS_OPTIONS_R = [
  { id: "active",      label: "Active",      color: "#1ed99a", bg: "rgba(30,217,154,0.12)" },
  { id: "in_progress", label: "In Progress", color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  { id: "closed",      label: "Closed",      color: "#6a6a82", bg: "rgba(106,106,130,0.1)"  },
];

function StatusChip({ status, isHost, onSetStatus, small }) {
  const [open, setOpen] = useState(false);
  const opt = STATUS_OPTIONS_R.find(o => o.id === status) || STATUS_OPTIONS_R[0];

  const chip = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: small ? 4 : 5, padding: small ? "3px 8px" : "4px 10px", borderRadius: 99, border: `1px solid ${opt.color}40`, background: opt.bg }}>
      <span style={{ width: small ? 4 : 5, height: small ? 4 : 5, borderRadius: "50%", background: opt.color, boxShadow: `0 0 6px ${opt.color}` }} />
      <span style={{ fontFamily: font, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: opt.color }}>{opt.label}</span>
      {isHost && <ChevronRight size={9} color={opt.color} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />}
    </div>
  );

  if (!isHost) return chip;

  return (
    <div style={{ position: "relative" }}>
      <motion.button whileTap={{ scale: 0.94 }} onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
        {chip}
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 201, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 150, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {STATUS_OPTIONS_R.map(s => (
                <button key={s.id} onClick={() => { onSetStatus && onSetStatus(s.id); setOpen(false); }}
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

// ─── MonthDivider ─────────────────────────────────────────────────────────────
function MonthDivider({ label }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0 2px", margin: "8px 0 2px" }}
    >
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.border}, transparent)` }} />
      <div style={{
        padding: "5px 14px", borderRadius: 99,
        background: "rgba(14,14,24,0.85)", backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid rgba(92,47,255,0.22)`,
        boxShadow: "0 0 20px rgba(124,77,255,0.1)",
      }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.accentLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, ${C.border}, transparent)` }} />
    </motion.div>
  );
}

// ─── CalendarPicker ───────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(value ? value.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isSelected = (d) => value && value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === d;
  const isToday = (d) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
  const isFuture = (d) => new Date(viewYear, viewMonth, d) > today;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 401, width: "calc(100% - 40px)", maxWidth: 340,
          background: "rgba(14,14,24,0.96)", backdropFilter: "blur(28px)",
          border: `1px solid rgba(124,77,255,0.25)`, borderRadius: 24,
          padding: 20, boxShadow: "0 8px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,77,255,0.1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: C.text }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 8 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} style={{ textAlign: "center", fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textDim, padding: "2px 0" }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {cells.map((d, i) => (
            <button key={i} disabled={!d || isFuture(d)}
              onClick={() => { if (d && !isFuture(d)) { onChange(new Date(viewYear, viewMonth, d)); onClose(); } }}
              style={{
                height: 36, borderRadius: 9, border: "none", cursor: d && !isFuture(d) ? "pointer" : "default",
                background: isSelected(d) ? C.accent : isToday(d) ? `${C.accent}22` : "transparent",
                color: !d ? "transparent" : isSelected(d) ? "#fff" : isFuture(d) ? C.textDim : isToday(d) ? C.accentLight : C.text,
                fontFamily: font, fontSize: 13, fontWeight: isSelected(d) ? 700 : 500,
                boxShadow: isSelected(d) ? `0 0 12px ${C.accent}60` : "none",
                transition: "all 0.15s",
              }}>
              {d || ""}
            </button>
          ))}
        </div>

        {/* Clear */}
        {value && (
          <button onClick={() => { onChange(null); onClose(); }}
            style={{ width: "100%", marginTop: 14, padding: "9px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontFamily: font, fontSize: 13, cursor: "pointer" }}>
            Clear date filter
          </button>
        )}
      </motion.div>
    </>
  );
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({ audio, accentColor }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const acc = accentColor || C.teal;

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
  const wf = audio.waveform || [];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: `${acc}14`, border: `1px solid ${acc}30`,
      borderRadius: 14, padding: "10px 14px",
    }}>
      <button onClick={toggle} style={{
        width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
        background: `linear-gradient(135deg, ${acc}, ${acc}bb)`,
        boxShadow: `0 0 12px ${acc}50`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {playing ? <Pause size={14} color="#fff" fill="#fff" /> : <Play size={14} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />}
      </button>

      {/* Waveform bars */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 28, overflow: "hidden" }}>
        {wf.map((h, i) => {
          const barProgress = i / wf.length;
          const played = progress / 100;
          return (
            <div key={i} style={{
              flex: 1, borderRadius: 99, transition: "all 0.1s",
              height: `${Math.max(4, h * 28)}px`,
              background: barProgress <= played ? acc : `${acc}40`,
            }} />
          );
        })}
      </div>

      <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: acc, flexShrink: 0, minWidth: 32, textAlign: "right" }}>
        {fmtAudioDuration(playing ? elapsed : audio.duration)}
      </span>
    </div>
  );
}

// ─── CommentsSheet ────────────────────────────────────────────────────────────
function CommentsSheet({ threadId, onClose }) {
  const comments = MOCK_COMMENTS[threadId] || [];
  const [localComments, setLocalComments] = useState(comments.map(c => ({ ...c })));
  const [newComment, setNewComment] = useState("");
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 260], [1, 0]);

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
    else y.set(0);
  };

  const submit = () => {
    if (!newComment.trim()) return;
    setLocalComments(prev => [...prev, { id: `c_${Date.now()}`, author: "You", avatar: "Y", text: newComment.trim(), likes: 0, liked: false, time: "just now" }]);
    setNewComment("");
  };

  const toggleLike = (id) => setLocalComments(prev => prev.map(c => c.id === id ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 } : c));

  return (
    <AnimatePresence>
      <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }} />
      <motion.div key="sh" style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 430, margin: "0 auto", y, opacity, zIndex: 501, background: "rgba(14,14,24,0.88)", backdropFilter: "blur(32px)", borderRadius: "28px 28px 0 0", border: `1px solid rgba(92,47,255,0.2)`, borderBottom: "none", boxShadow: "0 -4px 60px rgba(124,77,255,0.18)", maxHeight: "78vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        drag="y" dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={handleDragEnd} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px", cursor: "grab", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: `rgba(124,77,255,0.5)`, boxShadow: `0 0 8px rgba(124,77,255,0.4)` }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 14px", flexShrink: 0, borderBottom: `1px solid rgba(124,77,255,0.12)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Comments</span>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: C.accentLight, background: `${C.accent}20`, border: `1px solid ${C.accent}35`, borderRadius: 20, padding: "2px 9px" }}>{localComments.length}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 18 }}>
          {localComments.length === 0 && <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 14, padding: "32px 0" }}>No comments yet — be first 👇</p>}
          {localComments.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} style={{ display: "flex", gap: 12 }}>
              <Avatar name={c.avatar} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{c.author}</span>
                  <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{c.time}</span>
                </div>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{c.text}</p>
                <button onClick={() => toggleLike(c.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: c.liked ? C.red : C.textMuted, cursor: "pointer", fontFamily: font, fontSize: 11, fontWeight: 600, padding: 0, marginTop: 6 }}>
                  <Heart size={12} fill={c.liked ? C.red : "none"} /> {c.likes > 0 && c.likes}
                </button>
              </div>
            </motion.div>
          ))}
          <div style={{ height: 8 }} />
        </div>
        <div style={{ padding: "12px 16px 20px", borderTop: `1px solid rgba(124,77,255,0.12)`, background: "rgba(8,8,14,0.6)", backdropFilter: "blur(16px)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <Avatar name="Y" size={32} />
          <div style={{ flex: 1, position: "relative" }}>
            <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }}
              placeholder="Write a comment…"
              style={{ width: "100%", background: "rgba(19,19,31,0.9)", border: `1px solid ${newComment.trim() ? C.accent + "55" : C.border}`, borderRadius: 22, padding: "10px 48px 10px 16px", color: C.text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} />
            <motion.button whileTap={{ scale: 0.88 }} onClick={submit}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: newComment.trim() ? `linear-gradient(135deg, ${C.accent}, #5c2fff)` : C.border, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: newComment.trim() ? "pointer" : "default", transition: "background 0.2s", boxShadow: newComment.trim() ? `0 0 14px ${C.accent}60` : "none" }}>
              <Send size={13} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── UpdateComposer ───────────────────────────────────────────────────────────
function UpdateComposer({ onSubmit }) {
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const timerRef = useRef(null);

  const startRecord = () => {
    setRecording(true); setRecordSecs(0);
    timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
  };
  const stopRecord = () => {
    clearInterval(timerRef.current); setRecording(false);
    const dur = recordSecs;
    const wf = Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2);
    onSubmit({ content: content.trim(), audio: { duration: dur, waveform: wf } });
    setContent(""); setRecordSecs(0);
  };
  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit({ content: content.trim(), audio: null });
    setContent("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 430, margin: "0 auto", zIndex: 40,
        background: "rgba(14,14,24,0.92)", backdropFilter: "blur(28px)",
        borderTop: `1px solid rgba(92,47,255,0.2)`,
        boxShadow: "0 -4px 40px rgba(34,211,160,0.1)",
        padding: "10px 14px 20px",
      }}
    >
      {recording ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: `${C.red}14`, border: `1px solid ${C.red}30`, borderRadius: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}`, animation: "pulse 1s infinite" }} />
          <span style={{ fontFamily: font, fontSize: 14, color: C.red, fontWeight: 600, flex: 1 }}>Recording… {fmtAudioDuration(recordSecs)}</span>
          <button onClick={stopRecord} style={{ display: "flex", alignItems: "center", gap: 6, background: C.red, border: "none", borderRadius: 10, padding: "7px 14px", cursor: "pointer", color: "#fff", fontFamily: font, fontSize: 13, fontWeight: 600 }}>
            <Square size={13} fill="#fff" /> Done
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: C.card, border: `1px solid ${focused ? C.teal + "55" : C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: focused ? `0 0 0 1px ${C.teal}22, 0 4px 24px rgba(34,211,160,0.08)` : "none", transition: "all 0.2s" }}>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <textarea
                value={content} onChange={e => setContent(e.target.value)}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                placeholder="Share an update on this thread…"
                rows={2}
                style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.55, padding: "12px 14px" }}
              />
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleSubmit}
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, margin: "0 8px 8px 0", background: content.trim() ? `linear-gradient(135deg, ${C.teal}, #0ea876)` : C.border, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: content.trim() ? "pointer" : "default", transition: "all 0.2s", boxShadow: content.trim() ? `0 2px 14px ${C.teal}50` : "none" }}>
                <Send size={15} />
              </motion.button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, paddingLeft: 2 }}>
            {[{ icon: Image, label: "Photo" }, { icon: Video, label: "Video" }].map(a => (
              <motion.button key={a.label} whileTap={{ scale: 0.93 }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 11, fontWeight: 600 }}>
                <a.icon size={13} /> {a.label}
              </motion.button>
            ))}
            <motion.button whileTap={{ scale: 0.93 }} onClick={startRecord}
              style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 11, fontWeight: 600 }}>
              <Mic size={13} /> Audio
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── ThreadCard (feed item) ───────────────────────────────────────────────────
function ThreadCard({ thread, index, onClick }) {
  const [hov, setHov] = useState(false);
  const active = thread.status === "active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 + index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.cardHover : C.card,
        border: `1px solid ${hov ? C.teal + "44" : C.border}`,
        borderRadius: 16,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.18s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: hov ? `0 0 0 1px ${C.teal}22, 0 6px 24px rgba(34,211,160,0.08)` : "none",
        transform: hov ? "translateY(-1px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: "absolute", left: 0, top: 12, bottom: 12, width: 3,
        borderRadius: "0 99px 99px 0",
        background: active
          ? `linear-gradient(180deg, ${C.teal}, ${C.teal}44)`
          : C.textDim,
      }} />

      {/* Two-column layout */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingLeft: 6 }}>

        {/* LEFT — title + preview + date */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>

          {/* Title */}
          <p style={{
            margin: 0,
            fontFamily: font, fontSize: 14, fontWeight: 700,
            color: C.text, letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {thread.title || "Untitled"}
          </p>

          {/* One-line preview */}
          <p style={{
            margin: 0,
            fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {thread.content}
          </p>

          {/* Date */}
          <p style={{
            margin: 0,
            fontFamily: font, fontSize: 11, color: C.textDim, fontWeight: 500,
          }}>
            {formatDate(thread.timestamp)}
          </p>
        </div>

        {/* RIGHT — status chip + red badge (stacked, right-aligned) */}
        <div style={{
          flexShrink: 0,
          display: "flex", flexDirection: "column",
          alignItems: "flex-end", gap: 8,
          paddingTop: 1,
        }}>
          {/* Status chip — read-only in card list */}
          <StatusChip status={thread.status} isHost={false} small />

          {/* Updates badge — teal to match section color */}
          {thread.newUpdates > 0 ? (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: C.teal,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 10px ${C.teal}70`,
              }}
            >
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 800, color: "#000" }}>
                {thread.newUpdates}
              </span>
            </motion.div>
          ) : (
            /* Empty placeholder keeps layout stable */
            <div style={{ width: 24, height: 24 }} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── UpdateBubble ─────────────────────────────────────────────────────────────
function UpdateBubble({ update, index }) {
  const [liked, setLiked] = useState(update.liked);
  const [likeCount, setLikeCount] = useState(update.likes);
  const toggleLike = () => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
    >
      {/* Timeline line + dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
        <div style={{ width: 2, height: 16, background: `${C.teal}40` }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 8px ${C.teal}60`, flexShrink: 0 }} />
      </div>

      {/* Bubble */}
      <div style={{ flex: 1, background: C.card, border: `1px solid ${C.teal}22`, borderRadius: "4px 16px 16px 16px", padding: "12px 14px", marginBottom: 8 }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.6 }}>{update.content}</p>

        {update.media?.length > 0 && (
          <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", aspectRatio: "16/9" }}>
            <img src={update.media[0].thumb || update.media[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}

        {update.audio && (
          <div style={{ marginTop: 10 }}>
            <AudioPlayer audio={update.audio} accentColor={C.teal} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{formatDate(update.timestamp)} · {formatTime(update.timestamp)}</span>
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

// ─── ThreadView ───────────────────────────────────────────────────────────────
function ThreadView({ thread: initialThread, onBack, isHost, onStatusChange }) {
  const [thread, setThread] = useState(initialThread);
  const [liked, setLiked] = useState(initialThread.liked);
  const [likeCount, setLikeCount] = useState(initialThread.likes);
  const [showComments, setShowComments] = useState(false);
  const COMPOSER_H = isHost ? 130 : 0;

  const toggleLike = () => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); };

  const handleNewUpdate = ({ content, audio }) => {
    const newUpdate = { id: `u_${Date.now()}`, content, timestamp: new Date(), likes: 0, liked: false, media: [], audio };
    setThread(t => ({ ...t, updates: [...t.updates, newUpdate] }));
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.surface }}>
      {showComments && <CommentsSheet threadId={thread.id} onClose={() => setShowComments(false)} />}

      {/* Scrollable area */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {/* TopBar */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 56 }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: C.teal, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
            <ChevronLeft size={19} strokeWidth={2.2} /> Back
          </button>
          <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", textAlign: "center", marginRight: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {thread.title || "Thread"}
          </span>
        </motion.div>

        {/* Root Post — pinned look */}
        <div style={{ background: `${C.teal}08`, borderBottom: `1px solid ${C.teal}18`, padding: "20px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar name={thread.author} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>{thread.author}</span>
                <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accentLight, background: `${C.accent}18`, border: `1px solid ${C.accent}28`, borderRadius: 4, padding: "1px 5px" }}>Host</span>
              </div>
              <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{formatDate(thread.timestamp)}</span>
            </div>
            <StatusChip status={thread.status} isHost={isHost} onSetStatus={s => { setThread(t => ({...t, status: s})); onStatusChange && onStatusChange(thread.id, s); }} />
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
              <img src={thread.media[0].thumb || thread.media[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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

        {/* Updates section */}
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
            <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 13, padding: "24px 0" }}>No updates yet on this thread.</p>
          )}
        </div>

        <div style={{ height: COMPOSER_H + 24 }} />
      </div>

      {/* Host-only update composer */}
      {isHost && <UpdateComposer onSubmit={handleNewUpdate} />}
    </div>
  );
}

// ─── Sidebar data ─────────────────────────────────────────────────────────────
const SIDEBAR_SECTIONS_R = [
  { id: "planning",      label: "Planning",           icon: CalendarDays,  accent: "#7c4dff" },
  { id: "recaps",        label: "Recaps & Updates",   icon: FileText,      accent: "#22d3a0" },
  { id: "announcements", label: "Announcements",      icon: Megaphone,     accent: "#f59e0b" },
  { id: "rooms",         label: "Rooms",              icon: Hash,          accent: "#60a5fa" },
  { id: "community",     label: "Community's Chat",   icon: MessageSquare, accent: "#e879f9" },
];

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ onBack, onNavigate }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ width: 230, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>

      <div style={{ padding: "20px 18px 14px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.teal, fontFamily: font, fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 16 }}>
          <ChevronLeft size={17} strokeWidth={2.2} /> Back
        </button>
        <p style={{ margin: 0, fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Menu</p>
      </div>

      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        {SIDEBAR_SECTIONS_R.map(s => {
          const active = s.id === "recaps";
          return (
            <motion.button key={s.id} whileHover={{ x: active ? 0 : 2 }} whileTap={{ scale: 0.97 }}
              onClick={() => !active && onNavigate && onNavigate(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, border: active ? `1px solid ${s.accent}35` : "1px solid transparent", background: active ? `${s.accent}10` : "transparent", cursor: active ? "default" : "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${s.accent}${active ? "22" : "14"}`, border: `1px solid ${s.accent}${active ? "38" : "22"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={16} color={s.accent} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? s.accent : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</p>
                {active && <p style={{ margin: "1px 0 0", fontFamily: font, fontSize: 10, color: s.accent, fontWeight: 600, opacity: 0.75 }}>You are here</p>}
              </div>
              {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.accent, boxShadow: `0 0 8px ${s.accent}`, flexShrink: 0 }} />}
            </motion.button>
          );
        })}
      </div>
    </motion.aside>
  );
}

// ─── RecapsScreen (default export) ───────────────────────────────────────────
export default function Recaps({ section, onBack, isHost, onNavigate, openThreadId }) {
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState([]);   // [] = all
  const [filterDate, setFilterDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openThread, setOpenThread] = useState(() => {
    if (openThreadId) {
      // If it looks like a planning post ID (starts with "p"), find the linked thread
      if (openThreadId.startsWith("p")) {
        return MOCK_THREADS.find(t => t.planningPostId === openThreadId) || null;
      }
      return MOCK_THREADS.find(t => t.id === openThreadId) || null;
    }
    return null;
  });
  const [direction, setDirection] = useState(openThreadId ? 1 : 1);
  const feedScrollRef = useRef(0);
  const feedContainerRef = useRef(null);

  // If openThreadId changes after mount, navigate to it
  useEffect(() => {
    if (openThreadId) {
      const t = openThreadId.startsWith("p")
        ? threads.find(th => th.planningPostId === openThreadId)
        : threads.find(th => th.id === openThreadId);
      if (t) { setDirection(1); setOpenThread(t); }
    }
  }, [openThreadId]); // eslint-disable-line

  const handleStatusChange = (threadId, newStatus) => {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, status: newStatus } : t));
    if (openThread && openThread.id === threadId) setOpenThread(t => t ? { ...t, status: newStatus } : t);
  };

  // Restore scroll on back
  useEffect(() => {
    if (!openThread && feedContainerRef.current) {
      feedContainerRef.current.scrollTop = feedScrollRef.current;
    }
  }, [openThread]);

  const openThreadView = useCallback((thread) => {
    if (feedContainerRef.current) feedScrollRef.current = feedContainerRef.current.scrollTop;
    setDirection(1); setOpenThread(thread);
  }, []);

  const closeThread = useCallback(() => { setDirection(-1); setOpenThread(null); }, []);

  // Derived feed
  const filtered = useMemo(() => {
    let list = [...threads].sort((a, b) => b.timestamp - a.timestamp);
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      list = list.filter(t => t.title?.toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || t.hashtags?.some(h => h.toLowerCase().includes(q)));
    }
    if (filterStatus.length > 0) list = list.filter(t => filterStatus.includes(t.status));
    if (filterDate) list = list.filter(t => t.timestamp >= filterDate);
    return list;
  }, [threads, activeQuery, filterStatus, filterDate]);

  const filtersActive = activeQuery || filterStatus.length > 0 || filterDate;
  const grouped = useMemo(() => !filtersActive ? groupByMonth(filtered) : null, [filtered, filtersActive]);

  const slideVariants = {
    enter: (d) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };
  const springTrans = { type: "spring", stiffness: 380, damping: 38, mass: 0.85 };

  const toggleStatus = (s) => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // Filter chip count
  const filterCount = filterStatus.length + (filterDate ? 1 : 0);

  const isDesktop = useIsDesktop();

  // ── Core feed panel (used in both mobile and desktop) ──────────────────────
  const FeedPanel = ({ fullHeight }) => (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: fullHeight ? "100%" : "100%", overflow: "hidden" }}>
      <AnimatePresence mode="popLayout" custom={direction}>
        {!openThread ? (
          <motion.div key="feed" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={springTrans}
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: C.surface }}>

            {/* TopBar — mobile only shows Back, desktop omits it */}
            {!isDesktop && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, flexShrink: 0 }}>
                <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: C.teal, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
                  <ChevronLeft size={19} strokeWidth={2.2} /> Back
                </button>
                <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center", marginRight: 44 }}>
                  {section.label}
                </span>
              </motion.div>
            )}

            {/* Search bar */}
            <div style={{ padding: isDesktop ? "12px 20px 8px" : "12px 14px 8px", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${activeQuery ? C.teal + "55" : C.border}`, borderRadius: 14, padding: "0 14px", transition: "border-color 0.2s" }}>
                  <Search size={15} color={C.textMuted} strokeWidth={2} />
                  <input
                    value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") setActiveQuery(query.trim()); }}
                    placeholder="Search threads…"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 14, padding: "11px 0" }}
                  />
                  {query && (
                    <button onClick={() => { setQuery(""); setActiveQuery(""); }} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0, display: "flex" }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowFilters(f => !f)}
                  style={{ position: "relative", width: 44, height: 44, borderRadius: 14, border: `1px solid ${showFilters || filterCount > 0 ? C.teal + "55" : C.border}`, background: showFilters ? `${C.teal}14` : C.card, color: showFilters || filterCount > 0 ? C.teal : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                  <Filter size={16} />
                  {filterCount > 0 && (
                    <div style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: font, fontSize: 9, fontWeight: 800, color: "#000" }}>{filterCount}</span>
                    </div>
                  )}
                </motion.button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", width: 52, flexShrink: 0 }}>Status</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          {["active", "closed"].map(s => {
                            const on = filterStatus.includes(s);
                            return (
                              <button key={s} onClick={() => toggleStatus(s)}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 99, cursor: "pointer", border: `1px solid ${on ? (s === "active" ? C.green + "55" : C.border) : C.border}`, background: on ? (s === "active" ? C.greenDim : "rgba(255,255,255,0.05)") : "transparent", color: on ? (s === "active" ? C.green : C.text) : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}>
                                {on && <Check size={11} strokeWidth={3} />}
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", width: 52, flexShrink: 0 }}>From</span>
                        <button onClick={() => setShowCalendar(true)}
                          style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 99, cursor: "pointer", border: `1px solid ${filterDate ? C.teal + "55" : C.border}`, background: filterDate ? C.tealDim : "transparent", color: filterDate ? C.teal : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}>
                          <CalendarDays size={13} />
                          {filterDate ? `${MONTHS[filterDate.getMonth()].slice(0,3)} ${filterDate.getDate()}, ${filterDate.getFullYear()}` : "Pick date"}
                        </button>
                        {filterDate && (
                          <button onClick={() => setFilterDate(null)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0, display: "flex" }}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {(filterStatus.length > 0 || filterDate) && (
                        <button onClick={() => { setFilterStatus([]); setFilterDate(null); }}
                          style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontFamily: font, fontSize: 11, cursor: "pointer" }}>
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Feed */}
            <div ref={feedContainerRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isDesktop ? "4px 20px 24px" : "4px 14px 24px" }}>
              {filtered.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ textAlign: "center", padding: "48px 20px", color: C.textMuted, fontFamily: font, fontSize: 14 }}>
                  No threads found
                </motion.div>
              )}
              {grouped ? (
                Object.entries(grouped).map(([month, items]) => (
                  <div key={month}>
                    <MonthDivider label={month} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                      {items.map((t, i) => (
                        <ThreadCard key={t.id} thread={t} index={i} onClick={() => openThreadView(t)} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                  {filtered.map((t, i) => (
                    <ThreadCard key={t.id} thread={t} index={i} onClick={() => openThreadView(t)} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key={openThread.id} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={springTrans}
            style={{ position: "absolute", inset: 0, background: C.surface }}>
            <ThreadView thread={openThread} onBack={closeThread} isHost={isHost} onStatusChange={handleStatusChange} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCalendar && <CalendarPicker value={filterDate} onChange={setFilterDate} onClose={() => setShowCalendar(false)} />}
      </AnimatePresence>
    </div>
  );

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg }}>
        <Sidebar onBack={onBack} onNavigate={id => onNavigate && onNavigate(id)} />

        <div style={{ flex: 1, overflowY: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Sticky desktop top bar */}
          <div style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.surface}f2`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.teal}20`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={18} color={C.teal} strokeWidth={1.8} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text }}>{section.label}</h2>
                <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>{section.subtitle}</p>
              </div>
            </div>
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isHost ? C.accentLight : C.textMuted, background: isHost ? `${C.accent}18` : C.border + "80", border: `1px solid ${isHost ? C.accent + "30" : C.border}`, borderRadius: 6, padding: "3px 7px" }}>
              {isHost ? "Host" : "Member"}
            </span>
          </div>

          <div style={{ flex: 1, overflow: "hidden", maxWidth: 800, width: "100%", alignSelf: "center", display: "flex", flexDirection: "column" }}>
            <FeedPanel fullHeight />
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FeedPanel fullHeight />
    </div>
  );
}
