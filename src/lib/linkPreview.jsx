/**
 * linkPreview.jsx
 *
 * Shared link-preview detection + UI.
 * Originally lived only inside Post.jsx (used for Update/Subtema composers).
 * Extracted so the Post composer can reuse the exact same auto-detection
 * behaviour instead of the old manual "Link" tab.
 *
 * Exports:
 *   useLinkPreviews(text) -> Array<{ url, title, desc, image, site }>
 *   LinkPreviewCard({ preview, onExpand })
 *   LinkExpandModal({ preview, onClose })
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Link, X } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#13131f", surface: "#0e0e18", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", teal: "#22d3a0",
};

// ─── useLinkPreviews — detects URLs in text, fetches OG meta via allorigins ───
export function useLinkPreviews(text) {
  const [previews, setPreviews] = useState([]);
  const cache = useRef({});

  useEffect(() => {
    const URL_RE = /https?:\/\/[^\s"<>]+/g;
    const urls = [...new Set((text || "").match(URL_RE) || [])].slice(0, 5);
    if (!urls.length) { setPreviews([]); return; }

    let cancelled = false;
    Promise.all(urls.map(async url => {
      if (cache.current[url]) return cache.current[url];
      try {
        // Use allorigins to bypass CORS
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxy, { signal: AbortSignal.timeout(4000) });
        const { contents } = await res.json();
        const doc = new DOMParser().parseFromString(contents, "text/html");
        const m = (prop) =>
          doc.querySelector(`meta[property="${prop}"]`)?.content ||
          doc.querySelector(`meta[name="${prop}"]`)?.content || "";
        const preview = {
          url,
          title: m("og:title") || doc.title || url,
          desc: m("og:description") || m("description") || "",
          image: m("og:image") || "",
          site: new URL(url).hostname.replace("www.", ""),
        };
        cache.current[url] = preview;
        return preview;
      } catch {
        const preview = { url, title: url, desc: "", image: "", site: new URL(url).hostname.replace("www.", "") };
        cache.current[url] = preview;
        return preview;
      }
    })).then(results => {
      if (!cancelled) setPreviews(results.filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [text]);

  return previews;
}

// ─── LinkPreviewCard ──────────────────────────────────────────────────────────
export function LinkPreviewCard({ preview, onExpand }) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={() => onExpand(preview)}
      style={{ flexShrink: 0, width: 220, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      {preview.image ? (
        <img src={preview.image} alt="" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
          onError={e => { e.currentTarget.style.display = "none"; }} />
      ) : (
        <div style={{ width: "100%", height: 60, background: `${C.teal}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Link size={22} color={C.teal} strokeWidth={1.5} />
        </div>
      )}
      <div style={{ padding: "9px 11px 10px" }}>
        <p style={{ margin: "0 0 3px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.text, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.35 }}>{preview.title}</p>
        {preview.desc && <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 10, color: C.textMuted, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4 }}>{preview.desc}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ExternalLink size={9} color={C.teal} />
          <span style={{ fontFamily: font, fontSize: 10, color: C.teal, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.site}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── LinkExpandModal ──────────────────────────────────────────────────────────
export function LinkExpandModal({ preview, onClose }) {
  return (
    <AnimatePresence>
      {preview && (
        <>
          <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }} />
          <motion.div key="card" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{ position: "fixed", inset: "auto 16px", top: "50%", transform: "translateY(-50%)", zIndex: 2001, background: C.card, borderRadius: 22, border: `1px solid ${C.border}`, overflow: "hidden", maxWidth: 480, margin: "0 auto", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
            {preview.image && (
              <img src={preview.image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                onError={e => { e.currentTarget.style.display = "none"; }} />
            )}
            <div style={{ padding: "16px 18px 20px" }}>
              <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>{preview.title}</p>
              {preview.desc && <p style={{ margin: "0 0 14px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{preview.desc}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <a href={preview.url} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.teal}, #0ea876)`, color: "#000", fontFamily: font, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  <ExternalLink size={14} /> Abrir enlace
                </a>
                <button onClick={onClose}
                  style={{ width: 42, height: 42, borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Merge link previews that have an image into a media array so they can be
 * shown inside MediaCarousel as extra slides (type: "link").
 * Used by ThreadView / UpdateBubble / PostCard when rendering saved content.
 */
export function mergeLinksIntoMedia(media = [], links = []) {
  const linkSlides = (links || [])
    .filter(l => l.image)
    .map(l => ({ type: "link", url: l.image, thumb: l.image, linkUrl: l.url, title: l.title }));
  return [...(media || []), ...linkSlides];
}
