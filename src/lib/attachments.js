/**
 * attachments.js
 *
 * Shared logic behind PlanSpace's attachment system (drag & drop, click-to-
 * pick, paste-to-attach). Used by every composer that accepts media
 * (PostComposer, NewDiffusionSheet) so the interaction is identical
 * everywhere even though each composer keeps its own visual identity.
 *
 * Nothing here talks to Supabase or uploads anything — same contract as the
 * rest of the composer layer: this only turns raw browser File objects into
 * the { type, url, file, name } shape the composers already store in
 * mediaFiles, via local blob URLs (URL.createObjectURL). The actual upload
 * still happens wherever it already did (publishQueue, on submit).
 */
import { useState, useRef, useCallback, useEffect } from "react";

// Raw File[] (from an <input>, a drop event, or a paste event) → the
// { type, url, file, name } shape every composer's mediaFiles array expects.
// `type` is inferred from the MIME type: "image" | "video" | "file" (anything
// else — PDFs, docs, zips, etc).
export function mapFilesToMedia(files) {
  return Array.from(files || []).map(f => ({
    type: f.type?.startsWith("image/") ? "image" : f.type?.startsWith("video/") ? "video" : "file",
    url: URL.createObjectURL(f),
    file: f,
    name: f.name,
  }));
}

// Drag & drop bindings for a single drop zone. In practice this only ever
// fires from real OS drag events (a mouse dragging files from Finder/
// Explorer/the browser), which is why "Solo Web" in the product ask doesn't
// need an explicit platform check here — touch interactions on mobile simply
// never emit these events, so the exact same bindings are inert there.
//
// counter.current handles the classic drag&drop-over-nested-elements problem:
// dragenter/dragleave fire once per descendant element as the cursor moves
// over them, so a naive boolean flips off every time the cursor crosses an
// inner element's boundary. Counting enter/leave pairs keeps `dragActive`
// true for as long as the cursor is anywhere inside the zone, however many
// nested children (thumbnails, the "+" tile, etc.) it passes over.
export function useDragAndDrop(onFiles) {
  const [dragActive, setDragActive] = useState(false);
  const counter = useRef(0);

  const onDragEnter = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    counter.current += 1;
    setDragActive(true);
  }, []);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setDragActive(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    counter.current = 0;
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) onFiles(Array.from(files));
  }, [onFiles]);

  return { dragActive, dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

// Paste-to-attach — Ctrl+V / Cmd+V (or the mobile browser's paste action,
// where supported). Listens at the window level for the composer's whole
// lifetime rather than on a single input, so it works no matter which field
// currently has focus (title, content, a bottom-sheet textarea, etc) — "todos
// los composers deben soportar pegar multimedia" without needing a dedicated
// paste target.
//
// Only intercepts the paste when the clipboard actually contains an image or
// video (screenshots, images copied from a browser tab or another app all
// arrive this way). Any other paste (plain text, rich text) is left alone —
// no preventDefault — so normal text pasting into the composer's fields is
// completely unaffected.
export function usePasteAttachments(onFiles, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handlePaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        onFiles(files);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onFiles, enabled]);
}
