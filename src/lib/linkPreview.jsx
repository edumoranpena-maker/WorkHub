/**
 * linkPreview.jsx
 *
 * Shared link-preview detection + UI.
 * Originally lived only inside Post.jsx (used for Update/Subtema composers).
 * Extracted so the Post composer can reuse the exact same auto-detection
 * behaviour instead of the old manual "Link" tab.
 *
 * Platform-aware (see linkPlatforms.js for detection/embed-URL logic):
 *   - YouTube: official oEmbed for title/author/thumbnail, plays in-app via
 *     the official youtube.com/embed iframe. Never downloaded/re-hosted.
 *   - Google Drive: public thumbnail + official file/d/.../preview iframe
 *     (works for anything shared "anyone with the link"), title best-effort.
 *   - TikTok / X: official oEmbed for title/author (TikTok also gives a
 *     thumbnail). No in-app player requested for these — card links out.
 *   - Instagram / Facebook: no usable public oEmbed without an app token,
 *     falls back to best-effort Open Graph scraping.
 *   - Everything else: the original generic Open Graph scrape, now also the
 *     fallback every other platform's enrichment step is built on.
 * Every platform fetcher degrades gracefully — a failed/blocked fetch still
 * returns a real, presentable card (branded fallback title, or the original
 * OG-scrape-only card for generic web), never a broken or empty state.
 *
 * Exports:
 *   useLinkPreviews(text) -> Array<{ url, title, desc, image, site, platform, embed, author }>
 *   useLinkPreviewsBatch(entries: [{id,text}]) -> { [id]: preview[] }
 *   LinkifiedText({ text })              -> renders text with clickable <a> links
 *   LinkPreviewCard({ preview, onExpand })
 *   LinkExpandModal({ preview, onClose })
 *   mergeLinksIntoMedia(media, links)
 */

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Link, X, Play } from "lucide-react";
import {
  detectPlatform, parseYouTubeId, parseGoogleDriveId,
  youTubeEmbedUrl, youTubeThumbnailUrl, googleDriveEmbedUrl, googleDriveThumbnailUrl,
  PLATFORMS, PLATFORM_LABELS,
} from "./linkPlatforms.js";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#13131f", surface: "#0e0e18", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", teal: "#22d3a0",
};

const URL_RE = /https?:\/\/[^\s"<>]+/g;

function extractUrls(text) {
  return [...new Set((text || "").match(URL_RE) || [])].slice(0, 5);
}

// Shared by every useLinkPreviews/useLinkPreviewsBatch instance across the
// whole app — a single URL is only ever fetched once, no matter how many
// components (a content's own local hook, plus ThreadView's batch hook for
// the fullscreen sequence) end up asking for it.
const globalPreviewCache = {};

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// Generic Open Graph scrape via allorigins (bypasses CORS for arbitrary
// sites). This is the fallback path for everything: the WEB platform's own
// preview, AND best-effort enrichment for platforms that have no public
// oEmbed (Instagram, Facebook, Google Drive's file title). Every caller
// below tolerates this failing — most sites work, some actively block
// scraping, and that's fine because every platform fetcher already has a
// sensible branded fallback that doesn't depend on it.
async function fetchOgMeta(url) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxy, { signal: AbortSignal.timeout(4000) });
  const { contents } = await res.json();
  const doc = new DOMParser().parseFromString(contents, "text/html");
  const m = (prop) =>
    doc.querySelector(`meta[property="${prop}"]`)?.content ||
    doc.querySelector(`meta[name="${prop}"]`)?.content || "";
  return {
    title: m("og:title") || doc.title || "",
    desc: m("og:description") || m("description") || "",
    image: m("og:image") || "",
    site: m("og:site_name") || "",
  };
}

