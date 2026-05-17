import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  ChevronLeft, Globe, Users, Lock, Send, Image, Video, Mic, Square,
  Pin, Heart, MessageCircle, X, ChevronRight, ZoomIn, Share2,
  Bookmark, MoreHorizontal, Edit3, Trash2, Check, Plus,
  CalendarDays, FileText, Megaphone, Hash, ExternalLink, MessageSquare,
} from "lucide-react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", cardHover: "#19192a",
  border: "#1c1c2e", accent: "#7c4dff", accentLight: "#9d71ff", accentDim: "#3d2480",
  text: "#eaeaf5", textMuted: "#6a6a82", textDim: "#32324a",
  green: "#1ed99a", greenDim: "rgba(30,217,154,0.12)",
  amber: "#f5a623", blue: "#4fa3ff", red: "#ff4f6a", teal: "#22d3a0",
};
const font = "'DM Sans', sans-serif";

// ─── Detect desktop ───────────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isDesktop;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_POSTS = [
  {
    id: "p1", title: "Weekly Market Outlook",
    content: "Major confluence zones aligning across DXY and XAUUSD. Expecting a corrective move before continuation. Watch the 4H structure closely and monitor liquidity sweeps below recent lows before looking for long setups.",
    hashtags: ["#XAUUSD", "#DXY", "#WeeklyBias", "#Liquidity"],
    media: [
      { type: "image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=85", thumb: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=75" },
      { type: "image", url: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=900&q=85", thumb: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=600&q=75" },
    ],
    visibility: "members", status: "active", pinned: true,
    likes: 38, liked: false, commentCount: 12, author: "Alex H.", timestamp: "2h ago",
  },
  {
    id: "p2", title: "EURUSD Breakout Setup",
    content: "Price is compressing into a key daily resistance zone. A confirmed break with a 4H close above 1.0940 could lead to a 150-200 pip move. Waiting for retest confirmation. Risk management is critical.",
    hashtags: ["#EURUSD", "#Breakout", "#Forex", "#RiskManagement"],
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=900&q=85", thumb: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=600&q=75" }],
    visibility: "public", status: "active", pinned: false,
    likes: 21, liked: true, commentCount: 5, author: "Alex H.", timestamp: "5h ago",
  },
  {
    id: "p3", title: null,
    content: "Quick heads-up: DXY rejection happening in real-time off the 104.50 zone. Pairs like EURUSD and GBPUSD may see upside pressure. Stay alert and adjust open positions accordingly.",
    hashtags: ["#DXY", "#Live", "#Alert"],
    media: [],
    visibility: "members", status: "closed", pinned: false,
    likes: 14, liked: false, commentCount: 7, author: "Alex H.", timestamp: "Yesterday",
  },
  {
    id: "p4", title: "NASDAQ Pre-Market Analysis",
    content: "Watching the 18,200 support level carefully. A bounce here could take NQ back to ATH territory. Macro data Thursday will be the real catalyst.",
    hashtags: ["#NASDAQ", "#NQ", "#Indices", "#Macro"],
    media: [
      { type: "image", url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900&q=85", thumb: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&q=75" },
      { type: "image", url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900&q=85", thumb: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=75" },
      { type: "image", url: "https://images.unsplash.com/photo-1605792657660-596af9009e82?w=900&q=85", thumb: "https://images.unsplash.com/photo-1605792657660-596af9009e82?w=600&q=75" },
    ],
    visibility: "public", status: "active", pinned: false,
    likes: 56, liked: false, commentCount: 19, author: "Alex H.", timestamp: "2 days ago",
  },
];

const MOCK_COMMENTS = {
  p1: [
    { id: "c1", author: "Marco V.", avatar: "M", text: "Great analysis! The liquidity sweep angle makes a lot of sense here.", likes: 8, liked: false, time: "1h ago" },
    { id: "c2", author: "Sarah K.", avatar: "S", text: "Been tracking XAUUSD all week. This matches what I see on the daily.", likes: 3, liked: false, time: "1h ago" },
    { id: "c3", author: "James P.", avatar: "J", text: "Is the target still 2340 or has it shifted with the CPI data?", likes: 1, liked: false, time: "45m ago" },
    { id: "c4", author: "Lena M.", avatar: "L", text: "Perfect timing on this post!", likes: 5, liked: true, time: "30m ago" },
  ],
  p2: [
    { id: "c5", author: "Tom R.", avatar: "T", text: "Waiting for that retest myself. Great entry criteria!", likes: 4, liked: false, time: "4h ago" },
    { id: "c6", author: "Ana B.", avatar: "A", text: "The 200 pip target is conservative. Might run further if risk-off continues.", likes: 2, liked: false, time: "3h ago" },
  ],
  p3: [{ id: "c7", author: "Chris D.", avatar: "C", text: "Caught the EURUSD move. Thanks for the alert!", likes: 9, liked: false, time: "Yesterday" }],
  p4: [
    { id: "c8", author: "Yuki T.", avatar: "Y", text: "NFP is the wildcard this week. Great context.", likes: 6, liked: false, time: "2d ago" },
    { id: "c9", author: "Priya S.", avatar: "P", text: "NASDAQ has been wild. Keeping positions light until Thursday.", likes: 3, liked: false, time: "2d ago" },
    { id: "c10", author: "Rafi M.", avatar: "R", text: "18,200 is a critical level. Good breakdown.", likes: 7, liked: false, time: "2d ago" },
  ],
};

