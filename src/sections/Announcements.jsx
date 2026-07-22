import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InstagramStoryCreator, NewDiffusionSheet } from "../components/Sheets.jsx";
import { useImageViewer, ExpandImageButton } from "../components/GlobalImageViewer.jsx";
import MediaCarousel from "../components/MediaCarousel.jsx";
import {
  ChevronLeft, Plus, X, Heart, MessageCircle, Share2, Bookmark,
  Pin, MoreHorizontal, Trash2, Check, Image, Video, Mic, Square,
  Globe, Users, Lock, Send, ChevronRight, ChevronDown,
  BarChart2, Clock, Eye, EyeOff, CalendarDays, FileText,
  Megaphone, Hash, MessageSquare, Volume2, Play, Pause,
Loader,
} from "lucide-react";
import {
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementLike,
} from "../lib/announcementsApi.js";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", cardHover: "#19192a",
  border: "#1c1c2e",
  accent: "#f59e0b", accentLight: "#fbbf24", accentDim: "#78350f",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  green: "#1ed99a", greenDim: "rgba(30,217,154,0.12)",
  red: "#ff4f6a", amber: "#f59e0b",
  blue: "#4fa3ff", purple: "#7c4dff",
};
const font = "'DM Sans', sans-serif";
const A = "#f59e0b"; // announcements amber accent

