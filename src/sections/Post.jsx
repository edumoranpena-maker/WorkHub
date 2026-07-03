/**
 * Post.jsx — Updates/Recaps section.
 *
 * STATE ARCHITECTURE (no re-render bugs):
 *  - threads      → stable, only mutated via setThreads()
 *  - searchQuery  → committed only on Search button press (NOT while typing)
 *  - filters      → { statuses: [], fromDate: null } — updated on filter change
 *  - openThread   → separate state, never collapses feed
 *  - fabOpen      → separate UI-only state
 *
 * Three cleanly separated layers:
 *  1. FilterBar      — filter btn (left) + search input + search btn (right)
 *  2. PostFeed       — stable list, keyed by thread.id only
 *  3. ThreadView     — reused from Recaps, minus the sticky bottom composer
 */

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  ChevronLeft, Search, X, Heart, MessageCircle, Plus,
  Send, Mic, Square, Image, Video,
  Loader, FileText, Check, ChevronRight,
  Bookmark, Share2, Layers, FolderPlus, ExternalLink, Link,
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
  deleteThreadUpdate,
  updateRecapThread,
  updateThreadUpdate,
  fetchThreadComments,
} from "../lib/recapsApi.js";
import { useImageViewer, ExpandImageButton } from "../components/GlobalImageViewer.jsx";
import MediaCarousel from "../components/MediaCarousel.jsx";
import ChecklistBlock from "../components/ChecklistBlock.jsx";
import PostComposer from "../components/PostComposer.jsx";
import PostOptionsMenu, { buildContentMenuActions } from "../components/PostOptionsMenu.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useLinkPreviews, LinkPreviewCard, LinkExpandModal, mergeLinksIntoMedia } from "../lib/linkPreview.jsx";
import { PrivacyIcon } from "../lib/visibility.jsx";
import { usePublishQueue } from "../lib/publishQueue.jsx";

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
  accentDim: "#3d2480", text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  green: "#1ed99a", greenDim: "rgba(30,217,154,0.12)",
  amber: "#f5a623", blue: "#4fa3ff", red: "#ff4f6a",
  teal: "#22d3a0", tealDim: "rgba(34,211,160,0.14)",
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
      <div style={{ padding: "5px 14px", borderRadius: 99, background: "rgba(14,14,24,0.85)", backdropFilter: "blur(16px)", border: `1px solid rgba(34,211,160,0.22)`, boxShadow: "0 0 20px rgba(34,211,160,0.1)" }}>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, ${C.border}, transparent)` }} />
    </div>
  );
}

// ─── TelegramDatePicker — minimal inline calendar picker ─────────────────────
function TelegramDatePicker({ value, onChange }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(value ? value.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isSelected = (d) => {
    if (!d || !value) return false;
    return value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === d;
  };
  const isToday = (d) => {
    if (!d) return false;
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
  };
  const isFuture = (d) => {
    if (!d) return false;
    return new Date(viewYear, viewMonth, d) > today;
  };

  return (
    <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 16px 12px", width: 260, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", userSelect: "none" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: "4px 6px", borderRadius: 8, display: "flex", alignItems: "center" }}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>
          {MONTHS[viewMonth].slice(0,3)} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: "4px 6px", borderRadius: 8, display: "flex", alignItems: "center" }}>
          <ChevronRight size={15} />
        </button>
      </div>
      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={{ textAlign: "center", fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textDim, padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((d, i) => (
          <button key={i} disabled={!d || isFuture(d)} onClick={() => d && !isFuture(d) && onChange(new Date(viewYear, viewMonth, d))}
            style={{
              width: "100%", aspectRatio: "1/1", borderRadius: 8, border: "none",
              background: isSelected(d) ? C.teal : isToday(d) ? `${C.teal}20` : "transparent",
              color: !d ? "transparent" : isFuture(d) ? C.textDim : isSelected(d) ? "#000" : isToday(d) ? C.teal : C.text,
              fontFamily: font, fontSize: 12, fontWeight: isSelected(d) ? 800 : 500,
              cursor: !d || isFuture(d) ? "default" : "pointer",
              opacity: !d ? 0 : isFuture(d) ? 0.25 : 1,
              transition: "all 0.1s",
            }}>
            {d}
          </button>
        ))}
      </div>
      {/* Clear */}
      {value && (
        <button onClick={() => onChange(null)}
          style={{ marginTop: 10, width: "100%", padding: "7px 0", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontFamily: font, fontSize: 12, cursor: "pointer", transition: "color 0.15s" }}>
          Clear date
        </button>
      )}
    </motion.div>
  );
}

// ─── FilterBar — Filter btn (left) + search input + Search btn (right) ────────
// Search fires ONLY on button press (or Enter). Input stays visible after search.
// Active filter chips row appears below the bar when any filter is on.
const STATUS_FILTER = [
  { id: "active",      label: "Active",      color: C.green,     bg: C.greenDim },
  { id: "in_progress", label: "In Progress", color: C.amber,     bg: "rgba(245,166,35,0.12)" },
  { id: "closed",      label: "Closed",      color: C.textMuted, bg: "rgba(106,106,130,0.10)" },
];

const FilterBar = memo(function FilterBar({ onSearch, onFilterChange }) {
  const [inputVal, setInputVal]         = useState("");
  const [filterOpen, setFilterOpen]     = useState(false);
  const [activeStatuses, setActiveStatuses] = useState([]);
  const [fromDate, setFromDate]         = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const containerRef = useRef(null);

  // Close filter panel on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFilterOpen(false);
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  const commitSearch = () => onSearch(inputVal.trim());
  const handleKeyDown = (e) => { if (e.key === "Enter") commitSearch(); };

  const clearInput = () => { setInputVal(""); onSearch(""); };

  const toggleStatus = (id) => {
    setActiveStatuses(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      onFilterChange({ statuses: next, fromDate });
      return next;
    });
  };

  const removeStatus = (id) => {
    const next = activeStatuses.filter(s => s !== id);
    setActiveStatuses(next);
    onFilterChange({ statuses: next, fromDate });
  };

  const handleFromDate = (d) => {
    setFromDate(d);
    setShowDatePicker(false);
    onFilterChange({ statuses: activeStatuses, fromDate: d });
  };

  const removeFromDate = () => {
    setFromDate(null);
    onFilterChange({ statuses: activeStatuses, fromDate: null });
  };

  const clearAll = () => {
    setInputVal("");
    setActiveStatuses([]);
    setFromDate(null);
    setShowDatePicker(false);
    setFilterOpen(false);
    onSearch("");
    onFilterChange({ statuses: [], fromDate: null });
  };

  const hasActiveFilters = activeStatuses.length > 0 || fromDate !== null;
  // Build chip list: one per active status + one for date
  const activeChips = [
    ...activeStatuses.map(id => {
      const s = STATUS_FILTER.find(x => x.id === id);
      return { key: `s_${id}`, label: s.label, color: s.color, bg: s.bg, onRemove: () => removeStatus(id) };
    }),
    ...(fromDate ? [{
      key: "date",
      label: `Desde: ${fromDate.getDate().toString().padStart(2,"0")}-${(fromDate.getMonth()+1).toString().padStart(2,"0")}-${fromDate.getFullYear()}`,
      color: C.teal,
      bg: `${C.teal}14`,
      onRemove: removeFromDate,
    }] : []),
  ];

  return (
    <div ref={containerRef} style={{ position: "relative" }}>

      {/* ── Row: Filter btn | Search input | Search btn ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44 }}>

        {/* Filter button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => { setFilterOpen(o => !o); setShowDatePicker(false); }}
          style={{
            flexShrink: 0, height: 44, minWidth: 44, padding: "0 12px",
            borderRadius: 14,
            border: `1px solid ${hasActiveFilters ? C.teal + "70" : filterOpen ? C.teal + "55" : C.border}`,
            background: hasActiveFilters ? `${C.teal}14` : filterOpen ? `${C.teal}0d` : C.card,
            color: hasActiveFilters || filterOpen ? C.teal : C.textMuted,
            display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
            transition: "all 0.18s",
            boxShadow: hasActiveFilters ? `0 0 12px ${C.teal}22` : "none",
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {hasActiveFilters && (
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 800, background: C.teal, color: "#000", borderRadius: 99, padding: "1px 5px", lineHeight: 1.4 }}>
              {activeStatuses.length + (fromDate ? 1 : 0)}
            </span>
          )}
        </motion.button>

        {/* Search input */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          background: C.card,
          border: `1px solid ${inputVal ? C.teal + "44" : C.border}`,
          borderRadius: 14, padding: "0 12px", height: "100%", transition: "border-color 0.18s",
        }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search posts…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 14 }}
          />
          {inputVal && (
            <motion.button initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
              onClick={clearInput}
              style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0, display: "flex", marginLeft: 6, flexShrink: 0 }}>
              <X size={13} />
            </motion.button>
          )}
        </div>

        {/* Search button */}
        <motion.button
          whileTap={{ scale: 0.91 }}
          onClick={commitSearch}
          style={{
            flexShrink: 0, height: 44, minWidth: 44, padding: "0 12px",
            borderRadius: 14,
            background: inputVal.trim() ? `linear-gradient(135deg, ${C.teal}, #18b87a)` : C.card,
            color: inputVal.trim() ? "#000" : C.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.18s",
            border: `1px solid ${inputVal.trim() ? "transparent" : C.border}`,
            boxShadow: inputVal.trim() ? `0 0 14px ${C.teal}44` : "none",
          }}>
          <Search size={15} strokeWidth={2.2} />
        </motion.button>
      </div>

      {/* ── Active filter chips row ── */}
      <AnimatePresence>
        {activeChips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              overflowX: "auto", paddingBottom: 2,
              scrollbarWidth: "none", msOverflowStyle: "none",
            }}>
              {/* Individual filter chips */}
              {activeChips.map(chip => (
                <motion.div
                  key={chip.key}
                  initial={{ opacity: 0, scale: 0.8, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -6 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{
                    flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 8px 5px 11px",
                    borderRadius: 99,
                    border: `1px solid ${chip.color}50`,
                    background: chip.bg,
                    whiteSpace: "nowrap",
                  }}>
                  <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: chip.color, letterSpacing: "0.01em" }}>
                    {chip.label}
                  </span>
                  <button onClick={chip.onRemove}
                    style={{
                      background: `${chip.color}22`, border: "none", borderRadius: "50%",
                      width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", padding: 0, flexShrink: 0, color: chip.color,
                    }}>
                    <X size={9} strokeWidth={2.5} />
                  </button>
                </motion.div>
              ))}

              {/* Separator dot */}
              {activeChips.length > 0 && (
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: C.textDim, flexShrink: 0, opacity: 0.5 }} />
              )}

              {/* Clear all button */}
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                whileTap={{ scale: 0.93 }}
                onClick={clearAll}
                style={{
                  flexShrink: 0,
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", borderRadius: 99,
                  border: `1px solid ${C.border}`,
                  background: "transparent", cursor: "pointer",
                  fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textMuted,
                  whiteSpace: "nowrap", transition: "border-color 0.15s, color 0.15s",
                }}>
                <X size={9} strokeWidth={2.5} />
                Limpiar todo
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter panel dropdown ── */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 120,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
              padding: "14px 16px 16px", boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
            }}>

            {/* Status section */}
            <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.textMuted }}>
              Estado
            </p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
              {STATUS_FILTER.map(s => {
                const active = activeStatuses.includes(s.id);
                return (
                  <motion.button key={s.id} whileTap={{ scale: 0.93 }} onClick={() => toggleStatus(s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 99,
                      border: `1.5px solid ${active ? s.color + "80" : C.border}`,
                      background: active ? s.bg : "transparent",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, opacity: active ? 1 : 0.45, boxShadow: active ? `0 0 6px ${s.color}` : "none" }} />
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? s.color : C.textMuted, transition: "color 0.15s" }}>
                      {s.label}
                    </span>
                    {active && <Check size={10} color={s.color} />}
                  </motion.button>
                );
              })}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.border, margin: "0 0 14px" }} />

            {/* From date section */}
            <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.textMuted }}>
              Desde
            </p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowDatePicker(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 12, width: "100%",
                border: `1.5px solid ${fromDate ? C.teal + "70" : C.border}`,
                background: fromDate ? `${C.teal}12` : C.surface,
                cursor: "pointer", transition: "all 0.15s",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={fromDate ? C.teal : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ flex: 1, fontFamily: font, fontSize: 13, color: fromDate ? C.teal : C.textMuted, textAlign: "left", fontWeight: fromDate ? 700 : 400 }}>
                {fromDate
                  ? `${fromDate.getDate()} ${MONTHS[fromDate.getMonth()].slice(0,3)} ${fromDate.getFullYear()}`
                  : "Seleccionar fecha"}
              </span>
              <ChevronRight size={13} color={fromDate ? C.teal : C.textMuted}
                style={{ transform: showDatePicker ? "rotate(90deg)" : "none", transition: "transform 0.18s" }} />
            </motion.button>

            <AnimatePresence>
              {showDatePicker && (
                <div style={{ marginTop: 10 }}>
                  <TelegramDatePicker value={fromDate} onChange={handleFromDate} />
                </div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── PostCard — 2-column grid card with image thumbnail ───────────────────────
const PostCard = memo(function PostCard({ thread, onClick, onEdit, onDelete, onShare, onReport }) {
  const [hov, setHov] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const thumb = thread.media?.[0]?.thumb || thread.media?.[0]?.url || null;
  const opt = STATUS_OPTIONS.find(o => o.id === thread.status) || STATUS_OPTIONS[0];

  const menuActions = buildContentMenuActions({
    onEdit:   onEdit   && (() => onEdit(thread)),
    onDelete: onDelete && (() => setConfirmDelete(true)),
    onShare:  onShare  && (() => onShare(thread)),
    onReport: onReport && (() => onReport(thread)),
  });

  return (
    <>
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
          <div style={{ position: "absolute", top: 8, right: 40, background: C.teal, borderRadius: 99, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, boxShadow: `0 0 10px ${C.teal}80` }}>
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 800, color: "#000" }}>+{thread.newUpdates}</span>
          </div>
        )}

        {/* 3-dot options — top-right corner */}
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <PostOptionsMenu actions={menuActions} size={26} />
        </div>

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
        {/* Title + status, same line (image-less cards only — thumbnail cards show title over the image) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          {!thumb ? (
            <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", flex: 1 }}>
              {thread.title || "Untitled"}
            </p>
          ) : <div />}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: opt.color, boxShadow: `0 0 5px ${opt.color}` }} />
            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: opt.color }}>{opt.label}</span>
          </div>
        </div>

        {/* Footer: date + privacy + edited */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
            {fmtDate(thread.timestamp)}
          </p>
          <PrivacyIcon visibility={thread.visibility} size={10} color={C.textMuted} />
          {thread.edited && (
            <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>· Editado</span>
          )}
        </div>
      </div>
    </motion.div>
    <ConfirmDialog
      open={confirmDelete}
      title="¿Eliminar esta publicación?"
      subtitle="Esta acción no se puede deshacer."
      onCancel={() => setConfirmDelete(false)}
      onConfirm={() => { setConfirmDelete(false); onDelete?.(thread); }}
    />
    </>
  );
});