const PRIVACY_OPTIONS = [
  { id: "public", icon: Globe, label: "Public", desc: "Visible to everyone", color: C.green },
  { id: "members", icon: Users, label: "Members Only", desc: "Only workspace members", color: C.blue },
  { id: "private", icon: Lock, label: "Private", desc: "Only you can see this", color: C.amber },
];
const EMOJI_MAP = { public: "🌍", members: "👥", private: "🔒" };

const SIDEBAR_SECTIONS = [
  { id: "planning",      label: "Planning",           icon: CalendarDays,  accent: "#7c4dff" },
  { id: "recaps",        label: "Recaps & Updates",   icon: FileText,      accent: "#22d3a0" },
  { id: "announcements", label: "Announcements",      icon: Megaphone,     accent: "#f59e0b" },
  { id: "rooms",         label: "Rooms",              icon: Hash,          accent: "#60a5fa" },
  { id: "community",     label: "Community's Chat",   icon: MessageSquare, accent: "#e879f9" },
];

function fmtDuration(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${C.accentDim}, ${C.accentDim}88)`,
      border: `1px solid ${C.accentDim}66`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: font, fontSize: size * 0.38, fontWeight: 700, color: C.text,
    }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ─── StatusChip (dropdown) ────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { id: "active",      label: "Active",      color: "#1ed99a", bg: "rgba(30,217,154,0.12)" },
  { id: "in_progress", label: "In Progress", color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  { id: "closed",      label: "Closed",      color: "#6a6a82", bg: "rgba(106,106,130,0.1)"  },
];

function StatusChip({ status, isHost, onSetStatus }) {
  const [open, setOpen] = useState(false);
  const opt = STATUS_OPTIONS.find(o => o.id === status) || STATUS_OPTIONS[0];

  if (!isHost) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${opt.color}40`, background: opt.bg }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: opt.color, boxShadow: `0 0 6px ${opt.color}` }} />
        <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: opt.color }}>{opt.label}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <motion.button whileTap={{ scale: 0.94 }} onClick={() => setOpen(o => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, cursor: "pointer", border: `1px solid ${opt.color}40`, background: opt.bg, transition: "all 0.2s" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: opt.color, boxShadow: `0 0 6px ${opt.color}` }} />
        <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: opt.color }}>{opt.label}</span>
        <ChevronRight size={10} color={opt.color} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 201, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 150, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.id} onClick={() => { onSetStatus(s.id); setOpen(false); }}
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

// ─── TitleChip ────────────────────────────────────────────────────────────────
function TitleChip({ title }) {
  if (!title) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      background: "linear-gradient(135deg, rgba(124,77,255,0.2), rgba(157,113,255,0.12))",
      border: "1px solid rgba(124,77,255,0.35)", borderRadius: 999, padding: "5px 14px",
      marginBottom: 8, backdropFilter: "blur(8px)",
    }}>
      <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.accentLight }}>{title}</span>
    </div>
  );
}

// ─── FullscreenViewer — Telegram style ───────────────────────────────────────
function FullscreenViewer({ media, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const [dragDir, setDragDir] = useState(0);

  // Keyboard nav
  useEffect(() => {
    const fn = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % media.length);
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + media.length) % media.length);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [media.length, onClose]);

  const goNext = e => { e.stopPropagation(); setDragDir(-1); setIdx(i => (i + 1) % media.length); };
  const goPrev = e => { e.stopPropagation(); setDragDir(1);  setIdx(i => (i - 1 + media.length) % media.length); };

  const handleImgDragEnd = (_, info) => {
    if (Math.abs(info.offset.y) > 100) { onClose(); return; }
    if (info.offset.x < -60 && idx < media.length - 1) { setDragDir(-1); setIdx(i => i + 1); }
    if (info.offset.x >  60 && idx > 0)                { setDragDir(1);  setIdx(i => i - 1); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.97)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", userSelect: "none" }}
    >
      {/* Close btn */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }}
        onClick={e => { e.stopPropagation(); onClose(); }}
        style={{ position: "absolute", top: 18, right: 18, zIndex: 10001, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)" }}>
        <X size={20} strokeWidth={2} />
      </motion.button>

      {/* Counter */}
      {media.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", borderRadius: 99, padding: "5px 14px" }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{idx + 1} / {media.length}</span>
        </motion.div>
      )}

      {/* Image — fills viewport, drag to dismiss or swipe between */}
      <motion.div
        key={idx}
        custom={dragDir}
        initial={{ opacity: 0, x: dragDir * 60, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: dragDir * -60 }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
        drag onClick={e => e.stopPropagation()}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleImgDragEnd}
        style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab" }}
      >
        <img
          src={media[idx].url}
          alt=""
          draggable={false}
          style={{
            maxWidth: "100vw",
            maxHeight: "100vh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
            borderRadius: 0,
            pointerEvents: "none",
          }}
        />
      </motion.div>

      {/* Prev / Next arrows — desktop */}
      {media.length > 1 && (
        <>
          <button onClick={goPrev}
            style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)", opacity: idx === 0 ? 0.3 : 1 }}>
            <ChevronLeft size={22} />
          </button>
          <button onClick={goNext}
            style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)", opacity: idx === media.length - 1 ? 0.3 : 1 }}>
            <ChevronRight size={22} />
          </button>

          {/* Dot indicators */}
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 7 }}>
            {media.map((_, i) => (
              <motion.div key={i} onClick={() => setIdx(i)}
                animate={{ width: i === idx ? 22 : 7, background: i === idx ? "#fff" : "rgba(255,255,255,0.35)" }}
                style={{ height: 7, borderRadius: 99, cursor: "pointer" }} transition={{ duration: 0.2 }} />
            ))}
          </div>
        </>
      )}

      {/* Swipe hint on mobile */}
      {media.length > 1 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.6, duration: 0.4 }}
          style={{ position: "absolute", bottom: media.length > 1 ? 58 : 24, fontFamily: font, fontSize: 11, color: "#fff", pointerEvents: "none" }}>
          Swipe to navigate · drag down to close
        </motion.p>
      )}
    </motion.div>
  );
}

