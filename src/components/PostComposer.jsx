/**
 * PostComposer.jsx
 *
 * Single composer used for creating AND editing:
 *   - Posts     (mode="post")
 *   - Updates   (mode="update")
 *   - Subtemas  (mode="subtema")
 *
 * Replaces the old NewPostSheet (App.jsx) and ComposerSheet (Post.jsx),
 * which duplicated ~90% of this logic. Editing reuses the exact same form —
 * pass `initial` + `isEditing` and the submit label/behaviour adapts.
 *
 * IMPORTANT: this component does NOT talk to Supabase and does NOT block on
 * network. It validates, packages the data, calls onSubmit(data) once, then
 * immediately calls onClose(). The caller (App.jsx / Post.jsx) is responsible
 * for enqueueing the actual save via publishQueue.jsx so the composer can
 * close instantly while the upload keeps running in the background.
 *
 * Media chips (Imagen / Video / Archivo / Miniatura):
 *   None are highlighted by default. A chip highlights only while content of
 *   that type is attached — pressing it never blocks attaching more of the
 *   same type.
 *
 * Links: no manual chip. Any URL typed in title/content is auto-detected via
 * useLinkPreviews and shown as a preview row (kept out of the DB — the URL
 * lives inside the saved text itself, so the preview is simply re-derived
 * from the same text wherever the post/update is rendered).
 *
 * Visibility: only relevant for mode="post" (Updates/Subtemas always inherit
 * the parent post's visibility — no selector shown for them).
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, X, Plus, Mic, Loader, Layers, CheckSquare, ChevronRight,
  Image as ImageIcon, Video as VideoIcon, Paperclip, ImagePlus, File as FileIcon,
} from "lucide-react";
import { useLinkPreviews, LinkPreviewCard, LinkExpandModal } from "../lib/linkPreview.jsx";
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY } from "../lib/visibility.jsx";
import { useComposerNavLock } from "../lib/composerLock.jsx";
import { useSectionMemory, useClearSectionMemory } from "../lib/workContext.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f",
  border: "#1c1c2e", text: "#fafafa", textMuted: "#8e8e8e",
  teal: "#22d3a0", accent: "#7c4dff", accentLight: "#9d71ff", red: "#ff4f6a",
};

const MEDIA_TABS = [
  { id: "image",     label: "Imagen",    kind: "image",     accept: "image/*", icon: ImageIcon },
  { id: "video",     label: "Video",     kind: "video",     accept: "video/*", icon: VideoIcon },
  { id: "file",      label: "Archivo",   kind: "file",      accept: "*",       icon: Paperclip },
  { id: "thumbnail", label: "Miniatura", kind: "thumbnail", accept: "image/*", icon: ImagePlus },
];

export default function PostComposer({ mode, initial = null, isEditing = false, checklists = [], memoryKey = null, onSubmit, onClose }) {
  const isPost = mode === "post";
  const isSubtema = mode === "subtema";

  // Work Context Persistence: if this exact composer instance (same memoryKey)
  // was left open with a draft in progress within the memory window, restore
  // it exactly — title, content, attached media/files/links, everything.
  // Falls back to `initial` (edit target) or blank (new) only when there's no
  // in-progress draft saved yet.
  const [draft, setDraft] = useSectionMemory(memoryKey || `composer:${mode}:${isEditing ? "edit" : "new"}`, () => ({}));
  const clearMemory = useClearSectionMemory();
  const seeded = (field, fallback) => (draft[field] !== undefined ? draft[field] : fallback);

  const [title, setTitle]           = useState(seeded("title", initial?.title || ""));
  const [content, setContent]       = useState(seeded("content", initial?.content || ""));
  const [mediaFiles, setMediaFiles] = useState(seeded("mediaFiles", initial?.mediaFiles || [])); // [{type,url,file?,existing?}]
  const [thumbnail, setThumbnail]   = useState(seeded("thumbnail", initial?.thumbnail || null));
  const [visibility, setVisibility] = useState(seeded("visibility", initial?.visibility || DEFAULT_VISIBILITY));
  const [attachedChecklist, setAttachedChecklist] = useState(seeded("attachedChecklist", initial?.checklist || null));

  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState(seeded("audioBlob", null));
  const [audioURL, setAudioURL]     = useState(seeded("audioURL", initial?.audio?.url || null));
  const [audioRemoved, setAudioRemoved] = useState(seeded("audioRemoved", false));

  // Keep the shared draft in sync as the user types/attaches — this is what
  // survives switching to another section and coming back within the window.
  useEffect(() => {
    setDraft({ title, content, mediaFiles, thumbnail, visibility, attachedChecklist, audioBlob, audioURL, audioRemoved });
  }, [title, content, mediaFiles, thumbnail, visibility, attachedChecklist, audioBlob, audioURL, audioRemoved]); // eslint-disable-line

  const [showCancel, setShowCancel] = useState(false);
  const [expandedLink, setExpandedLink] = useState(null);

  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef  = useRef(null);
  const thumbRef = useRef(null);
  const mediaRecRef = useRef(null);

  const previews = useLinkPreviews(`${title}\n${content}`);

  // Block section navigation (chips/sidebar/swipe) while an Update or Subtema
  // composer is open — create or edit. Post composer is a fullscreen overlay
  // and isn't part of this lock (per product decision).
  useComposerNavLock(!isPost);

  // ── Dirty-check → only ask for discard confirmation if there's something to lose ──
  const isDirty = isEditing
    ? (
        title !== (initial?.title || "") ||
        content !== (initial?.content || "") ||
        mediaFiles.length !== (initial?.mediaFiles?.length || 0) ||
        thumbnail !== (initial?.thumbnail || null) ||
        !!audioBlob || audioRemoved
      )
    : (
        title.trim().length > 0 ||
        content.trim().length > 0 ||
        mediaFiles.length > 0 ||
        !!audioURL ||
        recording
      );

  const requestClose = () => { isDirty ? setShowCancel(true) : onClose(); };

  // ── Media handling ──────────────────────────────────────────────────────────
  const hasType = (kind) => kind === "thumbnail" ? !!thumbnail : mediaFiles.some(m => m.type === kind);

  const pick = (tab) => {
    if (tab.kind === "thumbnail") { thumbRef.current?.click(); return; }
    const ref = tab.kind === "image" ? imageRef : tab.kind === "video" ? videoRef : fileRef;
    ref.current && (ref.current.accept = tab.accept);
    ref.current?.click();
  };

  const handleFiles = (e, kind) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map(f => ({ type: kind, url: URL.createObjectURL(f), file: f, name: f.name }));
    setMediaFiles(prev => [...prev, ...mapped]);
    if (isPost && !thumbnail && kind === "image" && mapped.length > 0) setThumbnail(mapped[0].url);
    e.target.value = "";
  };

  const handleThumb = (e) => {
    const f = e.target.files?.[0];
    if (f) setThumbnail(URL.createObjectURL(f));
    e.target.value = "";
  };

  const removeMedia = (idx) => setMediaFiles(prev => prev.filter((_, i) => i !== idx));

  // ── Audio ────────────────────────────────────────────────────────────────────
  const toggleRecord = async () => {
    if (recording) { mediaRecRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        setAudioRemoved(false);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecRef.current = rec;
      rec.start();
      setRecording(true);
    } catch { alert("Microphone access denied"); }
  };

  const removeAudio = () => { setAudioBlob(null); setAudioURL(null); setAudioRemoved(true); };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const canSubmit = isSubtema
    ? title.trim().length > 0
    : (content.trim().length > 0 || title.trim().length > 0 || mediaFiles.length > 0 || audioURL);

  const submit = () => {
    if (!canSubmit) return;
    const audio = audioBlob
      ? { blob: audioBlob }
      : audioRemoved
        ? null
        : (initial?.audio || null);

    onSubmit({
      mode,
      title: title.trim(),
      content: content.trim(),
      mediaFiles,
      thumbnail,
      audio,
      visibility,
      checklist: attachedChecklist,
      links: previews,
    });
    clearMemory(memoryKey || `composer:${mode}:${isEditing ? "edit" : "new"}`);
    onClose();
  };

  const labels = {
    post:    { header: isEditing ? "Editar Post" : "New Post",        submit: isEditing ? "Guardar cambios" : "Share" },
    update:  { header: isEditing ? "Editar Update" : "Nuevo Update",   submit: isEditing ? "Guardar cambios" : "Publicar Update" },
    subtema: { header: isEditing ? "Editar Subtema" : "Crear Subtema", submit: isEditing ? "Guardar cambios" : "Crear Subtema" },
  }[mode];

  const HiddenInputs = (
    <>
      <input ref={imageRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleFiles(e, "image")} />
      <input ref={videoRef} type="file" multiple accept="video/*" style={{ display: "none" }} onChange={e => handleFiles(e, "video")} />
      <input ref={fileRef}  type="file" multiple style={{ display: "none" }} onChange={e => handleFiles(e, "file")} />
      <input ref={thumbRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleThumb} />
    </>
  );

  // ── Shared blocks ────────────────────────────────────────────────────────────
  const MediaChips = () => (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      {(isPost ? MEDIA_TABS : MEDIA_TABS.filter(t => t.kind !== "thumbnail")).map(tab => {
        const active = hasType(tab.kind);
        const Icon = tab.icon;
        return (
          <motion.button key={tab.id} whileTap={{ scale: 0.93 }} onClick={() => pick(tab)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
              background: active ? `${C.teal}16` : C.surface,
              border: `1px solid ${active ? C.teal + "55" : C.border}`,
              borderRadius: 99, padding: "7px 14px", cursor: "pointer",
              color: active ? C.teal : C.textMuted, fontFamily: font, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            }}>
            <Icon size={13} strokeWidth={2} />
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );

  const MediaPreviews = () => (
    mediaFiles.length > 0 && (
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {mediaFiles.map((m, i) => (
          <div key={i} style={{ flexShrink: 0, position: "relative", width: 84, height: 84, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {m.type === "image" && <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            {m.type === "video" && <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            {m.type === "file" && (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: C.surface, padding: 6 }}>
                <FileIcon size={20} color={C.textMuted} />
                <span style={{ fontFamily: font, fontSize: 9, color: C.textMuted, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{m.name || "Archivo"}</span>
              </div>
            )}
            <button onClick={() => removeMedia(i)}
              style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.72)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    )
  );

  const LinkPreviews = () => (
    previews.length > 0 && (
      <div>
        <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
          Links detectados
        </p>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {previews.map((p, i) => <LinkPreviewCard key={i} preview={p} onExpand={setExpandedLink} />)}
        </div>
      </div>
    )
  );

  const VisibilitySelector = () => (
    isPost && (
      <div>
        <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visibilidad</p>
        <div style={{ display: "flex", gap: 8 }}>
          {VISIBILITY_OPTIONS.map(v => {
            const Icon = v.icon;
            const active = visibility === v.id;
            return (
              <motion.button key={v.id} whileTap={{ scale: 0.92 }} onClick={() => setVisibility(v.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 99, border: `1.5px solid ${active ? v.color + "80" : C.border}`, background: active ? `${v.color}18` : "transparent", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: active ? v.color : C.textMuted }}>
                <Icon size={13} strokeWidth={2} />
                {v.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    )
  );

  const ChecklistAttach = () => (
    isPost && checklists.length > 0 && (
      <div>
        <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Añadir Checklist <span style={{ fontWeight: 400, textTransform: "none" }}>(opcional)</span>
        </p>
        {attachedChecklist ? (
          <div style={{ background: `${C.teal}08`, border: `1px solid ${C.teal}30`, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckSquare size={14} color={C.teal} strokeWidth={2} />
                <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{attachedChecklist.name}</span>
                <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{attachedChecklist.items.length} items</span>
              </div>
              <button onClick={() => setAttachedChecklist(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: 2, display: "flex" }}><X size={14} /></button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {checklists.map(cl => (
              <button key={cl.id} onClick={() => setAttachedChecklist({ ...cl, id: `cl_copy_${Date.now()}`, items: cl.items.map(it => ({ ...it, checked: false })) })}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <CheckSquare size={14} color={C.teal} strokeWidth={2} />
                <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{cl.name}</span>
                <span style={{ fontFamily: font, fontSize: 11, color: C.textMuted }}>{cl.items.length} items</span>
                <ChevronRight size={14} color={C.textMuted} />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  );

  const AudioRecorder = () => (
    <div>
      <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Audio</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={toggleRecord}
          style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: recording ? `linear-gradient(135deg, ${C.red}, #e11d48)` : `${C.teal}20`, boxShadow: recording ? `0 0 0 6px ${C.red}30` : "none", transition: "all 0.2s" }}>
          {recording
            ? <motion.div animate={{ scale: [1, 0.8, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} style={{ width: 14, height: 14, borderRadius: 3, background: "#fff" }} />
            : <Mic size={18} color={C.teal} />}
        </motion.button>
        {recording && <span style={{ fontFamily: font, fontSize: 13, color: C.red, fontWeight: 600 }}>Grabando… (toca para detener)</span>}
        {audioURL && !recording && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <audio src={audioURL} controls style={{ flex: 1, height: 34, borderRadius: 8 }} />
            <button onClick={removeAudio} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );

  const DiscardConfirmDialog = () => (
    showCancel && (
      <div style={{ position: "fixed", inset: 0, zIndex: 2600, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCancel(false)}>
        <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, width: 280 }}>
          <p style={{ margin: "0 0 16px", fontFamily: font, fontSize: 14, color: C.text }}>¿Descartar {isEditing ? "los cambios" : "esta publicación"}?</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowCancel(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600 }}>Seguir editando</button>
            <button onClick={() => { clearMemory(memoryKey || `composer:${mode}:${isEditing ? "edit" : "new"}`); onClose(); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: C.red, color: "#fff", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700 }}>Descartar</button>
          </div>
        </div>
      </div>
    )
  );

  // ── mode="post" → fullscreen sheet (matches old NewPostSheet layout) ─────────
  if (isPost) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 2000, background: C.bg, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.surface, position: "sticky", top: 0, zIndex: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={requestClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.accentLight, marginRight: 12, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={24} strokeWidth={2.4} />
          </motion.button>
          <span style={{ fontFamily: font, fontSize: 17, fontWeight: 800, color: C.text, flex: 1 }}>{labels.header}</span>
          <motion.button whileTap={{ scale: 0.92 }} onClick={submit} disabled={!canSubmit}
            style={{ padding: "8px 18px", borderRadius: 99, border: "none", cursor: canSubmit ? "pointer" : "default", background: canSubmit ? `linear-gradient(135deg, ${C.accent}, #5c2fff)` : C.border, color: canSubmit ? "#fff" : C.textMuted, fontFamily: font, fontSize: 14, fontWeight: 700 }}>
            {labels.submit}
          </motion.button>
        </div>

        <div style={{ padding: "14px 16px 4px", borderBottom: `1px solid ${C.border}` }}><MediaChips /></div>
        {HiddenInputs}

        <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          {thumbnail && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={thumbnail} alt="thumbnail" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }} />
              <div>
                <p style={{ margin: 0, fontFamily: font, fontSize: 12, fontWeight: 700, color: C.text }}>Miniatura</p>
                <button onClick={() => setThumbnail(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 11, padding: 0 }}>Quitar</button>
              </div>
            </div>
          )}

          <MediaPreviews />

          <div>
            <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Title</p>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. EURUSD Analysis"
              style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1.5px solid ${title.trim() ? C.accent + "55" : C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontFamily: font, fontSize: 15, fontWeight: 700, outline: "none" }} />
          </div>

          <div>
            <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</p>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Describe tu setup, análisis, o actualización…" rows={5}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: C.card, border: `1.5px solid ${content.trim() ? C.accent + "44" : C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.6, outline: "none", caretColor: C.accentLight }} />
          </div>

          <AudioRecorder />
          <LinkPreviews />
          <VisibilitySelector />
          <ChecklistAttach />
        </div>

        <DiscardConfirmDialog />

        <LinkExpandModal preview={expandedLink} onClose={() => setExpandedLink(null)} />
      </motion.div>
    );
  }

  // ── mode="update" | "subtema" → bottom sheet (matches old ComposerSheet) ─────
  const accent = C.green || C.teal;
  const HeaderIcon = mode === "update" ? Plus : Layers;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => e.target === e.currentTarget && requestClose()}
        style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8,8,14,0.88)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>

        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          onClick={e => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 520, background: C.card, borderRadius: "24px 24px 0 0", border: `1px solid ${C.teal}28`, borderBottom: "none", padding: "0 0 36px", display: "flex", flexDirection: "column", maxHeight: "92vh", overflow: "hidden" }}>

          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px 14px", flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${C.teal}20`, border: `1px solid ${C.teal}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HeaderIcon size={15} color={C.teal} />
              </div>
              <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text }}>{labels.header}</span>
            </div>
            <button onClick={requestClose} style={{ width: 30, height: 30, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {isSubtema && (
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del subtema…" autoFocus
                style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1.5px solid ${title ? C.teal + "55" : C.border}`, borderRadius: 14, padding: "11px 14px", color: C.text, fontFamily: font, fontSize: 14, fontWeight: 700, outline: "none", transition: "border-color 0.2s" }} />
            )}

            <div style={{ position: "relative" }}>
              {recording ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: `${C.red}12`, border: `1.5px solid ${C.red}40`, borderRadius: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: font, fontSize: 14, color: C.red, fontWeight: 600, flex: 1 }}>Grabando…</span>
                  <button onClick={toggleRecord} style={{ background: C.red, border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700 }}>Detener</button>
                </div>
              ) : (
                <>
                  <textarea value={content} onChange={e => setContent(e.target.value)}
                    placeholder={mode === "update" ? "Comparte una actualización…" : "Descripción (opcional)…"}
                    rows={mode === "update" ? 5 : 4} autoFocus={mode === "update"}
                    style={{ width: "100%", boxSizing: "border-box", resize: "none", background: C.surface, border: `1.5px solid ${content.trim() ? C.teal + "44" : C.border}`, borderRadius: 16, padding: "12px 48px 38px 14px", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.65, outline: "none", transition: "border-color 0.2s", caretColor: C.teal }} />
                  <motion.button whileTap={{ scale: 0.88 }} onClick={toggleRecord}
                    style={{ position: "absolute", bottom: 10, right: 10, width: 34, height: 34, borderRadius: 10, background: `${C.teal}15`, border: `1px solid ${C.teal}35`, color: C.teal, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Mic size={15} strokeWidth={2} />
                  </motion.button>
                </>
              )}
            </div>

            {audioURL && !recording && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <audio src={audioURL} controls style={{ flex: 1, height: 34, borderRadius: 8 }} />
                <button onClick={removeAudio} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}><X size={14} /></button>
              </div>
            )}

            <MediaChips />
            {HiddenInputs}
            <MediaPreviews />
            <LinkPreviews />
            <div style={{ height: 8 }} />
          </div>

          <div style={{ padding: "12px 18px 0", flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={requestClose}
                style={{ flex: 1, height: 46, borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", color: C.textMuted, fontFamily: font, fontSize: 14, fontWeight: 600 }}>
                Cancelar
              </button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={submit} disabled={!canSubmit}
                style={{ flex: 2, height: 46, borderRadius: 14, border: "none", cursor: canSubmit ? "pointer" : "default", fontFamily: font, fontSize: 14, fontWeight: 800, background: canSubmit ? `linear-gradient(135deg, ${C.teal}, #0ea876)` : C.border, color: canSubmit ? "#000" : C.textMuted, transition: "all 0.2s" }}>
                {labels.submit}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <DiscardConfirmDialog />
      <LinkExpandModal preview={expandedLink} onClose={() => setExpandedLink(null)} />
    </>
  );
}