// ─── PostFeed — stable grid, filters applied only on committed search + filter changes ──
// searchQuery: committed on button press only. filters: { statuses, fromDate }
const PostFeed = memo(function PostFeed({ threads, searchQuery, filters, onOpenThread, onEditThread, onDeleteThread, onShareThread, onReportThread }) {
  const filtered = useMemo(() => {
    let list = [...threads];

    // 1. Status filter
    if (filters.statuses && filters.statuses.length > 0) {
      list = list.filter(t => filters.statuses.includes(t.status));
    }

    // 2. From-date filter — hide everything before fromDate, ascending order
    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      from.setHours(0, 0, 0, 0);
      list = list.filter(t => t.timestamp >= from);
      list.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      // Default: newest first
      list.sort((a, b) => b.timestamp - a.timestamp);
    }

    // 3. Search query filter (committed on button press)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.content?.toLowerCase().includes(q) ||
        t.hashtags?.some(h => h.toLowerCase().includes(q))
      );
    }

    return list;
  }, [threads, searchQuery, filters]);

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
              <PostCard key={t.id} thread={t} onClick={() => onOpenThread(t)}
                onEdit={onEditThread} onDelete={onDeleteThread} onShare={onShareThread} onReport={onReportThread} />
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
function UpdateBubble({ update, index, visibility, onEdit, onDelete, onShare, onReport }) {
  const [liked, setLiked] = useState(update.liked);
  const [likeCount, setLikeCount] = useState(update.likes);
  const [expandedLink, setExpandedLink] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { openGallery, openImage, ViewerPortal } = useImageViewer();
  const links = useLinkPreviews(update.content);
  const mediaWithLinks = mergeLinksIntoMedia(update.media, links);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    await toggleUpdateLike(update.id);
  };

  const menuActions = buildContentMenuActions({
    onEdit:   onEdit   && (() => onEdit(update)),
    onDelete: onDelete && (() => setConfirmDelete(true)),
    onShare:  onShare  && (() => onShare(update)),
    onReport: onReport && (() => onReport(update)),
  });

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
        {mediaWithLinks.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <MediaCarousel
              items={mediaWithLinks}
              onOpenGallery={openGallery}
              accentColor={C.teal}
              square={false}
            />
          </div>
        )}
        {update.audio && <div style={{ marginTop: 10 }}><AudioPlayer audio={update.audio} accentColor={C.teal} /></div>}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{fmtDate(update.timestamp)} · {fmtTime(update.timestamp)}</span>
          <PrivacyIcon visibility={visibility} size={10} color={C.textMuted} />
          {update.edited && <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>· Editado</span>}
          <div style={{ flex: 1 }} />
          <motion.button whileTap={{ scale: 0.88 }} onClick={toggleLike}
            style={{ display: "flex", alignItems: "center", gap: 4, background: liked ? `${C.red}14` : "transparent", border: `1px solid ${liked ? C.red + "40" : C.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: liked ? C.red : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 500, transition: "all 0.15s" }}>
            <Heart size={12} fill={liked ? C.red : "none"} /> {likeCount}
          </motion.button>
          <PostOptionsMenu actions={menuActions} size={26} />
        </div>
      </div>
      <LinkExpandModal preview={expandedLink} onClose={() => setExpandedLink(null)} />
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar este update?"
        subtitle="Esta acción no se puede deshacer."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete?.(update); }}
      />
      <ViewerPortal />
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
      .then(data => {
        if (!cancelled) {
          setComments(data);   // always set — empty array shows "No comments yet" correctly
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("[CommentsSheet] fetchThreadComments threw:", err);
        if (!cancelled) setLoading(false);
      });
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
    const temp = { id: `c_temp_${Date.now()}`, author: "You", avatar: "Y", text, likes: 0, liked: false, time: new Date().toISOString() };
    setComments(prev => [...prev, temp]);
    const saved = await addThreadComment(threadId, { author: "You", text });
    if (saved) {
      setComments(prev => prev.map(c => c.id === temp.id ? saved : c));
    } else {
      console.error("[CommentsSheet] addThreadComment returned null — comment was NOT saved");
      setComments(prev => prev.filter(c => c.id !== temp.id));
    }
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
                  <span style={{ fontFamily: font, fontSize: 11, color: C.textDim }}>
                    {c.time === "just now" ? "just now" : (() => {
                      const d = new Date(c.time);
                      if (isNaN(d)) return "";
                      const diff = (Date.now() - d) / 1000;
                      if (diff < 60)   return "just now";
                      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                      return `${Math.floor(diff / 86400)}d ago`;
                    })()}
                  </span>
                </div>
                <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.55 }}>{c.text}</p>
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


// ─── SubtemaCard — compact card shown inside ThreadView ───────────────────────
function SubtemaCard({ subtema, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div whileTap={{ scale: 0.97 }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? C.cardHover : C.card,
        border: `1px solid ${hov ? C.teal + "50" : C.teal + "22"}`,
        borderRadius: 16, padding: "12px 14px", cursor: "pointer",
        marginBottom: 8, transition: "all 0.18s",
        boxShadow: hov ? `0 4px 20px ${C.teal}14` : "none",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: `${C.teal}18`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Layers size={12} color={C.teal} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtema.title}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted }}>{fmtDate(subtema.timestamp)}</span>
            <span style={{ color: C.textDim, fontSize: 10 }}>·</span>
            <span style={{ fontFamily: font, fontSize: 10, color: C.textMuted }}>{fmtTime(subtema.timestamp)}</span>
            {subtema.updates?.length > 0 && (
              <>
                <span style={{ color: C.textDim, fontSize: 10 }}>·</span>
                <span style={{ fontFamily: font, fontSize: 10, color: C.teal, fontWeight: 600 }}>{subtema.updates.length} update{subtema.updates.length !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={14} color={C.teal} />
      </div>
    </motion.div>
  );
}

// ─── SubtemaView — like ThreadView but for a Subtema, no nested subtemas ──────
function SubtemaView({ subtema: initialSubtema, onBack, isHost, showComposer, onHideComposer, parentVisibility, onSubtemaEdited, onSubtemaDeleted }) {
  const [subtema, setSubtema] = useState(initialSubtema);
  const [expandedLink, setExpandedLink] = useState(null);
  const [editingSubtema, setEditingSubtema] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [confirmDeleteSubtema, setConfirmDeleteSubtema] = useState(false);
  const { openGallery, openImage, ViewerPortal } = useImageViewer();
  const { enqueue } = usePublishQueue();
  const subtemaLinks = useLinkPreviews(subtema.content);
  const subtemaMedia = mergeLinksIntoMedia(subtema.media, subtemaLinks);

  const handleNewUpdate = ({ content, audio, mediaFiles }) => {
    const rawFiles = (mediaFiles || []).map(m => m.file).filter(Boolean);
    enqueue("Publicando update…", async () => {
      const saved = await addThreadUpdate(subtema.id, { content, audio, mediaFiles: rawFiles });
      if (saved) setSubtema(s => ({ ...s, updates: [...(s.updates || []), saved] }));
    });
  };

  const handleEditSubtema = ({ title, content, mediaFiles, audio }) => {
    setSubtema(s => ({ ...s, title, content, media: mediaFiles, audio, edited: true }));
    onSubtemaEdited?.(subtema.id, { title, content, media: mediaFiles, audio, edited: true });
    // NOTE: subtemas are client-side only today (never persisted to Supabase),
    // matching how they're created — so edits here only update local state.
  };

  const handleDeleteSubtema = () => {
    // Client-side only, same reasoning as above — no Supabase row to delete.
    onSubtemaDeleted?.(subtema.id);
    onBack?.();
  };

  const handleEditUpdate = ({ content }) => {
    const target = editingUpdate;
    setSubtema(s => ({ ...s, updates: s.updates.map(u => u.id === target.id ? { ...u, content, edited: true } : u) }));
    enqueue("Guardando cambios…", async () => { await updateThreadUpdate(target.id, { content }); });
  };

  const handleDeleteUpdate = (update) => {
    setSubtema(s => ({ ...s, updates: s.updates.filter(u => u.id !== update.id) }));
    enqueue("Eliminando update…", async () => { await deleteThreadUpdate(update.id); });
  };

  const menuActions = buildContentMenuActions({
    onEdit:   () => setEditingSubtema(true),
    onDelete: () => setConfirmDeleteSubtema(true),
    onShare:  () => {},
    onReport: () => {},
  });

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: C.surface }}>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {/* TopBar */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: `1px solid ${C.border}`, background: `${C.surface}f0`, backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 30, minHeight: 56 }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: C.teal, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 500, padding: "4px 0", flexShrink: 0 }}>
            <ChevronLeft size={19} strokeWidth={2.2} /> Back
          </button>
          <span style={{ flex: 1, color: C.text, fontFamily: font, fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", textAlign: "center", marginRight: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtema.title}
          </span>
        </motion.div>

        {/* Subtema header */}
        <div style={{ background: `${C.teal}08`, borderBottom: `1px solid ${C.teal}18`, padding: "20px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${C.teal}18`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={14} color={C.teal} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>{subtema.author || "Alex H."}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{fmtDate(subtema.timestamp)} · {fmtTime(subtema.timestamp)}</span>
                <PrivacyIcon visibility={parentVisibility} size={10} color={C.textMuted} />
                {subtema.edited && <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>· Editado</span>}
              </div>
            </div>
            {isHost && <PostOptionsMenu actions={menuActions} />}
          </div>

          {subtema.content && (
            <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 14, lineHeight: 1.65, color: C.text }}>{subtema.content}</p>
          )}

          {subtemaMedia.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <MediaCarousel
                items={subtemaMedia}
                onOpenGallery={openGallery}
                accentColor={C.teal}
              />
            </div>
          )}

          {subtema.audio && <AudioPlayer audio={subtema.audio} accentColor={C.teal} />}
        </div>

        {/* Updates */}
        <div style={{ padding: "16px 16px 80px" }}>
          {(subtema.updates?.length || 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${C.teal}40, transparent)` }} />
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {subtema.updates.length} Update{subtema.updates.length !== 1 ? "s" : ""}
              </span>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(270deg, ${C.teal}40, transparent)` }} />
            </div>
          )}
          <div style={{ paddingLeft: 4 }}>
            {(subtema.updates || []).map((u, i) => (
              <UpdateBubble key={u.id} update={u} index={i} visibility={parentVisibility}
                onEdit={() => setEditingUpdate(u)} onDelete={handleDeleteUpdate} onShare={() => {}} onReport={() => {}} />
            ))}
          </div>
          {(!subtema.updates || subtema.updates.length === 0) && !isHost && (
            <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 13, padding: "24px 0" }}>No updates yet.</p>
          )}
        </div>
      </div>

      {/* Composer overlay — create update */}
      <AnimatePresence>
        {showComposer && (
          <PostComposer mode="update"
            onSubmit={handleNewUpdate}
            onClose={onHideComposer} />
        )}
      </AnimatePresence>

      {/* Composer overlay — edit subtema */}
      <AnimatePresence>
        {editingSubtema && (
          <PostComposer mode="subtema" isEditing
            initial={{ title: subtema.title, content: subtema.content, mediaFiles: subtema.media, audio: subtema.audio }}
            onSubmit={handleEditSubtema}
            onClose={() => setEditingSubtema(false)} />
        )}
      </AnimatePresence>

      {/* Composer overlay — edit update */}
      <AnimatePresence>
        {editingUpdate && (
          <PostComposer mode="update" isEditing
            initial={{ content: editingUpdate.content, mediaFiles: editingUpdate.media, audio: editingUpdate.audio }}
            onSubmit={handleEditUpdate}
            onClose={() => setEditingUpdate(null)} />
        )}
      </AnimatePresence>

      <LinkExpandModal preview={expandedLink} onClose={() => setExpandedLink(null)} />
      <ConfirmDialog
        open={confirmDeleteSubtema}
        title="¿Eliminar este subtema?"
        subtitle="Esta acción no se puede deshacer."
        onCancel={() => setConfirmDeleteSubtema(false)}
        onConfirm={() => { setConfirmDeleteSubtema(false); handleDeleteSubtema(); }}
      />
      <ViewerPortal />
    </div>
  );
}
// ─── ThreadView — Post thread with updates + subtemas + FAB ───────────────────
function ThreadView({ thread: initialThread, onBack, isHost, onStatusChange, onThreadEdited, onThreadDeleted, showComposer, composerMode, onHideComposer, onAddSubtema, onSubtemaChange }) {
  const [thread, setThread] = useState(initialThread);
  const [liked, setLiked] = useState(initialThread.liked);
  const [likeCount, setLikeCount] = useState(initialThread.likes);
  const [showComments, setShowComments] = useState(false);
  const [openSubtema, setOpenSubtema] = useState(null);
  const [subtemaDirection, setSubtemaDirection] = useState(1);
  const [expandedLink, setExpandedLink] = useState(null);
  const [editingThread, setEditingThread] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [confirmDeleteThread, setConfirmDeleteThread] = useState(false);
  const { openGallery, openImage, ViewerPortal } = useImageViewer();
  const { enqueue } = usePublishQueue();
  const threadLinks = useLinkPreviews(thread.content);
  const threadMedia = mergeLinksIntoMedia(thread.media, threadLinks);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    await toggleThreadLike(thread.id);
  };

  const handleNewUpdate = ({ content, audio, mediaFiles }) => {
    const rawFiles = (mediaFiles || []).map(m => m.file).filter(Boolean);
    enqueue("Publicando update…", async () => {
      const saved = await addThreadUpdate(thread.id, { content, audio, mediaFiles: rawFiles });
      if (saved) setThread(t => ({ ...t, updates: [...t.updates, saved] }));
    });
  };

  const handleAddSubtema = ({ title, content, mediaFiles, audio }) => {
    // NOTE: subtemas are client-side only (no Supabase table today) — matches
    // the existing behaviour, so this resolves immediately but still shows
    // the same "Publicando…" bar for a consistent feel.
    enqueue("Publicando subtema…", async () => {
      const newSub = {
        id: `sub_${Date.now()}`,
        title, content, media: mediaFiles || [], audio: audio || null,
        author: "Alex H.", timestamp: new Date(),
        updates: [],
      };
      setThread(t => ({ ...t, subtemas: [...(t.subtemas || []), newSub] }));
      onAddSubtema?.(thread.id, newSub);
    });
  };

  const handleEditThread = ({ title, content, visibility }) => {
    setThread(t => ({ ...t, title, content, visibility, edited: true }));
    onThreadEdited?.(thread.id, { title, content, visibility, edited: true });
    enqueue("Guardando cambios…", async () => { await updateRecapThread(thread.id, { title, content, visibility }); });
  };

  const handleDeleteThread = () => {
    onThreadDeleted?.(thread);
    onBack?.();
  };

  const handleEditUpdate = ({ content }) => {
    const target = editingUpdate;
    setThread(t => ({ ...t, updates: t.updates.map(u => u.id === target.id ? { ...u, content, edited: true } : u) }));
    enqueue("Guardando cambios…", async () => { await updateThreadUpdate(target.id, { content }); });
  };

  const handleDeleteUpdate = (update) => {
    setThread(t => ({ ...t, updates: t.updates.filter(u => u.id !== update.id) }));
    enqueue("Eliminando update…", async () => { await deleteThreadUpdate(update.id); });
  };

  const openSubtemaView = (sub) => { setSubtemaDirection(1); setOpenSubtema(sub); onSubtemaChange?.(true); };
  const closeSubtema = () => { setSubtemaDirection(-1); setOpenSubtema(null); onSubtemaChange?.(false); };

  const slideVariants = {
    enter: d => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: d => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };
  const springTrans = { type: "spring", stiffness: 380, damping: 38, mass: 0.85 };

  // Which composer to show inside this view
  const showUpdateComposer = showComposer && composerMode === "update" && !openSubtema;
  const showSubtemaComposer = showComposer && composerMode === "subtema" && !openSubtema;

  const menuActions = buildContentMenuActions({
    onEdit:   () => setEditingThread(true),
    onDelete: () => setConfirmDeleteThread(true),
    onShare:  () => {},
    onReport: () => {},
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.surface, position: "relative" }}>
      {showComments && <CommentsSheet threadId={thread.id} onClose={() => setShowComments(false)} />}

      <AnimatePresence mode="popLayout" custom={subtemaDirection}>
        {!openSubtema ? (
          <motion.div key="thread-main" initial={{ opacity: 1 }} animate={{ opacity: 1 }}
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

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
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{fmtDate(thread.timestamp)} · {fmtTime(thread.timestamp)}</span>
                      <PrivacyIcon visibility={thread.visibility} size={10} color={C.textMuted} />
                      {thread.edited && <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>· Editado</span>}
                    </div>
                  </div>
                  {isHost && <PostOptionsMenu actions={menuActions} />}
                </div>

                {thread.title && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", background: "linear-gradient(135deg, rgba(124,77,255,0.2), rgba(157,113,255,0.12))", border: "1px solid rgba(124,77,255,0.35)", borderRadius: 999, padding: "5px 14px" }}>
                      <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.accentLight }}>{thread.title}</span>
                    </div>
                    <StatusChip status={thread.status} isHost={isHost} onSetStatus={s => { setThread(t => ({ ...t, status: s })); onStatusChange?.(thread.id, s); }} />
                  </div>
                )}

                <p style={{ margin: 0, fontFamily: font, fontSize: 14, lineHeight: 1.65, color: C.text }}>{thread.content}</p>

                {thread.checklist && (
                  <div style={{ marginTop: 12 }}>
                    <ChecklistBlock
                      checklist={thread.checklist}
                      onChange={(updated) => setThread(t => ({ ...t, checklist: updated }))}
                      accentColor={C.teal}
                    />
                  </div>
                )}

                {thread.hashtags?.length > 0 && (
                  <p style={{ margin: "8px 0 0", fontFamily: font, fontSize: 12, color: C.accent }}>{thread.hashtags.join(" ")}</p>
                )}

                {threadMedia.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <MediaCarousel
                      items={threadMedia}
                      onOpenGallery={openGallery}
                      accentColor={C.teal}
                    />
                  </div>
                )}

                {thread.audio && <div style={{ marginTop: 12 }}><AudioPlayer audio={thread.audio} accentColor={C.teal} /></div>}

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
                    <UpdateBubble key={u.id} update={u} index={i} visibility={thread.visibility}
                      onEdit={() => setEditingUpdate(u)} onDelete={handleDeleteUpdate} onShare={() => {}} onReport={() => {}} />
                  ))}
                </div>
                {thread.updates.length === 0 && !isHost && (
                  <p style={{ textAlign: "center", color: C.textMuted, fontFamily: font, fontSize: 13, padding: "24px 0" }}>No updates yet.</p>
                )}
              </div>

              {/* Subtemas */}
              {((thread.subtemas?.length || 0) > 0 || isHost) && (
                <div style={{ padding: "16px 16px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${C.teal}30, transparent)` }} />
                    <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Subtemas {(thread.subtemas?.length || 0) > 0 ? `· ${thread.subtemas.length}` : ""}
                    </span>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(270deg, ${C.teal}30, transparent)` }} />
                  </div>
                  {(thread.subtemas || []).map((sub) => (
                    <SubtemaCard key={sub.id} subtema={sub} onClick={() => openSubtemaView(sub)} />
                  ))}

                </div>
              )}

              <div style={{ height: 90 }} />
            </div>
          </motion.div>
        ) : (
          <motion.div key={openSubtema.id} custom={subtemaDirection} variants={slideVariants}
            initial="enter" animate="center" exit="exit" transition={springTrans}
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <SubtemaView subtema={openSubtema} onBack={closeSubtema} isHost={isHost}
              parentVisibility={thread.visibility}
              onSubtemaEdited={(subId, patch) => setThread(t => ({ ...t, subtemas: t.subtemas.map(s => s.id === subId ? { ...s, ...patch } : s) }))}
              onSubtemaDeleted={(subId) => setThread(t => ({ ...t, subtemas: t.subtemas.filter(s => s.id !== subId) }))}
              showComposer={showComposer && composerMode === "update"}
              onHideComposer={onHideComposer} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composers for thread-level actions */}
      <AnimatePresence>
        {showUpdateComposer && (
          <PostComposer mode="update"
            onSubmit={handleNewUpdate}
            onClose={onHideComposer} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSubtemaComposer && (
          <PostComposer mode="subtema"
            onSubmit={handleAddSubtema}
            onClose={onHideComposer} />
        )}
      </AnimatePresence>

      {/* Edit thread */}
      <AnimatePresence>
        {editingThread && (
          <PostComposer mode="post" isEditing
            initial={{ title: thread.title, content: thread.content, visibility: thread.visibility, mediaFiles: thread.media, thumbnail: null }}
            onSubmit={handleEditThread}
            onClose={() => setEditingThread(false)} />
        )}
      </AnimatePresence>

      {/* Edit a thread-level update */}
      <AnimatePresence>
        {editingUpdate && (
          <PostComposer mode="update" isEditing
            initial={{ content: editingUpdate.content, mediaFiles: editingUpdate.media, audio: editingUpdate.audio }}
            onSubmit={handleEditUpdate}
            onClose={() => setEditingUpdate(null)} />
        )}
      </AnimatePresence>

      <LinkExpandModal preview={expandedLink} onClose={() => setExpandedLink(null)} />
      <ConfirmDialog
        open={confirmDeleteThread}
        title="¿Eliminar esta publicación?"
        subtitle="Esta acción no se puede deshacer."
        onCancel={() => setConfirmDeleteThread(false)}
        onConfirm={() => { setConfirmDeleteThread(false); handleDeleteThread(); }}
      />
      <ViewerPortal />
    </div>
  );
}


// ─── PostSection (default export) — Root component ────────────────────────────
// STATE SEPARATION:
//   threads        → feed data (stable)
//   openThread     → navigation (separate)
//   searchQuery  → committed on Search btn press (read-only in PostFeed)
//   fabOpen / sheets → UI only
// ─── GreenFAB ─────────────────────────────────────────────────────────────────
// Defined at module level so its reference is stable across Post re-renders.
// Receives all closed-over values as explicit props.
const GreenFAB = memo(function GreenFAB({ fabVisible, fabMenuOpen, setFabMenuOpen, openComposer, isInSubtema }) {
  // createPortal renders the FAB into document.body, making its position:fixed
  // relative to the viewport regardless of any transform/will-change ancestor
  // in the React tree (specifically the motion.div in App.jsx that wraps the feed).
  return createPortal(
    <AnimatePresence>
      {fabVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 440, damping: 32 }}
          style={{ position: "fixed", bottom: 28, right: 22, zIndex: 395 }}>

          {/* FAB menu options */}
          <AnimatePresence>
            {fabMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                style={{ position: "absolute", bottom: "calc(100% + 12px)", right: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>

                {/* Crear Update */}
                <motion.button whileTap={{ scale: 0.93 }}
                  onClick={() => openComposer("update")}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.teal}40`, borderRadius: 99, padding: "9px 16px 9px 12px", cursor: "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.teal}20`, border: `1px solid ${C.teal}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Send size={13} color={C.teal} />
                  </div>
                  <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>Crear Update</span>
                </motion.button>

                {/* Crear Subtema — only at post level */}
                {!isInSubtema && (
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => openComposer("subtema")}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.green}40`, borderRadius: 99, padding: "9px 16px 9px 12px", cursor: "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.green}20`, border: `1px solid ${C.green}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Layers size={13} color={C.green} />
                    </div>
                    <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>Crear Subtema</span>
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backdrop to close menu */}
          {fabMenuOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: -1 }} onClick={() => setFabMenuOpen(false)} />
          )}

          {/* Main FAB button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setFabMenuOpen(o => !o)}
            style={{
              width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
              background: fabMenuOpen
                ? `linear-gradient(135deg, #0ea876, ${C.teal})`
                : `linear-gradient(135deg, ${C.green}, #0ea876)`,
              boxShadow: `0 4px 24px ${C.green}55, 0 0 0 ${fabMenuOpen ? "6px" : "0px"} ${C.green}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "box-shadow 0.2s",
            }}>
            <motion.div animate={{ rotate: fabMenuOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
              <Plus size={22} color="#000" strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});

export default function Post({ section, onBack, isHost, onNavigate, openThreadId, onThreadChange, onRegisterPostCallback }) {
  // ── Feed state — never mutated by search or UI events ─────────────────────
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [loadingThreads, setLoadingThreads] = useState(true);

  // Expose a stable callback so App.jsx can prepend a newly created thread
  // without Post needing to know about NewPostSheet or createRecapThread directly.
  useEffect(() => {
    onRegisterPostCallback?.((newThread) => {
      setThreads(prev => [newThread, ...prev]);
    });
    // Deregister on unmount so a stale ref can't fire into an unmounted component
    return () => { onRegisterPostCallback?.(null); };
  }, [onRegisterPostCallback]); // eslint-disable-line

  // ── Navigation state ───────────────────────────────────────────────────────
  const [openThread, setOpenThread] = useState(null);
  const [direction, setDirection] = useState(1);
  const feedScrollRef = useRef(0);
  const feedContainerRef = useRef(null);

  // ── Search + Filter state ─────────────────────────────────────────────────
  // searchQuery is committed only when user presses the Search button
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ statuses: [], fromDate: null });
  const handleSearch = useCallback((q) => setSearchQuery(q), []);
  const handleFilterChange = useCallback((f) => setFilters(f), []);

  // ── UI-only state ──────────────────────────────────────────────────────────
  // ── FAB + composer state ───────────────────────────────────────────────────
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [activeComposer, setActiveComposer] = useState(null); // null | "update" | "subtema"
  const [subtemaOpen, setSubtemaOpen] = useState(false); // true when inside a SubtemaView
  const fabVisible = activeComposer === null;

  const openComposer = (mode) => { setFabMenuOpen(false); setActiveComposer(mode); };
  const closeComposer = () => setActiveComposer(null);

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

  const handleThreadEdited = useCallback((threadId, patch) => {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, ...patch } : t));
    setOpenThread(t => t?.id === threadId ? { ...t, ...patch } : t);
  }, []);

  // Delete a thread (Post). DB cascade (ON DELETE CASCADE on thread_id) already
  // takes care of thread_media/thread_updates/update_media/comments/likes —
  // see supabase-schema.sql. UI updates immediately; the actual delete runs
  // in the background via the publish queue.
  const { enqueue: enqueueFeedPublish } = usePublishQueue();
  const handleDeleteThread = useCallback((thread) => {
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    setOpenThread(t => t?.id === thread.id ? null : t);
    enqueueFeedPublish("Eliminando post…", async () => { await deleteRecapThread(thread.id); });
  }, [enqueueFeedPublish]);

  // Feed-level edit (triggered from the 3-dot menu on a PostCard, without opening the thread first)
  const [editingFeedThread, setEditingFeedThread] = useState(null);
  const handleFeedEditSubmit = useCallback(({ title, content, visibility }) => {
    const threadId = editingFeedThread.id;
    handleThreadEdited(threadId, { title, content, visibility, edited: true });
    enqueueFeedPublish("Guardando cambios…", async () => { await updateRecapThread(threadId, { title, content, visibility }); });
  }, [editingFeedThread, handleThreadEdited, enqueueFeedPublish]);

  const handleCreateSubtema = useCallback((data) => {
    const newThread = {
      id: `t${Date.now()}`, planningPostId: null,
      title: data.title, content: data.content || "",
      hashtags: [], status: "active", visibility: "members",
      isSubtema: true,
      author: "Alex H.", timestamp: new Date(),
      likes: 0, liked: false, commentCount: 0, newUpdates: 0,
      media: data.media || [], audio: data.audio || null, links: data.links || [],
      updates: [], subtemas: [],
    };
    setThreads(prev => [newThread, ...prev]);
  }, []);

  const openThreadView = useCallback((thread) => {
    if (feedContainerRef.current) feedScrollRef.current = feedContainerRef.current.scrollTop;
    setDirection(1); setOpenThread(thread);
  }, []);

  const closeThread = useCallback(() => {
    setDirection(-1); setOpenThread(null); setSubtemaOpen(false);
  }, []);

  // Restore scroll on back
  useEffect(() => {
    if (!openThread && feedContainerRef.current) {
      feedContainerRef.current.scrollTop = feedScrollRef.current;
    }
  }, [openThread]);

  // Notify parent when thread open state changes so it can hide the purple FAB
  useEffect(() => { onThreadChange?.(!!openThread); }, [openThread]); // eslint-disable-line

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

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  // fabProps: passed to module-level GreenFAB to keep its reference stable.
  const fabProps = { fabVisible, fabMenuOpen, setFabMenuOpen, openComposer };
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isHost ? C.accentLight : C.textMuted, background: isHost ? `${C.accent}18` : C.border + "80", border: `1px solid ${isHost ? C.accent + "30" : C.border}`, borderRadius: 6, padding: "3px 7px" }}>
                {isHost ? "Host" : "Member"}
              </span>
            </div>
          </div>
          {/* ── Desktop feed / thread panel (inlined — no wrapper component) ── */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <AnimatePresence mode="popLayout" custom={direction}>
                {!openThread ? (
                  <motion.div key="post-feed" initial={false} animate={{}} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: C.surface }}>
                    <div style={{ padding: "12px 28px 10px", flexShrink: 0 }}>
                      <FilterBar onSearch={handleSearch} onFilterChange={handleFilterChange} />
                    </div>
                    <div ref={feedContainerRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 28px 24px" }}>
                      {loadingThreads ? (
                        <div style={{ textAlign: "center", padding: "48px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                          <Loader size={16} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
                          <span style={{ color: C.textMuted, fontFamily: font, fontSize: 14 }}>Loading posts…</span>
                        </div>
                      ) : (
                        <PostFeed threads={threads} searchQuery={searchQuery} filters={filters} onOpenThread={openThreadView}
                          onEditThread={setEditingFeedThread} onDeleteThread={handleDeleteThread} onShareThread={() => {}} onReportThread={() => {}} />
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={openThread.id} custom={direction} variants={slideVariants}
                    initial="enter" animate="center" exit="exit" transition={springTrans}
                    style={{ position: "absolute", inset: 0, background: C.surface, display: "flex", flexDirection: "column" }}>
                    <ThreadView thread={openThread} onBack={closeThread} isHost={isHost}
                      onStatusChange={handleStatusChange}
                      onThreadEdited={handleThreadEdited}
                      onThreadDeleted={handleDeleteThread}
                      showComposer={activeComposer !== null}
                      composerMode={activeComposer}
                      onHideComposer={closeComposer}
                      onSubtemaChange={setSubtemaOpen}
                      onAddSubtema={(threadId, sub) => setThreads(prev => prev.map(t => t.id === threadId ? { ...t, subtemas: [...(t.subtemas || []), sub] } : t))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        {isHost && openThread && <GreenFAB {...fabProps} isInSubtema={subtemaOpen} />}
        {editingFeedThread && (
          <PostComposer mode="post" isEditing
            initial={{ title: editingFeedThread.title, content: editingFeedThread.content, visibility: editingFeedThread.visibility, mediaFiles: editingFeedThread.media }}
            onSubmit={handleFeedEditSubmit}
            onClose={() => setEditingFeedThread(null)} />
        )}
      </div>
    );
  }

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  // Render as plain flow — unified scroll in App.jsx handles overflow.
  // FeedPanelMobile is inlined (not a sub-component) so React never sees a type
  // change between renders, which would unmount ThreadView and wipe its state.
  return (
    <>
      <div style={{ background: C.surface, minHeight: 400 }}>
        {!openThread ? (
          <>
            {/* Filter bar */}
            <div style={{ padding: "12px 14px 10px" }}>
              <FilterBar onSearch={handleSearch} onFilterChange={handleFilterChange} />
            </div>

            {/* Posts list — flows naturally */}
            <div ref={feedContainerRef} style={{ padding: "0 14px 24px" }}>
              {loadingThreads ? (
                <div style={{ textAlign: "center", padding: "48px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <Loader size={16} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ color: C.textMuted, fontFamily: font, fontSize: 14 }}>Loading posts…</span>
                </div>
              ) : (
                <PostFeed threads={threads} searchQuery={searchQuery} filters={filters} onOpenThread={openThreadView}
                          onEditThread={setEditingFeedThread} onDeleteThread={handleDeleteThread} onShareThread={() => {}} onReportThread={() => {}} />
              )}
            </div>
          </>
        ) : (
          <div style={{ background: C.surface, height: "100vh", display: "flex", flexDirection: "column" }}>
            <ThreadView thread={openThread} onBack={closeThread} isHost={isHost}
              onStatusChange={handleStatusChange}
              onThreadEdited={handleThreadEdited}
              onThreadDeleted={handleDeleteThread}
              showComposer={activeComposer !== null}
              composerMode={activeComposer}
              onHideComposer={closeComposer}
              onSubtemaChange={setSubtemaOpen}
              onAddSubtema={(threadId, sub) => setThreads(prev => prev.map(t => t.id === threadId ? { ...t, subtemas: [...(t.subtemas || []), sub] } : t))}
            />
          </div>
        )}
      </div>
      {isHost && openThread && <GreenFAB {...fabProps} isInSubtema={subtemaOpen} />}
      {editingFeedThread && (
        <PostComposer mode="post" isEditing
          initial={{ title: editingFeedThread.title, content: editingFeedThread.content, visibility: editingFeedThread.visibility, mediaFiles: editingFeedThread.media }}
          onSubmit={handleFeedEditSubmit}
          onClose={() => setEditingFeedThread(null)} />
      )}
    </>
  );
}