// ─── MediaGrid (Instagram-style) ──────────────────────────────────────────────
function MediaGrid({ media, onOpen }) {
  if (!media || media.length === 0) return null;
  const count = media.length;

  if (count === 1) {
    return (
      <div onClick={() => onOpen(0)} style={{ cursor: "zoom-in", overflow: "hidden", aspectRatio: "4/3", position: "relative" }}>
        <img src={media[0].thumb || media[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", borderRadius: 6, padding: "3px 7px", display: "flex", alignItems: "center", gap: 4 }}>
          <ZoomIn size={10} color="rgba(255,255,255,0.8)" />
        </div>
      </div>
    );
  }
  if (count === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {media.slice(0, 2).map((m, i) => (
          <div key={i} onClick={() => onOpen(i)} style={{ cursor: "zoom-in", aspectRatio: "1", overflow: "hidden" }}>
            <img src={m.thumb || m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2, aspectRatio: "4/3" }}>
      <div onClick={() => onOpen(0)} style={{ gridRow: "1 / 3", cursor: "zoom-in", overflow: "hidden" }}>
        <img src={media[0].thumb || media[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      {media.slice(1, 3).map((m, i) => (
        <div key={i} onClick={() => onOpen(i + 1)} style={{ cursor: "zoom-in", overflow: "hidden", position: "relative" }}>
          <img src={m.thumb || m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          {i === 1 && count > 3 && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontFamily: font, fontSize: 22, fontWeight: 800 }}>+{count - 3}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CommentsSheet ────────────────────────────────────────────────────────────
function CommentsSheet({ postId, onClose }) {
  const [localComments, setLocalComments] = useState((MOCK_COMMENTS[postId] || []).map(c => ({ ...c })));
  const [newComment, setNewComment] = useState("");
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 260], [1, 0]);

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose(); else y.set(0);
  };
  const submit = () => {
    if (!newComment.trim()) return;
    setLocalComments(p => [...p, { id: `c_${Date.now()}`, author: "You", avatar: "Y", text: newComment.trim(), likes: 0, liked: false, time: "just now" }]);
    setNewComment("");
  };
  const toggleLike = id => setLocalComments(p => p.map(c => c.id === id ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 } : c));

  return (
    <AnimatePresence>
      <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }} />
      <motion.div key="sh"
        style={{ position: "fixed", bottom: 0, left: "50%", x: "-50%", y, opacity, zIndex: 501, width: "100%", maxWidth: 480, background: "rgba(14,14,24,0.88)", backdropFilter: "blur(32px)", borderRadius: "28px 28px 0 0", border: `1px solid rgba(92,47,255,0.2)`, borderBottom: "none", boxShadow: "0 -4px 60px rgba(124,77,255,0.18)", maxHeight: "78vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        drag="y" dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={handleDragEnd} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px", cursor: "grab", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(124,77,255,0.5)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 14px", borderBottom: `1px solid rgba(124,77,255,0.12)`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Comments</span>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: C.accentLight, background: `${C.accent}20`, border: `1px solid ${C.accent}35`, borderRadius: 20, padding: "2px 9px" }}>{localComments.length}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 18 }}>
          {localComments.length === 0 && <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 14, padding: "32px 0" }}>No comments yet</p>}
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
              placeholder="Write a comment..."
              style={{ width: "100%", background: "rgba(19,19,31,0.9)", border: `1px solid ${newComment.trim() ? C.accent + "55" : C.border}`, borderRadius: 22, padding: "10px 48px 10px 16px", color: C.text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <motion.button whileTap={{ scale: 0.88 }} onClick={submit}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: newComment.trim() ? `linear-gradient(135deg, ${C.accent}, #5c2fff)` : C.border, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: newComment.trim() ? "pointer" : "default", transition: "all 0.2s" }}>
              <Send size={13} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── PrivacySelector ──────────────────────────────────────────────────────────
function PrivacySelector({ value, onChange, onClose }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ position: "fixed", bottom: 200, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 380, zIndex: 301, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 8, boxShadow: "0 8px 48px rgba(0,0,0,0.7)" }}>
        <p style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 10px 4px", margin: 0 }}>Visibility</p>
        {PRIVACY_OPTIONS.map(opt => {
          const selected = value === opt.id;
          return (
            <button key={opt.id} onClick={() => { onChange(opt.id); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", cursor: "pointer", background: selected ? `${opt.color}12` : "transparent" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${opt.color}20`, border: `1px solid ${opt.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <opt.icon size={16} color={opt.color} />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, fontWeight: 600, color: selected ? opt.color : C.text }}>{opt.label}</p>
                <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 12, color: C.textMuted }}>{opt.desc}</p>
              </div>
              {selected && <Check size={16} color={opt.color} />}
            </button>
          );
        })}
      </motion.div>
    </>
  );
}

// ─── CancelConfirm ────────────────────────────────────────────────────────────
function CancelConfirm({ onKeep, onDiscard }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onKeep}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, width: "calc(100% - 48px)", maxWidth: 320, background: "rgba(19,19,31,0.98)", backdropFilter: "blur(24px)", border: `1px solid rgba(255,79,106,0.25)`, borderRadius: 22, overflow: "hidden", boxShadow: "0 8px 60px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "24px 22px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${C.red}18`, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <X size={22} color={C.red} strokeWidth={2} />
          </div>
          <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Discard post?</p>
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>Your draft will be lost. This action cannot be undone.</p>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={onDiscard}
            style={{ width: "100%", padding: "15px", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 700, color: C.red }}>
            Discard
          </button>
          <button onClick={onKeep}
            style={{ width: "100%", padding: "15px", background: "transparent", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 600, color: C.text }}>
            Keep editing
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── AudioRecorder ────────────────────────────────────────────────────────────
function AudioRecorder({ onDone, onCancel }) {
  const [secs, setSecs] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // Start recording immediately on mount
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        const mr = new MediaRecorder(stream);
        mediaRecRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          const waveform = Array.from({ length: 20 }, () => Math.random() * 0.7 + 0.2);
          onDone({ url, duration: secs, waveform });
        };
        mr.start();
        setRecording(true);
        timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
      })
      .catch(err => setError("Microphone access denied"));

    return () => {
      clearInterval(timerRef.current);
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
        mediaRecRef.current.stop();
      }
    };
  }, []); // eslint-disable-line

  const stop = () => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
    }
  };

  const cancel = () => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      try { mediaRecRef.current.stop(); } catch {}
    }
    onCancel();
  };

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
        <span style={{ fontFamily: font, fontSize: 13, color: C.red }}>{error}</span>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12 }}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: `${C.red}14`, border: `1px solid ${C.red}30`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}
          style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}` }} />
        <span style={{ fontFamily: font, fontSize: 13, color: C.red, fontWeight: 600 }}>
          Recording… {Math.floor(secs / 60)}:{(secs % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <motion.button whileTap={{ scale: 0.9 }} onClick={stop}
        style={{ display: "flex", alignItems: "center", gap: 5, background: C.red, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#fff", fontFamily: font, fontSize: 12, fontWeight: 700 }}>
        <Square size={12} fill="#fff" /> Stop
      </motion.button>
      <button onClick={cancel} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12 }}>
        Cancel
      </button>
    </div>
  );
}

// ─── DeleteConfirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401, width: "calc(100% - 48px)", maxWidth: 320, background: "rgba(19,19,31,0.98)", backdropFilter: "blur(24px)", border: `1px solid rgba(255,79,106,0.25)`, borderRadius: 22, overflow: "hidden", boxShadow: "0 8px 60px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "24px 22px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${C.red}18`, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Trash2 size={20} color={C.red} strokeWidth={2} />
          </div>
          <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Delete post?</p>
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>This post will be permanently removed. This action cannot be undone.</p>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={onConfirm}
            style={{ width: "100%", padding: "15px", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 700, color: C.red }}>
            Delete
          </button>
          <button onClick={onCancel}
            style={{ width: "100%", padding: "15px", background: "transparent", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 600, color: C.text }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── MediaPicker — WhatsApp/Whop style attachment sheet ───────────────────────
function MediaPicker({ type, onFile, onClose }) {
  // type: "image" | "video"
  const fileInputRef = useRef(null);
  const accept = type === "video" ? "video/*" : "image/*";

  const options = type === "image"
    ? [
        { icon: "📷", label: "Take photo",   action: () => { if (fileInputRef.current) { fileInputRef.current.capture = "environment"; fileInputRef.current.click(); } } },
        { icon: "🖼️", label: "Choose from library", action: () => { if (fileInputRef.current) { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); } } },
        { icon: "🔗", label: "Paste URL",    action: () => { const url = prompt("Paste image URL:"); if (url) onFile({ type: "image", url, thumb: url }); onClose(); } },
      ]
    : [
        { icon: "🎬", label: "Record video",  action: () => { if (fileInputRef.current) { fileInputRef.current.capture = "environment"; fileInputRef.current.click(); } } },
        { icon: "📁", label: "Choose from files", action: () => { if (fileInputRef.current) { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); } } },
      ];

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) { onClose(); return; }
    const url = URL.createObjectURL(file);
    onFile({ type: file.type.startsWith("video") ? "video" : "image", url, thumb: url, name: file.name });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} />

      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
        onClick={e => e.stopPropagation()}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 480, margin: "0 auto", zIndex: 151, background: "rgba(14,14,24,0.97)", backdropFilter: "blur(28px)", borderRadius: "24px 24px 0 0", border: `1px solid rgba(92,47,255,0.2)`, borderBottom: "none", boxShadow: "0 -4px 40px rgba(124,77,255,0.18)", padding: "14px 16px 36px", boxSizing: "border-box" }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(124,77,255,0.4)" }} />
        </div>

        <p style={{ margin: "0 0 16px 4px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {type === "image" ? "Add photo" : "Add video"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((opt, i) => (
            <motion.button key={i} whileTap={{ scale: 0.97 }} onClick={opt.action}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", textAlign: "left", width: "100%" }}>
              <span style={{ fontSize: 24, width: 36, textAlign: "center", flexShrink: 0 }}>{opt.icon}</span>
              <span style={{ fontFamily: font, fontSize: 15, fontWeight: 600, color: C.text }}>{opt.label}</span>
              <ChevronRight size={16} color={C.textDim} style={{ marginLeft: "auto" }} />
            </motion.button>
          ))}
        </div>

        <button onClick={onClose}
          style={{ width: "100%", marginTop: 12, padding: "14px", borderRadius: 16, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 600, color: C.textMuted }}>
          Cancel
        </button>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept={accept} style={{ display: "none" }} onChange={handleFileChange} />
      </motion.div>
    </>
  );
}

