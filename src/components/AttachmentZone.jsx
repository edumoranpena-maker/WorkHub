/**
 * AttachmentZone.jsx
 *
 * The modern attachment experience that replaces the old Imagen/Video/
 * Archivo chips in every composer. One shared component so the interaction
 * (drag & drop, click-to-pick, the "+" tile, the drop overlay) is identical
 * everywhere, while each composer keeps rendering it inside its own visual
 * shell — this component has no opinion about the composer's layout, header,
 * or colors beyond the accent used for the active-drag state.
 *
 * Two states:
 *   - Empty (no files yet): a single dashed drop zone, click or drop to add.
 *   - Has files: a wrapping gallery grid of thumbnails + a trailing "+" tile.
 *     Drag & drop stays live across the WHOLE gallery, not just the "+" tile
 *     — dropping anywhere in it still adds files at the end, existing ones
 *     are never replaced.
 *
 * Paste is intentionally NOT handled in here — see usePasteAttachments in
 * lib/attachments.js, which each composer calls directly at its own root so
 * paste works regardless of which field currently has focus.
 */
import { useRef, useCallback } from "react";
import { UploadCloud, Plus, X, File as FileIcon } from "lucide-react";
import { mapFilesToMedia, useDragAndDrop } from "../lib/attachments.js";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#08080e", surface: "#0e0e18", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e",
};

// BRAND_ACCENT (#2DD4BF) is the default — this is new UI, born on the new
// PlanSpace palette from day one, per the ongoing brand transition. Callers
// can still override it (e.g. to match Announcements' orange identity)
// without the component needing to know about any particular composer.
const DEFAULT_ACCENT = "#2DD4BF";

export default function AttachmentGallery({ mediaFiles, onAdd, onRemove, onOpenViewer, accent = DEFAULT_ACCENT, accept = "*/*" }) {
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    if (files && files.length > 0) onAdd(mapFilesToMedia(files));
  }, [onAdd]);

  const { dragActive, dropHandlers } = useDragAndDrop(handleFiles);

  const openPicker = () => inputRef.current?.click();
  const onInputChange = (e) => { handleFiles(e.target.files); e.target.value = ""; };

  const hasFiles = mediaFiles.length > 0;

  return (
    <div style={{ position: "relative" }} {...dropHandlers}>
      <input ref={inputRef} type="file" multiple accept={accept} style={{ display: "none" }} onChange={onInputChange} />

      {!hasFiles ? (
        // ── Empty state — the whole zone is the drop target ──────────────
        <div onClick={openPicker}
          style={{
            cursor: "pointer", borderRadius: 16, padding: "26px 16px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            border: `1.5px dashed ${dragActive ? accent : C.border}`,
            background: dragActive ? `${accent}0f` : "transparent",
            transition: "border-color 0.15s, background 0.15s",
          }}>
          <UploadCloud size={22} color={dragActive ? accent : C.textMuted} strokeWidth={1.8} />
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 600, color: dragActive ? accent : C.text, textAlign: "center" }}>
            Arrastra imágenes, videos o archivos aquí
          </p>
          <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textMuted }}>o haz clic para seleccionar</p>
        </div>
      ) : (
        // ── Gallery state — grid of thumbnails + trailing "+" tile ───────
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {mediaFiles.map((m, i) => (
            <div key={i} style={{ position: "relative", width: 84, height: 84, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
              {m.type === "image" && (
                <img src={m.url} alt="" onClick={() => onOpenViewer?.(i)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", cursor: onOpenViewer ? "pointer" : "default" }} />
              )}
              {m.type === "video" && (
                <video src={m.url} onClick={() => onOpenViewer?.(i)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", cursor: onOpenViewer ? "pointer" : "default" }} />
              )}
              {m.type === "file" && (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: C.surface, padding: 6 }}>
                  <FileIcon size={20} color={C.textMuted} />
                  <span style={{ fontFamily: font, fontSize: 9, color: C.textMuted, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{m.name || "Archivo"}</span>
                </div>
              )}
              <button onClick={() => onRemove(i)}
                style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.72)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <X size={11} />
              </button>
            </div>
          ))}

          {/* Always-present "+" tile — the gallery never stops accepting more */}
          <button onClick={openPicker}
            style={{ width: 84, height: 84, borderRadius: 12, border: `1.5px dashed ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.textMuted }}>
            <Plus size={20} strokeWidth={2.2} />
          </button>

          {/* Drop overlay — covers the whole gallery (not just the "+" tile),
              so dropping anywhere on top of existing attachments still reads
              as "add more", never as "replace". */}
          {dragActive && (
            <div style={{ position: "absolute", inset: -6, borderRadius: 16, border: `2px dashed ${accent}`, background: `${accent}14`, backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: accent, background: C.bg, padding: "6px 14px", borderRadius: 99, border: `1px solid ${accent}55` }}>
                Suelta para agregar
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