// ─── Sidebar sections ──────────────────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  { id: "planning",      label: "Planning",         icon: CalendarDays,  accent: "#7c4dff" },
  { id: "recaps",        label: "Recaps & Updates", icon: FileText,      accent: "#22d3a0" },
  { id: "announcements", label: "Announcements",    icon: Megaphone,     accent: "#f59e0b" },
  { id: "rooms",         label: "Rooms",            icon: Hash,          accent: "#60a5fa" },
  { id: "community",     label: "Community's Chat", icon: MessageSquare, accent: "#e879f9" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useIsDesktop() {
  const [v, setV] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

function useCountdown(targetMs) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [remaining]);
  const s = Math.floor(remaining / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return { remaining, d, h, m, s: sc, done: remaining <= 0 };
}

function fmtTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ name, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${A}44, ${A}22)`, border: `1px solid ${A}40`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: size * 0.38, fontWeight: 700, color: C.text }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const NOW = Date.now();

const MOCK_STORIES = [
  { id: "s1", author: "Alex H.", role: "host",  bg: "linear-gradient(160deg,#f59e0b,#d97706)", text: "New signals dropping this week — stay sharp 🎯", img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80", createdAt: NOW - 2 * 3600000, expiresIn: 24, seen: false },
  { id: "s2", author: "Admin",   role: "admin", bg: "linear-gradient(160deg,#1d4ed8,#7c3aed)", text: "Room schedule updated for this week!", img: null,                    createdAt: NOW - 5 * 3600000, expiresIn: 48, seen: true  },
  { id: "s3", author: "Alex H.", role: "host",  bg: "linear-gradient(160deg,#059669,#0d9488)", text: "XAUUSD just hit our TP. 🏆 +180 pips confirmed", img: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=400&q=80", createdAt: NOW - 8 * 3600000, expiresIn: 36, seen: false },
];

const MOCK_POSTS = [
  {
    id: "a1", type: "standard",
    title: "May Trading Schedule",
    content: "Daily live sessions are now at 8 AM and 2 PM EST. Weekend sessions every Saturday at 10 AM. Mark your calendars and don't miss the pre-market breakdowns.",
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=85" }],
    author: "Alex H.", role: "host", createdAt: NOW - 1 * 3600000,
    pinned: true, status: "vigente", expiresAt: NOW + 7 * 86400000,
    likes: 42, liked: false, commentCount: 8,
  },
  {
    id: "a2", type: "poll",
    title: "What asset are you trading most this week?",
    content: "Vote below — we'll tailor the live room coverage to what the majority is focused on.",
    media: [],
    author: "Admin", role: "admin", createdAt: NOW - 3 * 3600000,
    pinned: false, status: "vigente", expiresAt: NOW + 3 * 86400000,
    likes: 17, liked: false, commentCount: 3,
    poll: {
      options: [
        { id: "o1", label: "XAUUSD (Gold)", votes: 58 },
        { id: "o2", label: "EURUSD",        votes: 31 },
        { id: "o3", label: "NASDAQ (NQ)",   votes: 44 },
        { id: "o4", label: "Oil (WTI)",     votes: 12 },
      ],
      voted: null, totalVotes: 145,
    },
  },
  {
    id: "a3", type: "reveal",
    title: "Upcoming Trade Setup — Classified 🔒",
    content: "A major confluence setup is forming. The photo below will be revealed when the moment is right. Set a reminder.",
    media: [{ type: "image", url: "https://images.unsplash.com/photo-1518183214770-9cffbec72538?w=900&q=85" }],
    author: "Alex H.", role: "host", createdAt: NOW - 30 * 60000,
    pinned: false, status: "vigente", expiresAt: NOW + 14 * 86400000,
    likes: 29, liked: false, commentCount: 5,
    revealAt: NOW + 6 * 3600000, // 6 hours from now
    revealed: false,
  },
  {
    id: "a4", type: "standard",
    title: "Risk Management Reminder",
    content: "Never risk more than 1-2% per trade. The market will always give new opportunities. Capital preservation is the #1 priority for long-term success.",
    media: [],
    author: "Admin", role: "admin", createdAt: NOW - 2 * 86400000,
    pinned: false, status: "caducado", expiresAt: NOW - 86400000,
    likes: 88, liked: true, commentCount: 22,
  },
];

const MOCK_COMMENTS = {
  a1: [
    { id: "c1", author: "Marco V.", text: "Perfect! Will join the 8AM session daily.", likes: 5, liked: false, time: NOW - 30 * 60000 },
    { id: "c2", author: "Sarah K.", text: "Saturday sessions are a great addition 🙌", likes: 3, liked: false, time: NOW - 45 * 60000 },
  ],
  a2: [{ id: "c3", author: "Lena M.", text: "Gold all day baby!", likes: 8, liked: false, time: NOW - 2 * 3600000 }],
  a3: [{ id: "c4", author: "Tom R.", text: "Intrigued! Can't wait to see the setup 👀", likes: 12, liked: false, time: NOW - 20 * 60000 }],
  a4: [{ id: "c5", author: "James P.", text: "This is the most important rule in trading.", likes: 15, liked: true, time: NOW - 2 * 86400000 }],
};

const springTrans = { type: "spring", stiffness: 380, damping: 38, mass: 0.85 };
const slideVariants = {
  enter: d => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: d => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
};

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ onBack, onNavigate }) {
  return (
    <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
      style={{ width: 230, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", position: "sticky", top: 0 }}>
      <div style={{ padding: "20px 18px 14px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: A, fontFamily: font, fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 16 }}>
          <ChevronLeft size={17} strokeWidth={2.2} /> Back
        </button>
        <p style={{ margin: 0, fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Menu</p>
      </div>
      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        {SIDEBAR_SECTIONS.map(s => {
          const active = s.id === "announcements";
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

// ─── Story Viewer (full-screen) ────────────────────────────────────────────────
export function StoryViewer({ stories, startIndex, onClose, isHost }) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [comment, setComment] = useState("");
  const [showCommentBar, setShowCommentBar] = useState(false);
  const closedRef = useRef(false); // guards against double onClose() calls (race between RAF and exit animation)
  const story = stories[idx];
  const DURATION = 5000;

  const closeOnce = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    // story is undefined whenever idx has advanced past the last item —
    // stop immediately instead of letting the RAF loop run against it.
    if (!story) { closeOnce(); return; }
    if (paused) return;
    setProgress(0);
    const start = Date.now();
    const raf = () => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      setProgress(p);
      if (p < 1) requestAnimationFrame(raf);
      else {
        if (idx < stories.length - 1) setIdx(i => i + 1);
        else closeOnce();
      }
    };
    const id = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(id);
  }, [idx, paused, story]); // eslint-disable-line

  const prev = () => { if (idx > 0) setIdx(i => i - 1); };
  const next = () => { if (idx < stories.length - 1) setIdx(i => i + 1); else closeOnce(); };

  // Render nothing during the single frame where story is undefined —
  // AnimatePresence will finish the exit transition via onClose already firing above.
  if (!story) return null;

  const timeSince = fmtTime(story.createdAt);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* Story card */}
      <div style={{ width: "100%", maxWidth: 400, height: "100%", maxHeight: 720, position: "relative", borderRadius: 20, overflow: "hidden" }}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}>

        {/* Background */}
        <div style={{ position: "absolute", inset: 0, background: story.bg }} />
        {story.img && (
          <img src={story.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
        )}
        {/* Dark vignette */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.75) 100%)" }} />

        {/* Progress bars */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 4, zIndex: 10 }}>
          {stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#fff", width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%", transition: i === idx ? "none" : "none" }} />
            </div>
          ))}
        </div>

        {/* Top bar */}
        <div style={{ position: "absolute", top: 28, left: 14, right: 14, display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${A}88,${A}44)`, border: `2px solid ${A}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 14, fontWeight: 700, color: "#fff" }}>
            {story.author[0]}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: "#fff" }}>{story.author}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{timeSince} · {story.expiresIn}h</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <X size={16} />
          </button>
        </div>

        {/* Tap zones */}
        <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 5 }}>
          <div style={{ flex: 1 }} onClick={prev} />
          <div style={{ flex: 1 }} onClick={next} />
        </div>

        {/* Story text */}
        <div style={{ position: "absolute", bottom: showCommentBar ? 80 : 60, left: 16, right: 16, zIndex: 10 }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.4, textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>{story.text}</p>
        </div>

        {/* Comment / Reply bar */}
        <div style={{ position: "absolute", bottom: 16, left: 12, right: 12, zIndex: 10 }}>
          {showCommentBar ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input autoFocus value={comment} onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && comment.trim()) { setComment(""); setShowCommentBar(false); } if (e.key === "Escape") setShowCommentBar(false); }}
                placeholder="Reply…"
                style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 24, padding: "10px 16px", color: "#fff", fontFamily: font, fontSize: 14, outline: "none" }} />
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => { if (comment.trim()) { setComment(""); setShowCommentBar(false); } }}
                style={{ width: 38, height: 38, borderRadius: "50%", background: A, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Send size={16} color="#000" />
              </motion.button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowCommentBar(true)}
                style={{ flex: 1, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 24, padding: "10px 16px", color: "rgba(255,255,255,0.7)", fontFamily: font, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                Reply…
              </button>
              <button style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                <Heart size={18} />
              </button>
              <button style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                <Share2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Story Uploader ────────────────────────────────────────────────────────────
function StoryUploader({ onClose, onPublish, isMobile }) {
  const [text, setText] = useState("");
  const [bg, setBg] = useState("linear-gradient(160deg,#f59e0b,#d97706)");
  const [duration, setDuration] = useState(24);
  const [imgPreview, setImgPreview] = useState(null);
  const fileRef = useRef();

  const GRADIENTS = [
    "linear-gradient(160deg,#f59e0b,#d97706)",
    "linear-gradient(160deg,#7c4dff,#5b21b6)",
    "linear-gradient(160deg,#22d3a0,#0d9488)",
    "linear-gradient(160deg,#ff4f6a,#e11d48)",
    "linear-gradient(160deg,#60a5fa,#1d4ed8)",
    "linear-gradient(160deg,#1e293b,#334155)",
  ];

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImgPreview(url);
  };

  const publish = () => {
    if (!text.trim() && !imgPreview) return;
    onPublish({ text, bg, imgPreview, duration });
  };

  // ── Desktop layout (WhatsApp Web style) ────────────────────────────────────
  if (!isMobile) {
    return (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} />
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: 780, maxHeight: "90vh", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, overflow: "hidden", display: "flex", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}
          onClick={e => e.stopPropagation()}>

          {/* Left: Preview */}
          <div style={{ flex: 1, position: "relative", background: imgPreview ? "#000" : bg, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 500 }}>
            {imgPreview && <img src={imgPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, position: "absolute", inset: 0 }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
            {text && (
              <div style={{ position: "absolute", bottom: 48, left: 20, right: 20, zIndex: 2 }}>
                <p style={{ margin: 0, fontFamily: font, fontSize: 20, fontWeight: 700, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.8)", lineHeight: 1.4, textAlign: "center" }}>{text}</p>
              </div>
            )}
            {!text && !imgPreview && (
              <p style={{ fontFamily: font, fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "0 24px" }}>Your story preview</p>
            )}
            {/* Header bar on preview */}
            <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${A}88`, border: `2px solid ${A}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 12, fontWeight: 700, color: "#fff" }}>A</div>
              <div>
                <p style={{ margin: 0, fontFamily: font, fontSize: 12, fontWeight: 700, color: "#fff" }}>Alex H.</p>
                <p style={{ margin: 0, fontFamily: font, fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Now · {duration}h</p>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div style={{ width: 320, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "20px 20px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>New Story</p>
              <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", display: "flex" }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Text */}
              <div>
                <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Caption</p>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="What's your announcement?"
                  style={{ width: "100%", minHeight: 90, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontFamily: font, fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
              </div>

              {/* Media */}
              <div>
                <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Media</p>
                <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />
                <div style={{ display: "flex", gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.94 }} onClick={() => fileRef.current?.click()}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 12, border: `1px dashed ${A}44`, background: `${A}08`, cursor: "pointer", color: A, fontFamily: font, fontSize: 13, fontWeight: 600 }}>
                    <Image size={16} /> {imgPreview ? "Change" : "Add Photo/Video"}
                  </motion.button>
                  {imgPreview && (
                    <button onClick={() => setImgPreview(null)} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${C.red}33`, background: `${C.red}0a`, cursor: "pointer", color: C.red }}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Background */}
              <div>
                <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Background</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {GRADIENTS.map(g => (
                    <button key={g} onClick={() => setBg(g)}
                      style={{ width: 36, height: 36, borderRadius: 10, background: g, border: `2px solid ${bg === g ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border 0.15s" }} />
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Duration</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[24, 36, 48].map(h => (
                    <button key={h} onClick={() => setDuration(h)}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${duration === h ? A + "60" : C.border}`, background: duration === h ? `${A}18` : C.card, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: duration === h ? A : C.textMuted, transition: "all 0.15s" }}>
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 20px 20px", borderTop: `1px solid ${C.border}` }}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={publish}
                style={{ width: "100%", padding: "13px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${A}, #d97706)`, cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 800, color: "#000", boxShadow: `0 4px 20px ${A}44` }}>
                Publish Story
              </motion.button>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // ── Mobile layout (WhatsApp mobile style) ─────────────────────────────────
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={springTrans}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: imgPreview ? "#000" : bg, display: "flex", flexDirection: "column" }}>

      {/* Media background */}
      {imgPreview && <img src={imgPreview} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 35%, rgba(0,0,0,0.8) 100%)" }} />

      {/* Top bar */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px" }}>
        <button onClick={onClose} style={{ background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><X size={18} /></button>
        <p style={{ margin: 0, fontFamily: font, fontSize: 16, fontWeight: 800, color: "#fff" }}>New Story</p>
        <button onClick={() => fileRef.current?.click()} style={{ background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><Image size={18} /></button>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />
      </div>

      {/* Text input centered */}
      <div style={{ flex: 1, position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Tap to add caption…"
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#fff", fontFamily: font, fontSize: 22, fontWeight: 700, textAlign: "center", textShadow: "0 2px 12px rgba(0,0,0,0.8)", resize: "none", lineHeight: 1.4, caretColor: A }}
          rows={3} />
      </div>

      {/* Bottom toolbar */}
      <div style={{ position: "relative", zIndex: 2, padding: "12px 16px" }}>
        {/* BG swatches */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
          {GRADIENTS.map(g => (
            <button key={g} onClick={() => setBg(g)} style={{ width: 30, height: 30, borderRadius: 8, background: g, border: `2px solid ${bg === g ? "#fff" : "transparent"}`, cursor: "pointer" }} />
          ))}
        </div>

        {/* Duration */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          {[24, 36, 48].map(h => (
            <button key={h} onClick={() => setDuration(h)}
              style={{ padding: "7px 18px", borderRadius: 99, border: `1px solid ${duration === h ? A : "rgba(255,255,255,0.3)"}`, background: duration === h ? A : "rgba(0,0,0,0.35)", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: duration === h ? "#000" : "#fff" }}>
              {h}h
            </button>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.95 }} onClick={publish}
          style={{ width: "100%", padding: "15px", borderRadius: 99, border: "none", background: `linear-gradient(135deg, ${A}, #d97706)`, cursor: "pointer", fontFamily: font, fontSize: 16, fontWeight: 800, color: "#000", boxShadow: `0 4px 24px ${A}55` }}>
          Publish Story →
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── NewsBar (Stories strip) ───────────────────────────────────────────────────
function NewsBar({ stories, onOpen, onAdd, isHost }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 0 4px", overflowX: "auto", scrollbarWidth: "none" }}>
      {/* Add story button */}
      {isHost && (
        <motion.button whileTap={{ scale: 0.92 }} onClick={onAdd}
          style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 72, height: 112, borderRadius: 14, background: C.card, border: `2px dashed ${A}55`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${A}, #d97706)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 12px ${A}55` }}>
              <Plus size={18} color="#000" strokeWidth={2.5} />
            </div>
          </div>
          <span style={{ fontFamily: font, fontSize: 11, color: A, fontWeight: 600, whiteSpace: "nowrap" }}>Add</span>
        </motion.button>
      )}

      {/* Story thumbnails */}
      {stories.map((story, i) => {
        const timeStr = fmtTime(story.createdAt);
        return (
          <motion.button key={story.id} whileTap={{ scale: 0.94 }} onClick={() => onOpen(i)}
            style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0, opacity: story.seen ? 0.65 : 1 }}>
            <div style={{ width: 72, height: 112, borderRadius: 14, background: story.bg, position: "relative", overflow: "hidden", border: `2px solid ${story.seen ? C.border : A}`, boxShadow: story.seen ? "none" : `0 0 12px ${A}44` }}>
              {story.img && <img src={story.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />}
              {/* Role badge */}
              <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: 99, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{story.role}</span>
              </div>
              {/* Unseen ring effect */}
              {!story.seen && (
                <div style={{ position: "absolute", inset: -2, borderRadius: 16, border: `2px solid ${A}`, pointerEvents: "none" }} />
              )}
            </div>
            <span style={{ fontFamily: font, fontSize: 11, color: story.seen ? C.textMuted : C.text, fontWeight: 500, whiteSpace: "nowrap" }}>{timeStr}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Poll Post ─────────────────────────────────────────────────────────────────
function PollPost({ post, onVote }) {
  const total = post.poll.totalVotes;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {post.poll.options.map(opt => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const voted = post.poll.voted === opt.id;
        const hasVoted = post.poll.voted !== null;
        return (
          <motion.button key={opt.id} whileTap={{ scale: 0.98 }} onClick={() => !hasVoted && onVote(post.id, opt.id)}
            style={{ position: "relative", width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${voted ? A + "60" : C.border}`, background: voted ? `${A}14` : C.cardHover, cursor: hasVoted ? "default" : "pointer", overflow: "hidden", textAlign: "left" }}>
            {hasVoted && (
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: voted ? `${A}22` : "rgba(255,255,255,0.04)", transition: "width 0.6s ease", borderRadius: 12 }} />
            )}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {voted && <Check size={13} color={A} strokeWidth={2.5} />}
                <span style={{ fontFamily: font, fontSize: 14, fontWeight: voted ? 700 : 500, color: voted ? A : C.text }}>{opt.label}</span>
              </div>
              {hasVoted && <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: voted ? A : C.textMuted }}>{pct}%</span>}
            </div>
          </motion.button>
        );
      })}
      <p style={{ margin: "4px 0 0", fontFamily: font, fontSize: 12, color: C.textMuted }}>
        {total.toLocaleString()} votes {post.poll.voted ? "" : "· Tap to vote"}
      </p>
    </div>
  );
}

// ─── Reveal Post (blurry countdown) ───────────────────────────────────────────
function RevealPost({ post }) {
  const countdown = useCountdown(post.revealAt);
  const revealed = countdown.done || post.revealed;
  const { openGallery, ViewerPortal } = useImageViewer();

  return (
    <div style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {revealed ? (
        /* ── Revealed: show full carousel with fullscreen support ── */
        <MediaCarousel
          items={post.media}
          onOpenGallery={openGallery}
          accentColor={A}
          square={false}
        />
      ) : (
        /* ── Not yet revealed: single blurred image + countdown overlay ── */
        <div style={{ position: "relative", cursor: "default" }}>
          <img src={post.media[0].url} alt=""
            style={{ width: "100%", display: "block", filter: "blur(18px)", transition: "filter 0.8s ease", aspectRatio: "16/9", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
            <EyeOff size={24} color="rgba(255,255,255,0.7)" strokeWidth={1.8} style={{ marginBottom: 10 }} />
            <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>Reveals in</p>
            <div style={{ display: "flex", gap: 8 }}>
              {countdown.d > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${A}44`, borderRadius: 10, padding: "8px 12px", minWidth: 46 }}>
                    <p style={{ margin: 0, fontFamily: font, fontSize: 22, fontWeight: 800, color: A }}>{countdown.d}</p>
                  </div>
                  <p style={{ margin: "4px 0 0", fontFamily: font, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>DAYS</p>
                </div>
              )}
              {[{ v: countdown.h, l: "HRS" }, { v: countdown.m, l: "MIN" }, { v: countdown.s, l: "SEC" }].map(({ v, l }) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${A}44`, borderRadius: 10, padding: "8px 12px", minWidth: 46 }}>
                    <p style={{ margin: 0, fontFamily: font, fontSize: 22, fontWeight: 800, color: A }}>{String(v).padStart(2, "0")}</p>
                  </div>
                  <p style={{ margin: "4px 0 0", fontFamily: font, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {revealed && (
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 5, background: `${A}dd`, borderRadius: 99, padding: "4px 10px", pointerEvents: "none" }}>
          <Eye size={12} color="#000" strokeWidth={2} />
          <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: "#000" }}>Revealed</span>
        </div>
      )}
      <ViewerPortal />
    </div>
  );
}

// ─── Status (Vigente / Caducado) chip ─────────────────────────────────────────
function StatusChip({ status }) {
  const vigente = status === "vigente";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${vigente ? A + "40" : C.border}`, background: vigente ? `${A}14` : "rgba(255,255,255,0.04)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: vigente ? A : C.textMuted, boxShadow: vigente ? `0 0 6px ${A}` : "none" }} />
      <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: vigente ? A : C.textMuted }}>
        {vigente ? "Vigente" : "Caducado"}
      </span>
    </div>
  );
}

// ─── Comments Sheet ────────────────────────────────────────────────────────────
function CommentsSheet({ postId, onClose }) {
  const [comments, setComments] = useState(MOCK_COMMENTS[postId] || []);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setComments(p => [...p, { id: `c_${Date.now()}`, author: "You", text: text.trim(), likes: 0, liked: false, time: Date.now() }]);
    setText("");
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)" }} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={springTrans}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "24px 24px 0 0", maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>Comments</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {comments.length === 0 && <p style={{ fontFamily: font, fontSize: 14, color: C.textMuted, textAlign: "center", padding: "24px 0" }}>No comments yet</p>}
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <Avatar name={c.author} size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{c.author}</span>
                  <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>{typeof c.time === "number" ? fmtTime(c.time) : c.time}</span>
                </div>
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, color: C.text, lineHeight: 1.5, wordBreak: "break-word" }}>{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, flexShrink: 0 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder="Add a comment…"
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: "10px 16px", color: C.text, fontFamily: font, fontSize: 14, outline: "none" }} />
          <motion.button whileTap={{ scale: 0.88 }} onClick={send}
            style={{ width: 38, height: 38, borderRadius: "50%", background: text.trim() ? `linear-gradient(135deg, ${A}, #d97706)` : C.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: text.trim() ? "pointer" : "default", flexShrink: 0 }}>
            <Send size={16} color={text.trim() ? "#000" : C.textMuted} />
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Post Composer (Telegram-style input bar) ──────────────────────────────────
function PostComposer({ onPublish, onClose }) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [showTray, setShowTray] = useState(false);
  const [mode, setMode] = useState("standard"); // standard | poll | reveal | audio
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [revealDate, setRevealDate] = useState("");
  const [revealTime, setRevealTime] = useState("");
  const [duration, setDuration] = useState("vigente");
  const [imgPreview, setImgPreview] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const fileRef = useRef();
  const timerRef = useRef();

  const startRec = () => { setRecording(true); setRecSecs(0); timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000); };
  const stopRec = () => { setRecording(false); clearInterval(timerRef.current); setMode("audio"); };
  const cancelRec = () => { setRecording(false); clearInterval(timerRef.current); setMode("standard"); };

  const handleFile = e => { const f = e.target.files?.[0]; if (!f) return; setImgPreview(URL.createObjectURL(f)); };

  const addPollOpt = () => setPollOptions(o => [...o, ""]);
  const updatePollOpt = (i, v) => setPollOptions(o => o.map((x, j) => j === i ? v : x));
  const removePollOpt = (i) => setPollOptions(o => o.filter((_, j) => j !== i));

  const publish = () => {
    if (!text.trim() && !title.trim() && !imgPreview) return;
    const revealAt = mode === "reveal" && revealDate ? new Date(`${revealDate}T${revealTime || "12:00"}`).getTime() : null;
    onPublish({
      type: mode === "audio" ? "standard" : mode,
      title: title.trim() || null,
      content: text.trim(),
      imgPreview,
      poll: mode === "poll" ? { options: pollOptions.filter(o => o.trim()).map((o, i) => ({ id: `o${i}`, label: o, votes: 0 })), voted: null, totalVotes: 0 } : null,
      revealAt,
      status: duration,
    });
    onClose();
  };

  const canPublish = text.trim() || title.trim() || imgPreview || (mode === "poll" && pollOptions.some(o => o.trim()));

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)" }} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={springTrans}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "24px 24px 0 0", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: C.border }} />
        </div>

        <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>New Announcement</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "12px 16px", maxHeight: "70vh", overflowY: "auto" }}>
          {/* Mode chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
            {[
              { id: "standard", label: "📝 Post" },
              { id: "poll",     label: "📊 Poll" },
              { id: "reveal",   label: "🔒 Reveal" },
            ].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 99, border: `1px solid ${mode === m.id ? A + "60" : C.border}`, background: mode === m.id ? `${A}18` : C.card, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: mode === m.id ? A : C.textMuted, transition: "all 0.15s" }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Title */}
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)"
            style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", color: C.text, fontFamily: font, fontSize: 14, fontWeight: 700, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />

          {/* Content */}
          {mode !== "poll" && (
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your announcement…" rows={3}
              style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", color: C.text, fontFamily: font, fontSize: 14, resize: "none", outline: "none", lineHeight: 1.6, marginBottom: 10, boxSizing: "border-box" }} />
          )}

          {/* Poll options */}
          {mode === "poll" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input value={opt} onChange={e => updatePollOpt(i, e.target.value)} placeholder={`Option ${i + 1}`}
                    style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontFamily: font, fontSize: 14, outline: "none" }} />
                  {pollOptions.length > 2 && (
                    <button onClick={() => removePollOpt(i)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 10px", cursor: "pointer", color: C.red }}><X size={14} /></button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button onClick={addPollOpt} style={{ padding: "9px", borderRadius: 10, border: `1px dashed ${A}44`, background: "transparent", cursor: "pointer", fontFamily: font, fontSize: 13, color: A, fontWeight: 600 }}>
                  + Add option
                </button>
              )}
            </div>
          )}

          {/* Reveal config */}
          {mode === "reveal" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input type="date" value={revealDate} onChange={e => setRevealDate(e.target.value)}
                style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontFamily: font, fontSize: 14, outline: "none" }} />
              <input type="time" value={revealTime} onChange={e => setRevealTime(e.target.value)}
                style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontFamily: font, fontSize: 14, outline: "none" }} />
            </div>
          )}

          {/* Image preview */}
          {imgPreview && (
            <div style={{ position: "relative", marginBottom: 10, borderRadius: 12, overflow: "hidden" }}>
              <img src={imgPreview} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block", filter: mode === "reveal" ? "blur(12px)" : "none" }} />
              {mode === "reveal" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                    <EyeOff size={14} color={A} />
                    <span style={{ fontFamily: font, fontSize: 12, color: A, fontWeight: 700 }}>Will be blurred</span>
                  </div>
                </div>
              )}
              <button onClick={() => setImgPreview(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><X size={14} /></button>
            </div>
          )}

          {/* Audio recording indicator */}
          {recording && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${C.red}14`, border: `1px solid ${C.red}30`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}` }} />
              <span style={{ fontFamily: font, fontSize: 13, color: C.red, fontWeight: 600, flex: 1 }}>
                {Math.floor(recSecs / 60)}:{(recSecs % 60).toString().padStart(2, "0")}
              </span>
              <button onClick={stopRec} style={{ background: C.red, border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: "#fff", fontFamily: font, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <Square size={11} fill="#fff" /> Stop
              </button>
              <button onClick={cancelRec} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 12 }}>Cancel</button>
            </div>
          )}

          {/* Duration */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <Clock size={13} color={C.textMuted} />
            <span style={{ fontFamily: font, fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Status:</span>
            {["vigente", "caducado"].map(s => (
              <button key={s} onClick={() => setDuration(s)}
                style={{ padding: "5px 12px", borderRadius: 99, border: `1px solid ${duration === s ? A + "50" : C.border}`, background: duration === s ? `${A}14` : "transparent", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: duration === s ? A : C.textMuted, textTransform: "capitalize" }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Telegram-style bottom bar */}
        <div style={{ padding: "10px 14px 24px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, background: C.surface }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />

          <motion.button whileTap={{ scale: 0.88 }} onClick={() => fileRef.current?.click()}
            style={{ width: 38, height: 38, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textMuted, flexShrink: 0 }}>
            <Image size={17} />
          </motion.button>

          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setMode(m => m === "poll" ? "standard" : "poll")}
            style={{ width: 38, height: 38, borderRadius: "50%", background: mode === "poll" ? `${A}18` : C.card, border: `1px solid ${mode === "poll" ? A + "44" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: mode === "poll" ? A : C.textMuted, flexShrink: 0 }}>
            <BarChart2 size={17} />
          </motion.button>

          {!recording ? (
            <motion.button whileTap={{ scale: 0.88 }} onClick={startRec}
              style={{ width: 38, height: 38, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textMuted, flexShrink: 0 }}>
              <Mic size={17} />
            </motion.button>
          ) : null}

          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setMode(m => m === "reveal" ? "standard" : "reveal")}
            style={{ width: 38, height: 38, borderRadius: "50%", background: mode === "reveal" ? `${A}18` : C.card, border: `1px solid ${mode === "reveal" ? A + "44" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: mode === "reveal" ? A : C.textMuted, flexShrink: 0 }}>
            <EyeOff size={17} />
          </motion.button>

          <div style={{ flex: 1 }} />

          <motion.button whileTap={{ scale: 0.9 }} onClick={publish}
            disabled={!canPublish}
            style={{ width: 44, height: 44, borderRadius: "50%", background: canPublish ? `linear-gradient(135deg, ${A}, #d97706)` : C.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: canPublish ? "pointer" : "default", boxShadow: canPublish ? `0 2px 14px ${A}55` : "none", transition: "all 0.2s", flexShrink: 0 }}>
            <Send size={18} color={canPublish ? "#000" : C.textMuted} />
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Announcement Post Card ────────────────────────────────────────────────────
function AnnouncementCard({ post, index, isHost, onVote, onDelete }) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isExpired = post.status === "caducado";
  const { openGallery, ViewerPortal } = useImageViewer();

  const toggleLike = () => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); };

  return (
    <>
      {showComments && <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />}

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)}
              style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401, width: "calc(100% - 48px)", maxWidth: 320, background: "rgba(19,19,31,0.98)", border: `1px solid rgba(255,79,106,0.25)`, borderRadius: 22, overflow: "hidden", boxShadow: "0 8px 60px rgba(0,0,0,0.8)" }}>
              <div style={{ padding: "24px 22px 20px", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${C.red}18`, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <Trash2 size={20} color={C.red} strokeWidth={2} />
                </div>
                <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>Delete announcement?</p>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted }}>This cannot be undone.</p>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => { onDelete(post.id); setShowDeleteConfirm(false); }} style={{ width: "100%", padding: "15px", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 700, color: C.red }}>Delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ width: "100%", padding: "15px", background: "transparent", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 600, color: C.text }}>Cancel</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 + index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: C.card, border: `1px solid ${post.pinned ? A + "40" : isExpired ? C.border : C.border}`, borderRadius: 20, overflow: "hidden", opacity: isExpired ? 0.7 : 1, transition: "opacity 0.2s" }}>

        {/* Pinned bar */}
        {post.pinned && (
          <div style={{ background: `linear-gradient(90deg, ${A}22, transparent)`, borderBottom: `1px solid ${A}20`, padding: "6px 18px", display: "flex", alignItems: "center", gap: 6 }}>
            <Pin size={11} color={A} strokeWidth={2.5} />
            <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>Pinned</span>
          </div>
        )}

        <div style={{ padding: "14px 16px 12px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={post.author} size={36} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>{post.author}</span>
                  <span style={{ fontFamily: font, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: A, background: `${A}18`, border: `1px solid ${A}28`, borderRadius: 4, padding: "1px 5px" }}>{post.role}</span>
                </div>
                <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{fmtTime(post.createdAt)}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusChip status={post.status} />
              {isHost && (
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}><MoreHorizontal size={16} /></button>
                  <AnimatePresence>
                    {showMenu && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setShowMenu(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                          style={{ position: "absolute", right: 0, top: "100%", zIndex: 51, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                          <button onClick={() => { setShowMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: C.text, fontFamily: font, fontSize: 13 }}><Pin size={13} /> Pin</button>
                          <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: C.red, fontFamily: font, fontSize: 13 }}><Trash2 size={13} /> Delete</button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Title + content */}
          {post.title && <h3 style={{ margin: "0 0 6px", fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{post.title}</h3>}
          {post.content && <p style={{ margin: 0, fontFamily: font, fontSize: 14, color: C.text, lineHeight: 1.6, wordBreak: "break-word", overflowWrap: "break-word" }}>{post.content}</p>}

          {/* Standard image(s) */}
          {post.type === "standard" && post.media?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <MediaCarousel
                items={post.media}
                onOpenGallery={openGallery}
                accentColor="#f59e0b"
              />
            </div>
          )}

          {/* Poll */}
          {post.type === "poll" && post.poll && <PollPost post={post} onVote={onVote} />}

          {/* Reveal */}
          {post.type === "reveal" && post.media?.length > 0 && <RevealPost post={post} />}
        </div>

        {/* Actions */}
        <div style={{ borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "10px 14px" }}>
          <motion.button whileTap={{ scale: 0.82 }} onClick={toggleLike}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: liked ? C.red : C.textMuted, padding: "4px 10px 4px 0" }}>
            <Heart size={18} fill={liked ? C.red : "none"} strokeWidth={liked ? 0 : 1.8} style={{ filter: liked ? `drop-shadow(0 0 6px ${C.red}80)` : "none", transition: "all 0.18s" }} />
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600 }}>{likeCount}</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.82 }} onClick={() => setShowComments(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: "4px 10px" }}>
            <MessageCircle size={18} strokeWidth={1.8} />
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600 }}>{post.commentCount}</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.82 }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: "4px 10px" }}>
            <Share2 size={18} strokeWidth={1.8} />
          </motion.button>
          <div style={{ flex: 1 }} />
          <motion.button whileTap={{ scale: 0.82 }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: "4px 0 4px 10px" }}>
            <Bookmark size={18} strokeWidth={1.8} />
          </motion.button>
        </div>
      </motion.article>
      <ViewerPortal />
    </>
  );
}

// ─── Main Announcements Screen ─────────────────────────────────────────────────
export default function Announcements({ section, onBack, isHost, onNavigate, mobileTab, onOpenComposer, onOpenStoryUploader, openComposerSignal, openStorySignal, onShowComposer, onRegisterAnnPublish, onShowStory, onRegisterAnnStory, onShowStoryViewer, onRegisterAnnStories }) {
  const isDesktop = useIsDesktop();
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [stories, setStories] = useState(MOCK_STORIES);
  const [viewingStory, setViewingStory] = useState(null); // index
  const [showUploader, setShowUploader] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  // Open composer or story uploader when signaled from App (Crear Difusión / Crear Story)
  useEffect(() => {
    if (!openComposerSignal) return;
    // On mobile, delegate to App so the sheet renders outside the transform stacking context.
    // On desktop, open locally as before.
    if (onShowComposer) { onShowComposer(); } else { setShowComposer(true); }
  }, [openComposerSignal]);
  useEffect(() => {
    if (!openStorySignal) return;
    if (onShowStory) { onShowStory(); } else { setShowUploader(true); }
  }, [openStorySignal]);

  // Register handlePublishPost with App so mobile NewDiffusionSheet can call it
  useEffect(() => {
    onRegisterAnnPublish?.(handlePublishPost);
    return () => { onRegisterAnnPublish?.(null); };
  // eslint-disable-next-line
  }, [onRegisterAnnPublish]);

  // Register handlePublishStory with App so mobile InstagramStoryCreator can call it
  useEffect(() => {
    onRegisterAnnStory?.(handlePublishStory);
    return () => { onRegisterAnnStory?.(null); };
  // eslint-disable-next-line
  }, [onRegisterAnnStory]);

  // Keep App in sync with the current stories array so the mobile StoryViewer
  // (rendered at App's root to escape the transform stacking context) has data to show.
  useEffect(() => {
    onRegisterAnnStories?.(stories);
  }, [stories]); // eslint-disable-line

  // ── Load announcements from Supabase ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchAnnouncements().then(data => {
      if (!cancelled && data.length > 0) setPosts(data);
      if (!cancelled) setLoadingPosts(false);
    }).catch(() => { if (!cancelled) setLoadingPosts(false); });
    return () => { cancelled = true; };
  }, []);

  const handleVote = (postId, optId) => {
    setPosts(ps => ps.map(p => {
      if (p.id !== postId || !p.poll) return p;
      const poll = { ...p.poll, voted: optId, totalVotes: p.poll.totalVotes + 1, options: p.poll.options.map(o => o.id === optId ? { ...o, votes: o.votes + 1 } : o) };
      return { ...p, poll };
    }));
  };

  const handleDeletePost = async (id) => {
    setPosts(ps => ps.filter(p => p.id !== id));
    await deleteAnnouncement(id);
  };

  const handlePublishStory = (data) => {
    setStories(s => [{ id: `s${Date.now()}`, author: "Alex H.", role: "host", bg: data.bg, text: data.text, img: data.imgPreview, createdAt: Date.now(), expiresIn: data.duration, seen: false }, ...s]);
    setShowUploader(false);
  };

  const handlePublishPost = async (data) => {
    const tempId = `a_temp_${Date.now()}`;
    const tempPost = {
      id: tempId, type: data.type,
      title: data.title, content: data.content,
      media: data.imgPreview ? [{ type: "image", url: data.imgPreview }] : [],
      author: "Alex H.", role: "host", createdAt: Date.now(),
      pinned: false, status: data.status,
      expiresAt: Date.now() + 7 * 86400000,
      likes: 0, liked: false, commentCount: 0,
      poll: data.poll || undefined,
      revealAt: data.revealAt || undefined,
      revealed: false,
    };
    setPosts(ps => [tempPost, ...ps]);
    const saved = await createAnnouncement({ title: data.title, content: data.content, tag: data.type || "Official" });
    if (saved) setPosts(ps => ps.map(p => p.id === tempId ? { ...tempPost, ...saved } : p));
  };

  // ── Feed panel (shared between mobile and desktop) ─────────────────────────
  const FeedPanel = () => (
    <div style={{ flex: 1, overflowY: isDesktop ? "auto" : "visible", padding: "0 0 40px" }}>
      {/* News / Stories bar */}
      <div style={{ padding: "0 16px 4px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 6, paddingBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: A, boxShadow: `0 0 8px ${A}` }} />
          <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: A, textTransform: "uppercase", letterSpacing: "0.1em" }}>News</span>
        </div>
        <NewsBar stories={stories} onOpen={i => onShowStoryViewer ? onShowStoryViewer(i) : setViewingStory(i)} onAdd={() => onShowStory ? onShowStory() : setShowUploader(true)} isHost={isHost} />
      </div>

      {/* Announcement feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 14px" }}>
        {/* Pinned first */}
        {[...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map((post, i) => (
          <AnnouncementCard key={post.id} post={post} index={i} isHost={isHost} onVote={handleVote} onDelete={handleDeletePost} />
        ))}
      </div>
    </div>
  );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: C.surface }}>
        {/* Top bar — hidden when used as tab inside mobile profile */}
        {!mobileTab && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f2`, backdropFilter: "blur(24px)", flexShrink: 0 }}>
            <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: A, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
              <ChevronLeft size={19} strokeWidth={2.2} /> Back
            </button>
            <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 17, fontWeight: 700, textAlign: "center" }}>Announcements</span>
            {isHost && (
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => onShowComposer ? onShowComposer() : setShowComposer(true)}
                style={{ width: 34, height: 34, borderRadius: 10, background: `${A}18`, border: `1px solid ${A}30`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={18} color={A} strokeWidth={2.5} />
              </motion.button>
            )}
          </motion.div>
        )}

        <FeedPanel />

        {/* Story viewer — rendered by App.jsx on mobile to escape transform stacking context */}

        {/* Story uploader — rendered by App.jsx on mobile to escape transform stacking context */}
        {false && <StoryUploader onClose={() => setShowUploader(false)} onPublish={handlePublishStory} isMobile />}

        {/* Post composer — rendered by App.jsx on mobile to escape transform stacking context */}

        {/* Orange FAB rendered from App.jsx to stay fixed regardless of scroll */}
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg }}>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
            <FeedPanel />
          </div>
        </div>
      </div>

      {/* Story viewer */}
      <AnimatePresence>
        {viewingStory !== null && (
          <StoryViewer stories={stories} startIndex={viewingStory} onClose={() => setViewingStory(null)} isHost={isHost} />
        )}
      </AnimatePresence>

      {/* Story uploader */}
      <AnimatePresence>
        {showUploader && <InstagramStoryCreator onClose={() => setShowUploader(false)} onPublish={(data) => { handlePublishStory && handlePublishStory(data); setShowUploader(false); }} />}
        {false && <StoryUploader onClose={() => setShowUploader(false)} onPublish={handlePublishStory} isMobile={false} />}
      </AnimatePresence>

      {/* Post composer */}
      <AnimatePresence>
        {showComposer && <NewDiffusionSheet onClose={() => setShowComposer(false)} onPublish={(data) => { handlePublishPost && handlePublishPost({ type: data.postType, content: data.text, imgPreview: data.mediaFiles?.[0]?.url || null, status: data.status }); setShowComposer(false); }} />}
      </AnimatePresence>
    </div>
  );
}
