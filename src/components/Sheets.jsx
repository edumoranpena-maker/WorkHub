/**
 * Sheets.jsx — Shared bottom-sheet components
 * Imported by both App.jsx and HomeFeed.jsx
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, Image, ChevronLeft, Send, Type, Smile, Pencil } from "lucide-react";
import { useImageViewer } from "./GlobalImageViewer.jsx";
import { mapFilesToMedia, usePasteAttachments } from "../lib/attachments.js";
import AttachmentGallery from "./AttachmentZone.jsx";

const font = "'DM Sans', sans-serif";
const A    = "#f59e0b"; // Announcements orange
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f", border: "#1c1c2e",
  text: "#eaeaf5", textMuted: "#6a6a82", accent: "#7c4dff", accentLight: "#9d71ff",
  green: "#1ed99a", gold: "#d4a843", red: "#ff4f6a", orange: "#f97316",
};
const springTrans = { type: "spring", stiffness: 380, damping: 38 };

// ─── NewDiffusionSheet ────────────────────────────────────────────────────────
export function NewDiffusionSheet({ onClose, onPublish }) {
  const [postType,   setPostType]   = useState("post"); // post | poll | reveal
  const [text,       setText]       = useState("");
  const [status,     setStatus]     = useState("vigente");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [recording,  setRecording]  = useState(false);
  const [audioURL,   setAudioURL]   = useState(null);
  const [publishing, setPublishing] = useState(false);
  const { openGallery, ViewerPortal } = useImageViewer();
  const mediaRecRef = useRef(null);

  const POST_TYPES = [
    { id: "post",   label: "Post"   },
    { id: "poll",   label: "Poll"   },
    { id: "reveal", label: "Reveal" },
  ];

  const handleFilesAdded = (mapped) => setMediaFiles(prev => [...prev, ...mapped]);
  const removeMedia = (idx) => setMediaFiles(prev => prev.filter((_, i) => i !== idx));
  usePasteAttachments(files => handleFilesAdded(mapFilesToMedia(files)));

  const toggleRecord = async () => {
    if (recording) {
      mediaRecRef.current?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          setAudioURL(URL.createObjectURL(blob));
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecRef.current = rec;
        rec.start();
        setRecording(true);
      } catch { alert("Microphone access denied"); }
    }
  };

  const publish = async () => {
    if (!text.trim() && mediaFiles.length === 0) return;
    setPublishing(true);
    await new Promise(r => setTimeout(r, 500));
    onPublish({ text, postType, status, mediaFiles, audioURL });
    setPublishing(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: C.bg, display: "flex", flexDirection: "column", overflowY: "auto" }}>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${A}30`, flexShrink: 0, background: C.surface, position: "sticky", top: 0, zIndex: 10 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: A, marginRight: 12, display: "flex", alignItems: "center" }}>
          <ChevronLeft size={24} strokeWidth={2.4} />
        </motion.button>
        <span style={{ fontFamily: font, fontSize: 17, fontWeight: 800, color: C.text, flex: 1 }}>New Diffusion</span>
        <motion.button whileTap={{ scale: 0.92 }} onClick={publish}
          disabled={(!text.trim() && mediaFiles.length === 0) || publishing}
          style={{ padding: "8px 18px", borderRadius: 99, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${A}, #d97706)`, color: "#000", fontFamily: font, fontSize: 14, fontWeight: 800 }}>
          {publishing ? "Sending…" : "Difundir"}
        </motion.button>
      </div>

      {/* Post type chips */}
      <div style={{ display: "flex", gap: 8, padding: "14px 16px 10px", borderBottom: `1px solid ${A}20` }}>
        {POST_TYPES.map(t => (
          <button key={t.id} onClick={() => setPostType(t.id)}
            style={{ padding: "8px 18px", borderRadius: 99, border: `1.5px solid ${postType === t.id ? A + "80" : C.border}`, background: postType === t.id ? `${A}18` : "transparent", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: postType === t.id ? A : C.textMuted, transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Textarea */}
        <div>
          <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Write your announcement</p>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={postType === "poll" ? "Ask your question…" : postType === "reveal" ? "Hidden content that members will reveal…" : "Write your announcement…"}
            rows={6}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: C.card, border: `1.5px solid ${text.trim() ? A + "55" : C.border}`, borderRadius: 14, padding: "14px 16px", color: C.text, fontFamily: font, fontSize: 15, lineHeight: 1.65, outline: "none", caretColor: A }} />
        </div>

        {/* Audio recorder */}
        <div>
          <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Grabar Audio</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={toggleRecord}
              style={{ width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: recording ? `linear-gradient(135deg, ${C.red}, #e11d48)` : `${A}22`, boxShadow: recording ? `0 0 0 6px ${C.red}30` : "none", transition: "all 0.2s" }}>
              {recording
                ? <motion.div animate={{ scale: [1, 0.8, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} style={{ width: 18, height: 18, borderRadius: 3, background: "#fff" }} />
                : <Mic size={22} color={A} />}
            </motion.button>
            {recording && <span style={{ fontFamily: font, fontSize: 13, color: C.red, fontWeight: 600 }}>Recording… tap to stop</span>}
            {audioURL && !recording && <audio src={audioURL} controls style={{ flex: 1, height: 36 }} />}
          </div>
        </div>

        {/* Status */}
        <div>
          <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</p>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "vigente", label: "Vigente", color: C.green }, { id: "caducado", label: "Caducado", color: C.red }].map(s => (
              <button key={s.id} onClick={() => setStatus(s.id)}
                style={{ padding: "8px 20px", borderRadius: 99, border: `1.5px solid ${status === s.id ? s.color + "80" : C.border}`, background: status === s.id ? `${s.color}18` : "transparent", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: status === s.id ? s.color : C.textMuted }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Media insert */}
        <div>
          <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Insertar</p>
          <AttachmentGallery
            mediaFiles={mediaFiles}
            onAdd={handleFilesAdded}
            onRemove={removeMedia}
            onOpenViewer={i => openGallery({ items: mediaFiles, startIndex: i })}
            accent={A}
            accept="image/*,video/*"
          />
        </div>

        {/* Tag people */}
        <div style={{ padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontFamily: font, fontSize: 14, color: C.textMuted }}>Tag people… (optional)</span>
          <span style={{ color: C.textMuted }}>›</span>
        </div>

        {/* Publish */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={publish}
          disabled={(!text.trim() && mediaFiles.length === 0) || publishing}
          style={{ width: "100%", height: 52, borderRadius: 16, border: "none", cursor: "pointer", fontFamily: font, fontSize: 16, fontWeight: 800, background: `linear-gradient(135deg, ${A}, #d97706)`, color: "#000", boxShadow: `0 6px 24px ${A}44` }}>
          {publishing ? "Difundiendo…" : "Difundir"}
        </motion.button>
      </div>
      <ViewerPortal />
    </motion.div>
  );
}

// ─── InstagramStoryCreator ────────────────────────────────────────────────────
export function InstagramStoryCreator({ onClose, onPublish }) {
  const [phase,      setPhase]      = useState("gallery"); // gallery | edit
  const [selected,   setSelected]   = useState(null);      // { url, type }
  const [caption,    setCaption]    = useState("");
  const [privacy,    setPrivacy]    = useState("members");
  const [activeEdit, setActiveEdit] = useState(null);      // text|sticker|draw
  const fileRef    = useRef(null);
  const cameraRef  = useRef(null);

  // Mock gallery items
  const GALLERY = [
    { id: 1, url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=70", type: "image" },
    { id: 2, url: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=400&q=70", type: "image" },
    { id: 3, url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=70", type: "image" },
    { id: 4, url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=70", type: "image" },
    { id: 5, url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=70", type: "image" },
    { id: 6, url: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=400&q=70", type: "image" },
  ];

  const PRIVACY_OPTIONS = [
    { id: "public",  label: "Public" },
    { id: "members", label: "Only Members" },
    { id: "followers", label: "Followers" },
  ];

  const EDIT_TOOLS = [
    { id: "text",    icon: Type,    label: "Texto"    },
    { id: "sticker", icon: Smile,   label: "Stickers" },
    { id: "draw",    icon: Pencil,  label: "Draw"     },
  ];

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelected({ url: URL.createObjectURL(f), type: f.type.startsWith("video") ? "video" : "image" });
    setPhase("edit");
  };

  // ── Phase 1: Gallery ────────────────────────────────────────────────────────
  if (phase === "gallery") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 12px", flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <X size={18} />
          </motion.button>
          <span style={{ fontFamily: font, fontSize: 17, fontWeight: 800, color: "#fff", marginLeft: 12, flex: 1 }}>New Story</span>
          {/* Camera / take photo */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => cameraRef.current?.click()}
            title="Take photo/video"
            style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <Image size={18} />
          </motion.button>
        </div>
        <input ref={fileRef}   type="file" accept="image/*,video/*"            style={{ display: "none" }} onChange={handleFileSelect} />
        <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: "none" }} onChange={handleFileSelect} />

        {/* Gallery grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 2px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {GALLERY.map((item, i) => (
              <motion.div key={item.id} whileTap={{ scale: 0.96 }} onClick={() => { setSelected(item); setPhase("edit"); }}
                style={{ position: "relative", aspectRatio: "1/1", cursor: "pointer", overflow: "hidden" }}>
                <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                {i === 0 && (
                  <div style={{ position: "absolute", inset: 0, border: "3px solid #fff" }} />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Phase 2: Edit ───────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", flexDirection: "column" }}>

      {/* Media background — full screen */}
      <div style={{ position: "absolute", inset: 0 }}>
        {selected?.type === "video"
          ? <video src={selected.url} autoPlay loop muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <img src={selected?.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {/* Gradient overlays */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.75) 100%)" }} />
      </div>

      {/* Edit tools — vertical right side */}
      <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", zIndex: 10, display: "flex", flexDirection: "column", gap: 16 }}>
        {EDIT_TOOLS.map(tool => (
          <motion.button key={tool.id} whileTap={{ scale: 0.85 }} onClick={() => setActiveEdit(activeEdit === tool.id ? null : tool.id)}
            style={{ width: 44, height: 44, borderRadius: "50%", background: activeEdit === tool.id ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: `1px solid ${activeEdit === tool.id ? "#fff" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <tool.icon size={19} color="#fff" />
          </motion.button>
        ))}
      </div>

      {/* Back button top-left */}
      <div style={{ position: "absolute", top: 16, left: 14, zIndex: 10 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPhase("gallery")}
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
          <ChevronLeft size={20} />
        </motion.button>
      </div>

      {/* Bottom controls */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, padding: "0 14px 36px" }}>

        {/* Privacy chips */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
          {PRIVACY_OPTIONS.map(p => (
            <button key={p.id} onClick={() => setPrivacy(p.id)}
              style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${privacy === p.id ? "#fff" : "rgba(255,255,255,0.3)"}`, background: privacy === p.id ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.35)", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: "#fff", backdropFilter: "blur(8px)" }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Caption + publish row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption…"
            style={{ flex: 1, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 24, padding: "11px 16px", color: "#fff", fontFamily: font, fontSize: 14, outline: "none" }} />
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => onPublish({ media: selected, caption, privacy })}
            style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.95)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
            <Send size={20} color="#000" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
