/**
 * HomeFeed.jsx — PlanSpace main feed (Instagram-style landing page)
 * Static content. Universal purple FAB for hosts.
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NewDiffusionSheet, InstagramStoryCreator } from "./components/Sheets.jsx";
import { Search, MessageSquare, Bell, Heart, MessageCircle, Bookmark,
         MoreHorizontal, X, FileText, Megaphone, Zap, Plus, Mic, Image, Send, ChevronLeft } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", border: "#1c1c2e",
  text: "#eaeaf5", textMuted: "#6a6a82", accent: "#7c4dff", accentLight: "#9d71ff",
  accentDim: "#3d2480", green: "#1ed99a", gold: "#d4a843", red: "#ff4f6a",
  blue: "#4fa3ff", orange: "#f97316",
};

// ── Mock data ──────────────────────────────────────────────────────────────────
const STORIES = [
  { id: 1, name: "You",       initials: "Y",  color: "#7c4dff", isOwn: true,  hasNew: false },
  { id: 2, name: "Alex H.",   initials: "AH", color: "#f97316", isOwn: false, hasNew: true  },
  { id: 3, name: "Marco V.",  initials: "MV", color: "#22d3a0", isOwn: false, hasNew: true  },
  { id: 4, name: "Sarah K.",  initials: "SK", color: "#4fa3ff", isOwn: false, hasNew: true  },
  { id: 5, name: "Lena M.",   initials: "LM", color: "#e879f9", isOwn: false, hasNew: false },
  { id: 6, name: "Tom R.",    initials: "TR", color: "#d4a843", isOwn: false, hasNew: true  },
  { id: 7, name: "James P.",  initials: "JP", color: "#ff4f6a", isOwn: false, hasNew: false },
  { id: 8, name: "Diana L.",  initials: "DL", color: "#34d399", isOwn: false, hasNew: true  },
];

const POSTS = [
  { id: 1, user: { name: "Alex Herrera", handle: "alexherrera.trades", initials: "AH", color: "#f97316", verified: true },
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
    caption: "Major confluence zones aligning across DXY and XAUUSD. Expecting a corrective move before continuation. 📊",
    tags: ["#XAUUSD", "#DXY", "#Trading"], likes: 284, comments: 42, time: "2h", liked: false, saved: false },
  { id: 2, user: { name: "Marco V.", handle: "marcov.trader", initials: "MV", color: "#22d3a0", verified: false },
    image: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&q=80",
    caption: "EURUSD holding the weekly support beautifully. Bias is still bullish above 1.0820. 🎯",
    tags: ["#EURUSD", "#Forex", "#Analysis"], likes: 156, comments: 18, time: "4h", liked: true, saved: false },
  { id: 3, user: { name: "Sarah K.", handle: "sarahk.fx", initials: "SK", color: "#4fa3ff", verified: false },
    image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80",
    caption: "Weekend recap is live! 5 setups reviewed, 4 winners. Consistency > perfection 💪",
    tags: ["#WeeklyRecap", "#TradingJournal"], likes: 312, comments: 57, time: "6h", liked: false, saved: true },
  { id: 4, user: { name: "Alex Herrera", handle: "alexherrera.trades", initials: "AH", color: "#f97316", verified: true },
    image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    caption: "NQ tapping into a premium array. Watching for a displacement + BOS to confirm the short. 🧠",
    tags: ["#NQ", "#ICT", "#SmartMoney"], likes: 891, comments: 134, time: "1d", liked: false, saved: false },
];

// ── StoryViewer ────────────────────────────────────────────────────────────────
function StoryViewer({ story, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, height: 2, background: "rgba(255,255,255,0.2)", borderRadius: 1 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 4, ease: "linear" }}
          onAnimationComplete={onClose} style={{ height: "100%", background: "#fff", borderRadius: 1 }} />
      </div>
      <div style={{ position: "absolute", top: 24, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${story.color}, ${story.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.4)" }}>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: "#fff" }}>{story.initials}</span>
          </div>
          <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: "#fff" }}>{story.name}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={22} color="#fff" /></button>
      </div>
      <div style={{ width: "100%", maxWidth: 400, aspectRatio: "9/16", background: `linear-gradient(135deg, ${story.color}22, ${story.color}11)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${story.color}, ${story.color}66)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span style={{ fontFamily: font, fontSize: 32, fontWeight: 800, color: "#fff" }}>{story.initials}</span>
          </div>
          <p style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>{story.name}</p>
          <p style={{ fontFamily: font, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>has a new story</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── PostCard ───────────────────────────────────────────────────────────────────
function PostCard({ post, onProfileClick }) {
  const [liked, setLiked]   = useState(post.liked);
  const [saved, setSaved]   = useState(post.saved);
  const [likes, setLikes]   = useState(post.likes);
  const [showCmts, setShowCmts] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const lastTap = useRef(0);

  const handleLike = () => { setLiked(v => !v); setLikes(n => liked ? n - 1 : n + 1); };
  const handleDbl  = () => { const now = Date.now(); if (now - lastTap.current < 350) handleLike(); lastTap.current = now; };
  const submitCmt  = () => { if (!comment.trim()) return; setComments(c => [...c, { id: Date.now(), author: "You", text: comment.trim() }]); setComment(""); };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
        <motion.div whileTap={{ scale: 0.92 }} onClick={() => onProfileClick(post.user)}
          style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${post.user.color}, ${post.user.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: `2px solid ${post.user.color}55` }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: "#fff" }}>{post.user.initials}</span>
        </motion.div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, cursor: "pointer" }} onClick={() => onProfileClick(post.user)}>{post.user.name}</span>
            {post.user.verified && <div style={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 8, color: "#fff" }}>✓</span></div>}
          </div>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>@{post.user.handle}</span>
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><MoreHorizontal size={18} /></button>
      </div>
      <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: C.surface }} onClick={handleDbl}>
        <img src={post.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
      </div>
      <div style={{ padding: "10px 14px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 14, flex: 1 }}>
            <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Heart size={22} color={liked ? C.red : C.text} fill={liked ? C.red : "none"} strokeWidth={2} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowCmts(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <MessageCircle size={22} color={C.text} strokeWidth={2} />
            </motion.button>
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setSaved(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Bookmark size={22} color={saved ? C.accentLight : C.text} fill={saved ? C.accentLight : "none"} strokeWidth={2} />
          </motion.button>
        </div>
        <p style={{ margin: "0 0 5px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{likes.toLocaleString()} likes</p>
        <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>{post.user.name.split(" ")[0]}</span>{" "}{post.caption}
        </p>
        <p style={{ margin: "0 0 5px", fontFamily: font, fontSize: 12, color: C.accentLight }}>{post.tags.join(" ")}</p>
        {!showCmts && <button onClick={() => setShowCmts(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>View all {post.comments} comments</button>}
        <AnimatePresence>
          {showCmts && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
              {comments.map(c => <p key={c.id} style={{ margin: "4px 0", fontFamily: font, fontSize: 12, color: C.text }}><span style={{ fontWeight: 700 }}>{c.author}</span> {c.text}</p>)}
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === "Enter" && submitCmt()} placeholder="Add a comment…"
                  style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, outline: "none", color: C.text, fontFamily: font, fontSize: 12, padding: "4px 0" }} />
                {comment.trim() && <button onClick={submitCmt} style={{ background: "none", border: "none", cursor: "pointer", color: C.accentLight, fontFamily: font, fontSize: 12, fontWeight: 700 }}>Post</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 10, color: C.textMuted }}>{post.time} ago</p>
      </div>
    </motion.div>
  );
}

// ── Suggested card ─────────────────────────────────────────────────────────────
function SuggestedCard({ user }) {
  const [following, setFollowing] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 10px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, minWidth: 110, flexShrink: 0 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${user.color}, ${user.color}66)`, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${user.color}44` }}>
        <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: "#fff" }}>{user.initials}</span>
      </div>
      <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.text, textAlign: "center", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
      <motion.button whileTap={{ scale: 0.92 }} onClick={() => setFollowing(v => !v)}
        style={{ padding: "4px 14px", borderRadius: 99, border: `1px solid ${following ? C.border : C.accent + "55"}`, background: following ? "transparent" : `${C.accent}18`, cursor: "pointer", fontFamily: font, fontSize: 11, fontWeight: 700, color: following ? C.textMuted : C.accentLight }}>
        {following ? "Following" : "Follow"}
      </motion.button>
    </div>
  );
}

// ── Main HomeFeed ──────────────────────────────────────────────────────────────
export default function HomeFeed({ onEnterProfile }) {
  const [activeStory,  setActiveStory]  = useState(null);
  const [notifications]                 = useState(3);
  const [messages]                      = useState(2);
  const [fabOpen,      setFabOpen]      = useState(false);
  const [showNewPost,  setShowNewPost]  = useState(false);
  const [showDiffusion,setShowDiffusion]= useState(false);
  const [showStory,    setShowStory]    = useState(false);

  const SUGGESTED = STORIES.slice(2, 6);

  return (
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* ── TopBar ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: `${C.surface}f8`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "0 16px", display: "flex", alignItems: "center", minHeight: 52, flexShrink: 0 }}>
          {/* Left: user avatar → enter profile */}
          <motion.div whileTap={{ scale: 0.9 }} onClick={() => onEnterProfile && onEnterProfile()}
            style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: `2px solid ${C.accent}44` }}>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 800, color: "#fff" }}>Y</span>
          </motion.div>
          {/* Center: PlanSpace wordmark */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <span style={{ fontFamily: font, fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>
              Plan<span style={{ color: C.accentLight }}>Space</span>
            </span>
          </div>
          {/* Right: icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <motion.button whileTap={{ scale: 0.88 }} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <Search size={22} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <MessageSquare size={22} />
              {messages > 0 && <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: C.accent, border: `1.5px solid ${C.surface}` }} />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <Bell size={22} />
              {notifications > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 99, background: C.red, border: `1.5px solid ${C.surface}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  <span style={{ fontFamily: font, fontSize: 8, fontWeight: 800, color: "#fff" }}>{notifications}</span>
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* ── Stories ── */}
        <div style={{ display: "flex", gap: 12, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {STORIES.map(s => (
            <motion.div key={s.id} whileTap={{ scale: 0.92 }}
              onClick={() => s.isOwn ? onEnterProfile && onEnterProfile() : setActiveStory(s)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", padding: s.hasNew ? 2 : 0, background: s.hasNew ? `conic-gradient(${s.color} 0deg, ${s.color}88 180deg, ${s.color} 360deg)` : C.border }}>
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `2px solid ${C.surface}`, background: s.isOwn ? `linear-gradient(135deg, ${C.accent}44, ${C.accentDim})` : `linear-gradient(135deg, ${s.color}44, ${s.color}22)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.isOwn
                    ? <span style={{ fontFamily: font, fontSize: 22, color: C.accentLight }}>+</span>
                    : <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.initials}</span>}
                </div>
              </div>
              <span style={{ fontFamily: font, fontSize: 10, color: s.hasNew ? C.text : C.textMuted, fontWeight: s.hasNew ? 700 : 400, maxWidth: 58, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.isOwn ? "Your story" : s.name.split(" ")[0]}
              </span>
            </motion.div>
          ))}
        </div>

        {/* ── Feed ── */}
        <div style={{ flex: 1 }}>
          {POSTS.map((post, i) => (
            <div key={post.id}>
              <PostCard post={post} onProfileClick={() => onEnterProfile && onEnterProfile()} />
              {i === 1 && (
                <div style={{ padding: "14px 0 14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, paddingRight: 16 }}>Suggested for you</p>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingRight: 16 }}>
                    {SUGGESTED.map(u => <SuggestedCard key={u.id} user={u} />)}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* ── Story Viewer ── */}
      <AnimatePresence>
        {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />}
      </AnimatePresence>

      {/* ── Universal FAB (purple) ── */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setFabOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(8,8,14,0.55)", backdropFilter: "blur(6px)" }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {fabOpen && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ position: "fixed", bottom: 100, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            {[
              { label: "Crear Post",     emoji: "📝", action: () => { setFabOpen(false); setShowNewPost(true); } },
              { label: "Crear Difusión", emoji: "📣", action: () => setFabOpen(false) },
              { label: "Crear Story",    emoji: "⚡", action: () => setFabOpen(false) },
            ].map((opt, i) => (
              <motion.div key={opt.label} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.05 }}
                style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span onClick={opt.action} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", cursor: "pointer" }}>
                  {opt.emoji} {opt.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }} onClick={() => setFabOpen(v => !v)}
        style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: fabOpen ? "linear-gradient(135deg, #1a1a2e, #2d2d4a)" : "linear-gradient(135deg, #7c4dff, #5c2fff)", boxShadow: fabOpen ? "0 4px 20px rgba(0,0,0,0.5)" : "0 6px 28px rgba(124,77,255,0.7)" }}>
        <motion.span animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
          style={{ fontSize: 28, color: "#fff", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</motion.span>
      </motion.button>

      {/* New Post sheet */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8,8,14,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={e => e.target === e.currentTarget && setShowNewPost(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{ width: "100%", maxWidth: 480, background: C.card, borderRadius: "22px 22px 0 0", border: `1px solid ${C.border}`, borderBottom: "none", padding: "20px 20px 40px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 18px" }} />
              <p style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14 }}>📝 Crear Post</p>
              <textarea rows={5} placeholder="¿Qué quieres compartir?"
                style={{ width: "100%", boxSizing: "border-box", resize: "none", background: C.surface, border: `1.5px solid ${C.accent}44`, borderRadius: 14, padding: "13px 16px", color: C.text, fontFamily: font, fontSize: 15, lineHeight: 1.6, outline: "none", marginBottom: 14, caretColor: C.accentLight }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowNewPost(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 14, fontWeight: 600 }}>Cancelar</button>
                <button onClick={() => setShowNewPost(false)}
                  style={{ flex: 2, height: 44, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 800, background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: "#fff" }}>Publicar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}      {/* ── Universal FAB — identical to workspace ── */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setFabOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(8,8,14,0.55)", backdropFilter: "blur(6px)" }} />
        )}
      </AnimatePresence>
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
              { label: "Crear Post",     icon: FileText,  color: "#7c4dff", action: () => { setFabOpen(false); setShowNewPost(true);   } },
              { label: "Crear Difusión", icon: Megaphone, color: "#f97316", action: () => { setFabOpen(false); setShowDiffusion(true); } },
              { label: "Crear Story",    icon: Zap,       color: "#d4a843", action: () => { setFabOpen(false); setShowStory(true);     } },
            ].map((opt, i) => (
              <motion.div key={opt.label}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.05 }}
                style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span onClick={opt.action}
                  style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: "#eaeaf5", background: "#13131f", border: "1px solid #1c1c2e", borderRadius: 12, padding: "8px 14px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", cursor: "pointer" }}>
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
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}
        onClick={() => setFabOpen(v => !v)}
        style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: fabOpen ? "linear-gradient(135deg,#1a1a2e,#2d2d4a)" : "linear-gradient(135deg,#7c4dff,#5c2fff)", boxShadow: fabOpen ? "0 4px 20px rgba(0,0,0,0.5)" : "0 6px 28px rgba(124,77,255,0.7), 0 0 0 1px rgba(124,77,255,0.3)" }}>
        <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={26} color="#fff" strokeWidth={2.5} />
        </motion.div>
      </motion.button>

      {/* New Post sheet */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8,8,14,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={e => e.target === e.currentTarget && setShowNewPost(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{ width: "100%", maxWidth: 480, background: "#13131f", borderRadius: "22px 22px 0 0", border: "1px solid #1c1c2e", borderBottom: "none", padding: "20px 20px 40px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#1c1c2e", margin: "0 auto 16px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(124,77,255,0.2)", border: "1px solid rgba(124,77,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FileText size={14} color="#9d71ff" />
                </div>
                <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: "#eaeaf5" }}>Crear Post</span>
                <button onClick={() => setShowNewPost(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6a6a82", fontSize: 20 }}>×</button>
              </div>
              <textarea rows={5} placeholder="¿Qué quieres compartir?"
                style={{ width: "100%", boxSizing: "border-box", resize: "none", background: "#0e0e18", border: "1.5px solid rgba(124,77,255,0.4)", borderRadius: 14, padding: "13px 16px", color: "#eaeaf5", fontFamily: font, fontSize: 15, lineHeight: 1.6, outline: "none", marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowNewPost(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #1c1c2e", background: "transparent", cursor: "pointer", color: "#6a6a82", fontFamily: font, fontSize: 14, fontWeight: 600 }}>Cancelar</button>
                <button onClick={() => setShowNewPost(false)} style={{ flex: 2, height: 44, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 800, background: "linear-gradient(135deg,#7c4dff,#5c2fff)", color: "#fff" }}>Publicar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Difusión */}
      <AnimatePresence>
        {showDiffusion && (
          <NewDiffusionSheet
            onClose={() => setShowDiffusion(false)}
            onPublish={() => setShowDiffusion(false)}
          />
        )}
      </AnimatePresence>

      {/* Story */}
      <AnimatePresence>
        {showStory && (
          <InstagramStoryCreator
            onClose={() => setShowStory(false)}
            onPublish={() => setShowStory(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main HomeFeed ──────────────────────────────────────────────────────────────
export default function HomeFeed({ onEnterProfile }) {
  const [activeStory,  setActiveStory]  = useState(null);
  const [notifications]                 = useState(3);
  const [messages]                      = useState(2);
  const [fabOpen,      setFabOpen]      = useState(false);
  const [showNewPost,  setShowNewPost]  = useState(false);
  const [showDiffusion,setShowDiffusion]= useState(false);
  const [showStory,    setShowStory]    = useState(false);

  const SUGGESTED = STORIES.slice(2, 6);

  return (
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* ── TopBar ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: `${C.surface}f8`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "0 16px", display: "flex", alignItems: "center", minHeight: 52, flexShrink: 0 }}>
          {/* Left: user avatar → enter profile */}
          <motion.div whileTap={{ scale: 0.9 }} onClick={() => onEnterProfile && onEnterProfile()}
            style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: `2px solid ${C.accent}44` }}>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 800, color: "#fff" }}>Y</span>
          </motion.div>
          {/* Center: PlanSpace wordmark */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <span style={{ fontFamily: font, fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>
              Plan<span style={{ color: C.accentLight }}>Space</span>
            </span>
          </div>
          {/* Right: icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <motion.button whileTap={{ scale: 0.88 }} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <Search size={22} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <MessageSquare size={22} />
              {messages > 0 && <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: C.accent, border: `1.5px solid ${C.surface}` }} />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <Bell size={22} />
              {notifications > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 99, background: C.red, border: `1.5px solid ${C.surface}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  <span style={{ fontFamily: font, fontSize: 8, fontWeight: 800, color: "#fff" }}>{notifications}</span>
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* ── Stories ── */}
        <div style={{ display: "flex", gap: 12, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {STORIES.map(s => (
            <motion.div key={s.id} whileTap={{ scale: 0.92 }}
              onClick={() => s.isOwn ? onEnterProfile && onEnterProfile() : setActiveStory(s)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", padding: s.hasNew ? 2 : 0, background: s.hasNew ? `conic-gradient(${s.color} 0deg, ${s.color}88 180deg, ${s.color} 360deg)` : C.border }}>
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `2px solid ${C.surface}`, background: s.isOwn ? `linear-gradient(135deg, ${C.accent}44, ${C.accentDim})` : `linear-gradient(135deg, ${s.color}44, ${s.color}22)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.isOwn
                    ? <span style={{ fontFamily: font, fontSize: 22, color: C.accentLight }}>+</span>
                    : <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.initials}</span>}
                </div>
              </div>
              <span style={{ fontFamily: font, fontSize: 10, color: s.hasNew ? C.text : C.textMuted, fontWeight: s.hasNew ? 700 : 400, maxWidth: 58, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.isOwn ? "Your story" : s.name.split(" ")[0]}
              </span>
            </motion.div>
          ))}
        </div>

        {/* ── Feed ── */}
        <div style={{ flex: 1 }}>
          {POSTS.map((post, i) => (
            <div key={post.id}>
              <PostCard post={post} onProfileClick={() => onEnterProfile && onEnterProfile()} />
              {i === 1 && (
                <div style={{ padding: "14px 0 14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, paddingRight: 16 }}>Suggested for you</p>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingRight: 16 }}>
                    {SUGGESTED.map(u => <SuggestedCard key={u.id} user={u} />)}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* ── Story Viewer ── */}
      <AnimatePresence>
        {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />}
      </AnimatePresence>

      {/* ── Universal FAB (purple) ── */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setFabOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(8,8,14,0.55)", backdropFilter: "blur(6px)" }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {fabOpen && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ position: "fixed", bottom: 100, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            {[
              { label: "Crear Post",     emoji: "📝", action: () => { setFabOpen(false); setShowNewPost(true); } },
              { label: "Crear Difusión", emoji: "📣", action: () => setFabOpen(false) },
              { label: "Crear Story",    emoji: "⚡", action: () => setFabOpen(false) },
            ].map((opt, i) => (
              <motion.div key={opt.label} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.05 }}
                style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span onClick={opt.action} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", cursor: "pointer" }}>
                  {opt.emoji} {opt.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }} onClick={() => setFabOpen(v => !v)}
        style={{ position: "fixed", bottom: 28, right: 20, width: 58, height: 58, borderRadius: "50%", zIndex: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: fabOpen ? "linear-gradient(135deg, #1a1a2e, #2d2d4a)" : "linear-gradient(135deg, #7c4dff, #5c2fff)", boxShadow: fabOpen ? "0 4px 20px rgba(0,0,0,0.5)" : "0 6px 28px rgba(124,77,255,0.7)" }}>
        <motion.span animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
          style={{ fontSize: 28, color: "#fff", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</motion.span>
      </motion.button>

      {/* New Post sheet */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8,8,14,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={e => e.target === e.currentTarget && setShowNewPost(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{ width: "100%", maxWidth: 480, background: C.card, borderRadius: "22px 22px 0 0", border: `1px solid ${C.border}`, borderBottom: "none", padding: "20px 20px 40px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 18px" }} />
              <p style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14 }}>📝 Crear Post</p>
              <textarea rows={5} placeholder="¿Qué quieres compartir?"
                style={{ width: "100%", boxSizing: "border-box", resize: "none", background: C.surface, border: `1.5px solid ${C.accent}44`, borderRadius: 14, padding: "13px 16px", color: C.text, fontFamily: font, fontSize: 15, lineHeight: 1.6, outline: "none", marginBottom: 14, caretColor: C.accentLight }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowNewPost(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 14, fontWeight: 600 }}>Cancelar</button>
                <button onClick={() => setShowNewPost(false)}
                  style={{ flex: 2, height: 44, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 800, background: `linear-gradient(135deg, ${C.accent}, #5c2fff)`, color: "#fff" }}>Publicar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