// ── YouTube ── official oEmbed endpoint: public, CORS-enabled, no proxy
// needed. Gives us the real title/author/thumbnail; the video ID (parsed
// locally, doesn't depend on the network at all) is what makes it playable
// in-app via the official embed — never downloaded or re-hosted.
async function fetchYouTubePreview(url) {
  const videoId = parseYouTubeId(url);
  const base = {
    url, platform: PLATFORMS.YOUTUBE, site: PLATFORM_LABELS[PLATFORMS.YOUTUBE], author: "", desc: "",
    embed: videoId ? { type: "youtube", videoId, embedUrl: youTubeEmbedUrl(videoId) } : null,
    image: videoId ? youTubeThumbnailUrl(videoId) : "",
    title: "Video de YouTube",
  };
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error("oembed failed");
    const data = await res.json();
    return { ...base, title: data.title || base.title, author: data.author_name || "", image: data.thumbnail_url || base.image };
  } catch {
    return base; // still playable — the embed URL only depends on the videoId, parsed locally above
  }
}

// ── TikTok ── also has a public, CORS-enabled oEmbed. No official in-app
// embed player is requested for TikTok (per spec — preview + "Abrir en
// TikTok" only), so this only ever enriches the CARD, never sets `embed`.
async function fetchTikTokPreview(url) {
  const base = { url, platform: PLATFORMS.TIKTOK, site: PLATFORM_LABELS[PLATFORMS.TIKTOK], embed: null, image: "", title: "Video de TikTok", desc: "", author: "" };
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error("oembed failed");
    const data = await res.json();
    return { ...base, title: data.title || base.title, author: data.author_name || "", image: data.thumbnail_url || "" };
  } catch {
    return base;
  }
}

// ── X (Twitter) ── publish.twitter.com's oEmbed is public/CORS-enabled and
// gives us the author, but never a raw thumbnail URL — a best-effort OG
// scrape fills that in when it isn't blocked.
async function fetchXPreview(url) {
  const base = { url, platform: PLATFORMS.X, site: PLATFORM_LABELS[PLATFORMS.X], embed: null, image: "", title: "Publicación en X", desc: "", author: "" };
  try {
    const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error("oembed failed");
    const data = await res.json();
    let image = "";
    try { image = (await fetchOgMeta(url)).image; } catch { /* best-effort only */ }
    return { ...base, author: data.author_name || "", image };
  } catch {
    return base;
  }
}

// ── Instagram ── Meta's oEmbed now requires an authenticated app token, so
// it isn't usable client-side here — best-effort OG scrape only, with a
// branded fallback when Instagram blocks the scrape (common).
async function fetchInstagramPreview(url) {
  const base = { url, platform: PLATFORMS.INSTAGRAM, site: PLATFORM_LABELS[PLATFORMS.INSTAGRAM], embed: null, image: "", title: "Publicación en Instagram", desc: "", author: "" };
  try {
    const og = await fetchOgMeta(url);
    return { ...base, title: og.title || base.title, desc: og.desc, image: og.image };
  } catch {
    return base;
  }
}

// ── Facebook ── same story as Instagram — no usable public oEmbed without
// an app token, OG scrape is best-effort with a branded fallback.
async function fetchFacebookPreview(url) {
  const base = { url, platform: PLATFORMS.FACEBOOK, site: PLATFORM_LABELS[PLATFORMS.FACEBOOK], embed: null, image: "", title: "Publicación en Facebook", desc: "", author: "" };
  try {
    const og = await fetchOgMeta(url);
    return { ...base, title: og.title || base.title, desc: og.desc, image: og.image };
  } catch {
    return base;
  }
}

// ── Google Drive ── no official metadata API usable without a key, but two
// PUBLIC, unauthenticated endpoints cover the actual UX needs: a thumbnail
// (drive.google.com/thumbnail) and an official embeddable preview iframe
// (drive.google.com/file/d/.../preview) — both work for anything shared
// "anyone with the link", no download/re-hosting involved. Title is
// best-effort via OG scrape of the public share page.
async function fetchGoogleDrivePreview(url) {
  const fileId = parseGoogleDriveId(url);
  const base = {
    url, platform: PLATFORMS.GDRIVE, site: PLATFORM_LABELS[PLATFORMS.GDRIVE], author: "", desc: "",
    embed: fileId ? { type: "gdrive", fileId, embedUrl: googleDriveEmbedUrl(fileId) } : null,
    image: fileId ? googleDriveThumbnailUrl(fileId) : "",
    title: "Archivo de Google Drive",
  };
  if (!fileId) return base;
  try {
    const og = await fetchOgMeta(url);
    return { ...base, title: og.title || base.title, image: og.image || base.image };
  } catch {
    return base; // still previewable/embeddable — thumbnail/embed URLs only depend on fileId
  }
}

