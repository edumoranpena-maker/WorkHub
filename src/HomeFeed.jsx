/**
 * HomeFeed.jsx
 * Main landing page — Instagram-style social feed.
 * Static content (no AI personalization). Entry point before entering a profile workspace.
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageSquare, Bell, Heart, MessageCircle, Bookmark, MoreHorizontal, X, Play } from "lucide-react";

const font = "'DM Sans', sans-serif";

const C = {
  bg:          "#08080e",
  surface:     "#0e0e18",
  card:        "#13131f",
  border:      "#1c1c2e",
  text:        "#eaeaf5",
  textMuted:   "#6a6a82",
  textDim:     "#32324a",
  accent:      "#7c4dff",
  accentLight: "#9d71ff",
  green:       "#1ed99a",
  gold:        "#d4a843",
  red:         "#ff4f6a",
  blue:        "#4fa3ff",
  orange:      "#f97316",
};

// ─── Mock stories ─────────────────────────────────────────────────────────────
const STORIES = [
  { id: 1, name: "You",        initials: "Y",  color: "#7c4dff", isOwn: true,  hasNew: false },
  { id: 2, name: "Alex H.",    initials: "AH", color: "#f97316", isOwn: false, hasNew: true  },
  { id: 3, name: "Marco V.",   initials: "MV", color: "#22d3a0", isOwn: false, hasNew: true  },
  { id: 4, name: "Sarah K.",   initials: "SK", color: "#4fa3ff", isOwn: false, hasNew: true  },
  { id: 5, name: "Lena M.",    initials: "LM", color: "#e879f9", isOwn: false, hasNew: false },
  { id: 6, name: "Tom R.",     initials: "TR", color: "#d4a843", isOwn: false, hasNew: true  },
  { id: 7, name: "James P.",   initials: "JP", color: "#ff4f6a", isOwn: false, hasNew: false },
  { id: 8, name: "Diana L.",   initials: "DL", color: "#34d399", isOwn: false, hasNew: true  },
];

// ─── Mock posts ───────────────────────────────────────────────────────────────
const POSTS = [
  {
    id: 1,
    user:     { name: "Alex Herrera", handle: "alexherrera.trades", initials: "AH", color: "#f97316", verified: true },
    image:    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
    caption:  "Major confluence zones aligning across DXY and XAUUSD. Expecting a corrective move before continuation. 📊",
    tags:     ["#XAUUSD", "#DXY", "#Trading"],
    likes:    284,
    comments: 42,
    time:     "2h",
    liked:    false,
    saved:    false,
  },
  {
    id: 2,
    user:     { name: "Marco V.", handle: "marcov.trader", initials: "MV", color: "#22d3a0", verified: false },
    image:    "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&q=80",
    caption:  "EURUSD holding the weekly support beautifully. Bias is still bullish above 1.0820. 🎯",
    tags:     ["#EURUSD", "#Forex", "#Analysis"],
    likes:    156,
    comments: 18,
    time:     "4h",
    liked:    true,
    saved:    false,
  },
  {
    id: 3,
    user:     { name: "Sarah K.", handle: "sarahk.fx", initials: "SK", color: "#4fa3ff", verified: false },
    image:    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80",
    caption:  "Weekend recap is live! 5 setups reviewed, 4 winners. Consistency > perfection 💪",
    tags:     ["#WeeklyRecap", "#TradingJournal"],
    likes:    312,
    comments: 57,
    time:     "6h",
    liked:    false,
    saved:    true,
  },
  {
    id: 4,
    user:     { name: "Alex Herrera", handle: "alexherrera.trades", initials: "AH", color: "#f97316", verified: true },
    image:    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    caption:  "NQ tapping into a premium array. Watching for a displacement + BOS to confirm the short. 🧠",
    tags:     ["#NQ", "#ICT", "#SmartMoney"],
    likes:    891,
    comments: 134,
    time:     "1d",
    liked:    false,
    saved:    false,
  },
];

// ─── Story Viewer ─────────────────────────────────────────────────────────────
function StoryViewer({ story, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Progress bar */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, height: 2, background: "rgba(255,255,255,0.2)", borderRadius: 1 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 4, ease: "linear" }}
          onAnimationComplete={onClose}
          style={{ height: "100%", background: "#fff", borderRadius: 1 }} />
      </div>
      {/* Header */}
      <div style={{ position: "absolute", top: 24, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${story.color}, ${story.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.4)" }}>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: "#fff" }}>{story.initials}</span>
          </div>
          <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: "#fff" }}>{story.name}</span>
          <span style={{ fontFamily: font, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>2h</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <X size={22} color="#fff" />
        </button>
      </div>
      {/* Content */}
      <div style={{ width: "100%", maxWidth: 400, aspectRatio: "9/16", background: `linear-gradient(135deg, ${story.color}22, ${story.color}11)`, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, onProfileClick }) {
  const [liked,   setLiked]   = useState(post.liked);
  const [saved,   setSaved]   = useState(post.saved);
  const [likes,   setLikes]   = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const lastTap = useRef(0);

  const handleLike = () => {
    setLiked(v => !v);
    setLikes(n => liked ? n - 1 : n + 1);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) handleLike();
    lastTap.current = now;
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    setComments(c => [...c, { id: Date.now(), author: "You", text: comment.trim() }]);
    setComment("");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
        <motion.div whileTap={{ scale: 0.92 }} onClick={() => onProfileClick(post.user)}
          style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${post.user.color}, ${post.user.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: `2px solid ${post.user.color}55` }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: "#fff" }}>{post.user.initials}</span>
        </motion.div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, cursor: "pointer" }} onClick={() => onProfileClick(post.user)}>
              {post.user.name}
            </span>
            {post.user.verified && (
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 8, color: "#fff" }}>✓</span>
              </div>
            )}
          </div>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>@{post.user.handle}</span>
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Image */}
      <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: C.surface, position: "relative" }}
        onClick={handleDoubleTap}>
        <img src={post.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy" />
        <AnimatePresence>
          {liked && (
            <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.4, 1], opacity: [1, 1, 0] }}
              transition={{ duration: 0.6 }}
              style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <Heart size={72} color="#fff" fill="#fff" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 14px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 14, flex: 1 }}>
            <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5 }}>
              <Heart size={22} color={liked ? C.red : C.text} fill={liked ? C.red : "none"} strokeWidth={2} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowComments(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <MessageCircle size={22} color={C.text} strokeWidth={2} />
            </motion.button>
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setSaved(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Bookmark size={22} color={saved ? C.accentLight : C.text} fill={saved ? C.accentLight : "none"} strokeWidth={2} />
          </motion.button>
        </div>

        {/* Likes */}
        <p style={{ margin: "0 0 5px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>
          {likes.toLocaleString()} likes
        </p>

        {/* Caption */}
        <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>{post.user.name.split(" ")[0]}</span>{" "}
          {post.caption}
        </p>
        <p style={{ margin: "0 0 5px", fontFamily: font, fontSize: 12, color: C.accentLight }}>
          {post.tags.join(" ")}
        </p>

        {/* Comments preview */}
        {post.comments > 0 && !showComments && (
          <button onClick={() => setShowComments(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font, fontSize: 12, color: C.textMuted }}>
            View all {post.comments} comments
          </button>
        )}

        <AnimatePresence>
          {showComments && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}>
              {comments.map(c => (
                <p key={c.id} style={{ margin: "4px 0", fontFamily: font, fontSize: 12, color: C.text }}>
                  <span style={{ fontWeight: 700 }}>{c.author}</span> {c.text}
                </p>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <input value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitComment()}
                  placeholder="Add a comment…"
                  style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, outline: "none", color: C.text, fontFamily: font, fontSize: 12, padding: "4px 0" }} />
                {comment.trim() && (
                  <button onClick={submitComment} style={{ background: "none", border: "none", cursor: "pointer", color: C.accentLight, fontFamily: font, fontSize: 12, fontWeight: 700 }}>Post</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 10, color: C.textDim ?? C.textMuted }}>{post.time} ago</p>
      </div>
    </motion.div>
  );
}

// ─── Suggested creator card ───────────────────────────────────────────────────
function SuggestedCard({ user, onVisit }) {
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

// ─── Main HomeFeed ────────────────────────────────────────────────────────────
export default function HomeFeed({ onEnterProfile }) {
  const [activeStory,  setActiveStory]  = useState(null);
  const [notifications, setNotifications] = useState(3);
  const [messages,     setMessages]     = useState(2);

  const SUGGESTED = STORIES.slice(2, 6).map(s => ({ ...s, followers: Math.floor(Math.random() * 9000 + 500) }));

  return (
    <div style={{ height: "100vh", width: "100vw", background: C.bg, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* ── Top Bar ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: `${C.surface}f8`, backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "0 16px", display: "flex", alignItems: "center", minHeight: 52, flexShrink: 0 }}>
          {/* Left: user avatar → go to own profile/workspace */}
          <motion.div whileTap={{ scale: 0.9 }} onClick={() => onEnterProfile && onEnterProfile()}
            style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: `2px solid ${C.accent}44` }}>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 800, color: "#fff" }}>Y</span>
          </motion.div>

          {/* Center: PlanSpace wordmark */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>
              Plan<span style={{ color: C.accentLight }}>Space</span>
            </span>
          </div>

          {/* Right: icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <motion.button whileTap={{ scale: 0.88 }}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <Search size={22} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <MessageSquare size={22} />
              {messages > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: C.accent, border: `1.5px solid ${C.surface}` }} />
              )}
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
              <Bell size={22} />
              {notifications > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 99, background: C.red, border: `1.5px solid ${C.surface}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  <span style={{ fontFamily: font, fontSize: 8, fontWeight: 800, color: "#fff" }}>{notifications}</span>
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* ── Stories Row ── */}
        <div style={{ display: "flex", gap: 12, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {STORIES.map(story => (
            <motion.div key={story.id} whileTap={{ scale: 0.92 }} onClick={() => story.isOwn ? (onEnterProfile && onEnterProfile()) : setActiveStory(story)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", padding: story.hasNew ? 2 : 0, background: story.hasNew ? `conic-gradient(${story.color} 0deg, ${story.color}88 180deg, ${story.color} 360deg)` : C.border }}>
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `2px solid ${C.surface}`, background: story.isOwn ? `linear-gradient(135deg, ${C.accent}44, ${C.accentDim ?? "#3d2480"})` : `linear-gradient(135deg, ${story.color}44, ${story.color}22)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {story.isOwn ? (
                    <span style={{ fontFamily: font, fontSize: 22, color: C.accentLight }}>+</span>
                  ) : (
                    <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: "#fff" }}>{story.initials}</span>
                  )}
                </div>
              </div>
              <span style={{ fontFamily: font, fontSize: 10, color: story.hasNew ? C.text : C.textMuted, fontWeight: story.hasNew ? 700 : 400, maxWidth: 58, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {story.isOwn ? "Your story" : story.name.split(" ")[0]}
              </span>
            </motion.div>
          ))}
        </div>

        {/* ── Feed ── */}
        <div style={{ flex: 1 }}>
          {POSTS.map((post, i) => (
            <div key={post.id}>
              <PostCard post={post} onProfileClick={(user) => onEnterProfile && onEnterProfile(user)} />
              {/* Inject suggested row after 2nd post */}
              {i === 1 && (
                <div style={{ padding: "14px 0 14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, paddingRight: 16 }}>Suggested for you</p>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingRight: 16 }}>
                    {SUGGESTED.map(u => (
                      <SuggestedCard key={u.id} user={u} onVisit={() => onEnterProfile && onEnterProfile(u)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Bottom padding */}
          <div style={{ height: 60 }} />
        </div>
      </div>

      {/* ── Story Viewer overlay ── */}
      <AnimatePresence>
        {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />}
      </AnimatePresence>
    </div>
  );
}