// ─── PostingBar ───────────────────────────────────────────────────────────────
function PostingBar({ onSubmit, onClose }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("members");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioClip, setAudioClip] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);       // attached files
  const [showCancel, setShowCancel] = useState(false);    // confirmation dialog
  const [mediaPicker, setMediaPicker] = useState(null);   // "image" | "video" | null

  const hasContent = content.trim() || audioClip || mediaFiles.length > 0 || title.trim();

  const handleClose = () => {
    if (hasContent) setShowCancel(true);
    else onClose();
  };

  const handleDiscard = () => { setShowCancel(false); onClose(); };

  const handleSubmit = () => {
    if (!content.trim() && !audioClip && mediaFiles.length === 0) return;
    onSubmit({ title: title.trim() || null, content: content.trim(), privacy, audio: audioClip || null, media: mediaFiles });
    onClose();
  };

  const addMedia = (file) => setMediaFiles(prev => [...prev, file]);
  const removeMedia = (i) => setMediaFiles(prev => prev.filter((_, idx) => idx !== i));

  const canSubmit = content.trim() || audioClip || mediaFiles.length > 0;

  return (
    <>
      <AnimatePresence>
        {showPrivacy && <PrivacySelector value={privacy} onChange={setPrivacy} onClose={() => setShowPrivacy(false)} />}
        {showCancel && <CancelConfirm onKeep={() => setShowCancel(false)} onDiscard={handleDiscard} />}
        {mediaPicker && <MediaPicker type={mediaPicker} onFile={addMedia} onClose={() => setMediaPicker(null)} />}
      </AnimatePresence>

      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleClose}
        style={{ position: "fixed", inset: 0, zIndex: 98, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />

      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 480, margin: "0 auto", zIndex: 99, background: "rgba(14,14,24,0.97)", backdropFilter: "blur(28px)", borderTop: `1px solid rgba(92,47,255,0.25)`, borderRadius: "24px 24px 0 0", boxShadow: `0 -4px 40px rgba(124,77,255,0.22)`, padding: "16px 16px 32px", boxSizing: "border-box" }}>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(124,77,255,0.4)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>New Post</span>
          <motion.button whileTap={{ scale: 0.88 }} onClick={handleClose}
            style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={15} />
          </motion.button>
        </div>

        {/* Compose card */}
        <div style={{ background: C.card, border: `1px solid ${focused ? C.accent + "55" : C.border}`, borderRadius: 16, overflow: "hidden", transition: "all 0.2s", boxShadow: focused ? `0 0 0 1px ${C.accent}22` : "none" }}>

          {/* Privacy + title row */}
          <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            <button onClick={() => setShowPrivacy(true)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "9px 12px", color: C.textMuted, borderRight: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14 }}>{EMOJI_MAP[privacy]}</span>
              <ChevronRight size={11} style={{ transform: "rotate(90deg)", color: C.textMuted }} />
            </button>
            <input value={title} onChange={e => setTitle(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              placeholder="Title (optional)"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 13, fontStyle: "italic", padding: "9px 14px" }} />
          </div>

          {/* Media preview strip */}
          {mediaFiles.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "10px 12px 0", overflowX: "auto", scrollbarWidth: "none" }}>
              {mediaFiles.map((f, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    {f.type === "image"
                      ? <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}><Video size={24} color={C.accentLight} /></div>
                    }
                  </div>
                  <button onClick={() => removeMedia(i)}
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: C.red, border: "2px solid #0e0e18", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <X size={10} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recording or textarea */}
          {recording ? (
            <div style={{ padding: "10px 12px" }}>
              <AudioRecorder
                onDone={clip => { setAudioClip(clip); setRecording(false); }}
                onCancel={() => setRecording(false)}
              />
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <textarea value={content} onChange={e => setContent(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                placeholder={audioClip ? `Audio clip ready (${fmtDuration(audioClip.duration)}) — add a caption...` : "Share an analysis, update or plan..."}
                rows={3}
                style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.55, padding: "12px 56px 12px 14px", boxSizing: "border-box" }} />
              {/* Send btn inside textarea */}
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleSubmit}
                style={{ position: "absolute", right: 8, bottom: 8, width: 36, height: 36, borderRadius: 10, background: canSubmit ? `linear-gradient(135deg, ${C.accent}, #5c2fff)` : C.border, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: canSubmit ? "pointer" : "default", transition: "all 0.2s", boxShadow: canSubmit ? `0 2px 14px ${C.accent}60` : "none" }}>
                <Send size={15} />
              </motion.button>
            </div>
          )}

          {/* Audio clip preview */}
          {audioClip && !recording && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 10px", borderTop: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, background: `${C.accent}14`, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Mic size={13} color={C.accentLight} />
                <span style={{ fontFamily: font, fontSize: 12, color: C.accentLight, fontWeight: 600 }}>Audio clip — {fmtDuration(audioClip.duration)}</span>
              </div>
              <button onClick={() => setAudioClip(null)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Bottom action row: Photo · Video · Audio + Cancel btn */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setMediaPicker("image")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600 }}>
            <Image size={13} /> Photo
          </motion.button>

          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setMediaPicker("video")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600 }}>
            <Video size={13} /> Video
          </motion.button>

          {!recording && (
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => setRecording(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600 }}>
              <Mic size={13} /> Audio
            </motion.button>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Cancel button — right-aligned, with red tint */}
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleClose}
            style={{ display: "flex", alignItems: "center", gap: 5, background: hasContent ? `${C.red}14` : "transparent", border: `1px solid ${hasContent ? C.red + "40" : C.border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: hasContent ? C.red : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600, transition: "all 0.2s" }}>
            <X size={12} /> Cancel
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

// ─── PlanningPost ─────────────────────────────────────────────────────────────
function PlanningPost({ post, index, isHost, isDesktop, onStatusChange, onDelete, onViewUpdate }) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleLike = () => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); };
  const PRIV = PRIVACY_OPTIONS.find(o => o.id === post.visibility);
  const PrivIcon = PRIV?.icon || Globe;

  const handleDeleteClick = () => { setShowMenu(false); setShowDeleteConfirm(true); };
  const handleDeleteConfirm = () => { setShowDeleteConfirm(false); onDelete(post.id); };

  const MenuItems = () => (
    <AnimatePresence>
      {showMenu && (
        <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
          style={{ position: "absolute", right: 0, top: "100%", zIndex: 50, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {[
            { icon: Edit3, label: "Edit post", color: C.text },
            { icon: Pin, label: "Pin post", color: C.text },
            { icon: Trash2, label: "Delete", color: C.red, action: handleDeleteClick },
          ].map(item => (
            <button key={item.label} onClick={item.action || (() => setShowMenu(false))}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: item.color, fontFamily: font, fontSize: 13, fontWeight: 500 }}>
              <item.icon size={13} /> {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        {mediaOpen !== null && <FullscreenViewer media={post.media} startIndex={mediaOpen} onClose={() => setMediaOpen(null)} />}
        {showComments && <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />}
        <AnimatePresence>
          {showDeleteConfirm && <DeleteConfirm onConfirm={handleDeleteConfirm} onCancel={() => setShowDeleteConfirm(false)} />}
        </AnimatePresence>

        <motion.article
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 + index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "flex", gap: 0, background: C.card, border: `1px solid ${post.pinned ? C.accent + "35" : C.border}`, borderRadius: 20, overflow: "hidden", width: "100%", boxShadow: post.pinned ? `0 0 0 1px ${C.accent}18, 0 4px 24px rgba(124,77,255,0.1)` : "none" }}>

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {post.pinned && (
              <div style={{ background: `linear-gradient(90deg, ${C.accent}22, transparent)`, borderBottom: `1px solid ${C.accent}20`, padding: "6px 18px", display: "flex", alignItems: "center", gap: 6 }}>
                <Pin size={11} color={C.accentLight} strokeWidth={2.5} />
                <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.accentLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>Pinned</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={post.author} size={38} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>{post.author}</span>
                    <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.accentLight, background: `${C.accent}18`, border: `1px solid ${C.accent}28`, borderRadius: 4, padding: "1px 5px" }}>Host</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                    <PrivIcon size={10} color={C.textMuted} />
                    <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{post.timestamp}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusChip status={post.status} isHost={isHost} onSetStatus={s => onStatusChange(post.id, s)} />
                {isHost && (
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
                      <MoreHorizontal size={16} />
                    </button>
                    <MenuItems />
                  </div>
                )}
              </div>
            </div>

            {post.media?.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                <MediaGrid media={post.media} onOpen={i => setMediaOpen(i)} />
              </div>
            )}

            <div style={{ padding: "14px 18px 16px" }}>
              {post.title && <TitleChip title={post.title} />}
              <p style={{ margin: 0, fontFamily: font, fontSize: 14, lineHeight: 1.65, color: C.textMuted, wordBreak: "break-word", overflowWrap: "break-word" }}>{post.content}</p>
              {post.hashtags?.length > 0 && <p style={{ margin: "8px 0 0", fontFamily: font, fontSize: 12, color: C.accent, wordBreak: "break-word" }}>{post.hashtags.join(" ")}</p>}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px 14px" }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowComments(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 500 }}>
                <MessageCircle size={13} /> {post.commentCount} comments
              </motion.button>
              <button onClick={() => onViewUpdate(post.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.teal, fontFamily: font, fontSize: 13, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
                ver update
              </button>
            </div>
          </div>

          {/* Right vertical actions */}
          <div style={{ width: 64, flexShrink: 0, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0 16px", gap: 4, background: `${C.surface}60` }}>
            <motion.button whileTap={{ scale: 0.82 }} onClick={toggleLike}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "10px 0", color: liked ? C.red : C.textMuted }}>
              <Heart size={22} fill={liked ? C.red : "none"} strokeWidth={liked ? 0 : 1.8} style={{ filter: liked ? `drop-shadow(0 0 6px ${C.red}80)` : "none", transition: "all 0.18s" }} />
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600 }}>{likeCount}</span>
            </motion.button>

            <motion.button whileTap={{ scale: 0.82 }} onClick={() => setShowComments(true)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "10px 0", color: C.textMuted }}>
              <MessageCircle size={22} strokeWidth={1.8} />
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600 }}>{post.commentCount}</span>
            </motion.button>

            <motion.button whileTap={{ scale: 0.82 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "10px 0", color: C.textMuted }}>
              <Share2 size={22} strokeWidth={1.8} />
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600 }}>Share</span>
            </motion.button>

            <div style={{ width: 28, height: 1, background: C.border, margin: "4px 0" }} />

            <motion.button whileTap={{ scale: 0.82 }} onClick={() => onViewUpdate(post.id)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "10px 0", color: C.teal }}>
              <ExternalLink size={20} strokeWidth={1.8} style={{ filter: `drop-shadow(0 0 6px ${C.teal}60)` }} />
              <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2, color: C.teal }}>ver update</span>
            </motion.button>

            <motion.button whileTap={{ scale: 0.82 }} style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "8px 0", color: C.textMuted }}>
              <Bookmark size={20} strokeWidth={1.8} />
            </motion.button>
          </div>
        </motion.article>
      </>
    );
  }

  // ── MOBILE ────────────────────────────────────────────────────────────────
  return (
    <>
      {mediaOpen !== null && <FullscreenViewer media={post.media} startIndex={mediaOpen} onClose={() => setMediaOpen(null)} />}
      {showComments && <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />}
      <AnimatePresence>
        {showDeleteConfirm && <DeleteConfirm onConfirm={handleDeleteConfirm} onCancel={() => setShowDeleteConfirm(false)} />}
      </AnimatePresence>

      <motion.article
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 + index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: C.surface, overflow: "hidden" }}>

        {post.pinned && (
          <div style={{ background: `linear-gradient(90deg, ${C.accent}22, transparent)`, borderBottom: `1px solid ${C.accent}20`, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <Pin size={11} color={C.accentLight} strokeWidth={2.5} />
            <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.accentLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>Pinned</span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={post.author} size={36} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>{post.author}</span>
                <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.accentLight, background: `${C.accent}18`, border: `1px solid ${C.accent}28`, borderRadius: 4, padding: "1px 5px" }}>Host</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <PrivIcon size={10} color={C.textMuted} />
                <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{post.timestamp}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusChip status={post.status} isHost={isHost} onSetStatus={s => onStatusChange(post.id, s)} />
            {isHost && (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
                  <MoreHorizontal size={16} />
                </button>
                <MenuItems />
              </div>
            )}
          </div>
        </div>

        {/* Media full-bleed */}
        {post.media?.length > 0 && <MediaGrid media={post.media} onOpen={i => setMediaOpen(i)} />}

        {/* Instagram action row */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 6px" }}>
          <motion.button whileTap={{ scale: 0.8 }} onClick={toggleLike}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px 4px 2px", color: liked ? C.red : C.text, display: "flex" }}>
            <Heart size={26} fill={liked ? C.red : "none"} strokeWidth={liked ? 0 : 1.7} style={{ filter: liked ? `drop-shadow(0 0 8px ${C.red}80)` : "none", transition: "all 0.18s" }} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.8 }} onClick={() => setShowComments(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: C.text, display: "flex" }}>
            <MessageCircle size={24} strokeWidth={1.7} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.8 }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: C.text, display: "flex" }}>
            <Share2 size={23} strokeWidth={1.7} />
          </motion.button>
          <div style={{ flex: 1 }} />
          <motion.button whileTap={{ scale: 0.8 }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 2px 4px 8px", color: C.text, display: "flex" }}>
            <Bookmark size={23} strokeWidth={1.7} />
          </motion.button>
        </div>

        {/* Body text */}
        <div style={{ padding: "4px 14px 16px" }}>
          <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{likeCount.toLocaleString()} likes</p>
          {post.title && <TitleChip title={post.title} />}
          <p style={{ margin: 0, fontFamily: font, fontSize: 14, lineHeight: 1.6, color: C.textMuted, wordBreak: "break-word", overflowWrap: "break-word" }}>
            <span style={{ color: C.text, fontWeight: 700, marginRight: 6 }}>{post.author}</span>
            {post.content}
          </p>
          {post.hashtags?.length > 0 && <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 13, color: C.accent, wordBreak: "break-word" }}>{post.hashtags.join(" ")}</p>}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <button onClick={() => setShowComments(true)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.textMuted, fontFamily: font, fontSize: 13 }}>
              View all {post.commentCount} comments
            </button>
            <span style={{ color: C.textDim }}>·</span>
            <button onClick={() => onViewUpdate(post.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.teal, fontFamily: font, fontSize: 13, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
              ver update
            </button>
          </div>
        </div>
      </motion.article>
    </>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ onBack, onNavigate }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ width: 230, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>

      <div style={{ padding: "20px 18px 14px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.accentLight, fontFamily: font, fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 18 }}>
          <ChevronLeft size={17} strokeWidth={2.2} /> Back
        </button>
        <p style={{ margin: 0, fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Menu</p>
      </div>

      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        {SIDEBAR_SECTIONS.map(s => {
          const active = s.id === "planning";
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

// ─── Planning (default export) ────────────────────────────────────────────────
export default function Planning({ section, onBack, isHost, onNavigate }) {
  const isDesktop = useIsDesktop();
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [filter, setFilter] = useState("all");
  const [showComposer, setShowComposer] = useState(false);

  const handleStatusChange = (id, newStatus) => setPosts(p => p.map(post => post.id === id ? { ...post, status: newStatus } : post));
  const handleDelete = id => setPosts(p => p.filter(post => post.id !== id));
  const handleNewPost = ({ title, content, privacy, audio }) => {
    setPosts(p => [{
      id: `p_${Date.now()}`, title: title || null, content,
      hashtags: [], media: [], audio: audio || null,
      visibility: privacy, status: "active", pinned: false,
      likes: 0, liked: false, commentCount: 0,
      author: "Alex H.", authorRole: "host", timestamp: "just now",
    }, ...p]);
    setShowComposer(false);
  };
  const handleViewUpdate = useCallback((postId) => {
    if (onNavigate) onNavigate("recaps", postId);
  }, [onNavigate]);

  const filtered = posts.filter(p => {
    if (filter === "pinned") return p.pinned;
    if (filter === "active") return p.status === "active";
    if (filter === "media") return p.media?.length > 0;
    return true;
  });

  const FilterTabs = () => (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
      {[{ id: "all", label: "All" }, { id: "pinned", label: "Pinned" }, { id: "active", label: "Active" }, { id: "media", label: "Media" }].map(f => (
        <button key={f.id} onClick={() => setFilter(f.id)}
          style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, cursor: "pointer", border: `1px solid ${filter === f.id ? C.accent + "60" : C.border}`, background: filter === f.id ? `${C.accent}18` : C.card, color: filter === f.id ? C.accentLight : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}>
          {f.label}
        </button>
      ))}
    </div>
  );

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg }}>
        <Sidebar onBack={onBack} onNavigate={id => onNavigate && onNavigate(id)} />

        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {/* Sticky top bar */}
          <div style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.surface}f2`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <FilterTabs />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isHost ? C.accentLight : C.textMuted, background: isHost ? `${C.accent}18` : C.border + "80", border: `1px solid ${isHost ? C.accent + "30" : C.border}`, borderRadius: 6, padding: "3px 7px" }}>
                {isHost ? "Host" : "Member"}
              </span>
              {isHost && (
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }} onClick={() => setShowComposer(true)}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, border: "none", borderRadius: 12, padding: "9px 18px", cursor: "pointer", color: "#fff", fontFamily: font, fontSize: 13, fontWeight: 700, boxShadow: `0 2px 16px ${C.accent}50` }}>
                  <Plus size={16} strokeWidth={2.5} /> New Post
                </motion.button>
              )}
            </div>
          </div>

          {/* Posts feed */}
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 28px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
            <AnimatePresence>
              {filtered.map((post, i) => (
                <PlanningPost key={post.id} post={post} index={i} isHost={isHost} isDesktop
                  onStatusChange={handleStatusChange} onDelete={handleDelete} onViewUpdate={handleViewUpdate} />
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 0", color: C.textMuted, fontFamily: font, fontSize: 14 }}>No posts in this view</div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showComposer && <PostingBar onSubmit={handleNewPost} onClose={() => setShowComposer(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── MOBILE ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, position: "relative", overflow: "hidden" }}>
      {/* Top bar */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: C.accentLight, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
          <ChevronLeft size={19} strokeWidth={2.2} /> Back
        </button>
        <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
          {section.label}
        </span>
        <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isHost ? C.accentLight : C.textMuted, background: isHost ? `${C.accent}18` : C.border + "80", border: `1px solid ${isHost ? C.accent + "30" : C.border}`, borderRadius: 6, padding: "3px 7px", flexShrink: 0 }}>
          {isHost ? "Host" : "Member"}
        </span>
      </motion.div>

      {/* Filter tabs */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <FilterTabs />
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {filtered.map((post, i) => (
          <div key={post.id} style={{ borderBottom: `1px solid ${C.border}` }}>
            <PlanningPost post={post} index={i} isHost={isHost} isDesktop={false}
              onStatusChange={handleStatusChange} onDelete={handleDelete} onViewUpdate={handleViewUpdate} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: C.textMuted, fontFamily: font, fontSize: 14 }}>No posts in this view</div>
        )}
        <div style={{ height: 96 }} />
      </div>

      {/* FAB */}
      {isHost && (
        <AnimatePresence>
          {!showComposer && (
            <motion.button
              key="fab"
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}
              onClick={() => setShowComposer(true)}
              style={{ position: "fixed", bottom: 28, right: 22, width: 58, height: 58, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 28px ${C.accent}70, 0 0 0 1px ${C.accent}40`, zIndex: 50 }}>
              <Plus size={28} color="#fff" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Composer */}
      <AnimatePresence>
        {showComposer && <PostingBar onSubmit={handleNewPost} onClose={() => setShowComposer(false)} />}
      </AnimatePresence>
    </div>
  );
}