// ── Generic web ── the original behavior, now also the fallback every
// other platform's OG-scrape step is built on.
async function fetchGenericWebPreview(url) {
  const site = hostnameOf(url);
  try {
    const og = await fetchOgMeta(url);
    return { url, platform: PLATFORMS.WEB, embed: null, author: "", title: og.title || url, desc: og.desc, image: og.image, site: og.site || site };
  } catch {
    // Elegant fallback — a real card (domain + generic link icon), never a
    // broken image or an empty title.
    return { url, platform: PLATFORMS.WEB, embed: null, author: "", title: url, desc: "", image: "", site };
  }
}

async function fetchPreviewForUrl(url) {
  switch (detectPlatform(url)) {
    case PLATFORMS.YOUTUBE:   return fetchYouTubePreview(url);
    case PLATFORMS.GDRIVE:    return fetchGoogleDrivePreview(url);
    case PLATFORMS.TIKTOK:    return fetchTikTokPreview(url);
    case PLATFORMS.X:         return fetchXPreview(url);
    case PLATFORMS.INSTAGRAM: return fetchInstagramPreview(url);
    case PLATFORMS.FACEBOOK:  return fetchFacebookPreview(url);
    default:                  return fetchGenericWebPreview(url);
  }
}

// Shared by useLinkPreviews and useLinkPreviewsBatch below — one fetch+cache
// implementation, not two. Routes each URL to its platform-specific fetcher
// above; every one of those has its own internal fallback, so this only
// needs a final safety net for something router-level going wrong.
async function fetchPreviewsForUrls(urls, cache = globalPreviewCache) {
  return Promise.all(urls.map(async url => {
    if (cache[url]) return cache[url];
    try {
      const preview = await fetchPreviewForUrl(url);
      cache[url] = preview;
      return preview;
    } catch {
      const preview = { url, platform: detectPlatform(url), embed: null, author: "", title: url, desc: "", image: "", site: hostnameOf(url) };
      cache[url] = preview;
      return preview;
    }
  }));
}

// ─── LinkifiedText — renders plain text with URLs turned into clickable links ─
// This is the piece that was missing: useLinkPreviews/mergeLinksIntoMedia only
// ever fed the media carousel — the actual <p>{content}</p> shown in Posts,
// Updates and Subtemas was still a plain, unclickable text node.
export function LinkifiedText({ text, linkColor = C.teal }) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  const urls = text.match(URL_RE) || [];
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {urls[i] && (
            <a
              href={urls[i]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: linkColor, textDecoration: "underline", textUnderlineOffset: 2, wordBreak: "break-all" }}
            >
              {urls[i]}
            </a>
          )}
        </Fragment>
      ))}
    </>
  );
}

// ─── useLinkPreviews — detects URLs in text, fetches OG meta via allorigins ───
export function useLinkPreviews(text) {
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = extractUrls(text);
    if (!urls.length) { setPreviews([]); return; }

    let cancelled = false;
    fetchPreviewsForUrls(urls).then(results => {
      if (!cancelled) setPreviews(results.filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [text]);

  return previews;
}

// ─── useLinkPreviewsBatch — same detection/fetch/cache, for MANY contents ───
// useLinkPreviews takes one text and is meant to be called once per
// component. Some callers (ThreadView, building the fullscreen viewer's
// cross-content sequence) need previews for a dynamic number of content
// pieces — the root Post, every Update, every Subtema, every Subtema's own
// Updates — and can't call useLinkPreviews in a loop without breaking the
// rules of hooks (a variable number of hook calls per render). This is that:
// ONE hook call, any number of contents.
//
// entries: Array<{ id, text }>  →  returns { [id]: preview[] }
export function useLinkPreviewsBatch(entries) {
  const [byId, setById] = useState({});
  // Entries is a fresh array every render — key off the actual ids+texts so
  // the effect only re-runs when content genuinely changed.
  const key = entries.map(e => `${e.id}:${e.text || ""}`).join("\u241F");

  useEffect(() => {
    let cancelled = false;
    Promise.all(entries.map(async ({ id, text }) => {
      const urls = extractUrls(text);
      if (!urls.length) return [id, []];
      const results = await fetchPreviewsForUrls(urls);
      return [id, results.filter(Boolean)];
    })).then(pairs => {
      if (!cancelled) setById(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return byId;
}

// ─── LinkPreviewCard ──────────────────────────────────────────────────────────
export function LinkPreviewCard({ preview, onExpand }) {
  const playable = !!preview.embed;
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={() => onExpand(preview)}
      style={{ flexShrink: 0, width: 220, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        {preview.image ? (
          <img src={preview.image} alt="" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
            onError={e => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div style={{ width: "100%", height: 60, background: `${C.teal}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Link size={22} color={C.teal} strokeWidth={1.5} />
          </div>
        )}
        {/* Play overlay — signals "opens inside Plantion" for YouTube/Drive,
            vs. a plain card that just opens the original URL for everything
            else. Purely a visual cue; the actual embed lives in
            LinkExpandModal/LinkPane, not here. */}
        {playable && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={14} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: "9px 11px 10px" }}>
        <p style={{ margin: "0 0 3px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.text, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.35 }}>{preview.title}</p>
        {preview.desc && <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 10, color: C.textMuted, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4 }}>{preview.desc}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ExternalLink size={9} color={C.teal} />
          <span style={{ fontFamily: font, fontSize: 10, color: C.teal, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {preview.author ? `${preview.site} · ${preview.author}` : preview.site}
          </span>
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
            {/* Official embed (YouTube/Drive) — real in-app playback/viewing,
                nothing downloaded or re-hosted. Everything else falls back
                to the static preview image, same as before. */}
            {preview.embed ? (
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000" }}>
                <iframe
                  src={preview.embed.embedUrl}
                  title={preview.title || "Embedded content"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
            ) : preview.image && (
              <img src={preview.image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                onError={e => { e.currentTarget.style.display = "none"; }} />
            )}
            <div style={{ padding: "16px 18px 20px" }}>
              <p style={{ margin: preview.author ? "0 0 3px" : "0 0 8px", fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>{preview.title}</p>
              {preview.author && <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 12.5, color: C.textMuted, fontWeight: 600 }}>{preview.author}</p>}
              {preview.desc && <p style={{ margin: "0 0 14px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{preview.desc}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <a href={preview.url} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.teal}, #0ea876)`, color: "#000", fontFamily: font, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  <ExternalLink size={14} /> Abrir en {PLATFORM_LABELS[preview.platform] || "el navegador"}
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
 * Merge link previews into a media array so they can be shown inside
 * MediaCarousel as extra slides (type: "link") — with or without an image;
 * MediaCarousel/GlobalImageViewer both fall back to a plain title+domain
 * card when there's no og:image. Carries platform/embed/author through so
 * those consumers can offer in-app playback (YouTube/Drive) vs. an
 * "Abrir en X" card (everything else) without re-detecting the platform
 * themselves — detection stays centralized in linkPlatforms.js.
 * Used by ThreadView / UpdateBubble / PostCard when rendering saved content.
 */
export function mergeLinksIntoMedia(media = [], links = []) {
  const linkSlides = (links || [])
    .map(l => ({
      type: "link", url: l.image || "", thumb: l.image || "", linkUrl: l.url,
      title: l.title, site: l.site, platform: l.platform, embed: l.embed, author: l.author,
    }));
  return [...(media || []), ...linkSlides];
}
