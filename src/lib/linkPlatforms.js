/**
 * linkPlatforms.js
 *
 * Platform detection + normalization for the link-preview system in
 * linkPreview.jsx. Kept as a separate module purely for readability — this
 * is the ONE place in the app that knows what a YouTube/Drive/Instagram/
 * TikTok/X/Facebook URL looks like, or how to build an official embed URL
 * for the ones that support it. Post.jsx and PostComposer.jsx never import
 * this directly; they only ever go through linkPreview.jsx's hooks/
 * components, exactly as before — no platform logic duplicated there.
 */

export const PLATFORMS = {
  YOUTUBE: "youtube",
  GDRIVE: "gdrive",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  X: "x",
  FACEBOOK: "facebook",
  WEB: "web",
};

export const PLATFORM_LABELS = {
  [PLATFORMS.YOUTUBE]: "YouTube",
  [PLATFORMS.GDRIVE]: "Google Drive",
  [PLATFORMS.INSTAGRAM]: "Instagram",
  [PLATFORMS.TIKTOK]: "TikTok",
  [PLATFORMS.X]: "X",
  [PLATFORMS.FACEBOOK]: "Facebook",
  [PLATFORMS.WEB]: "Web",
};

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

export function detectPlatform(url) {
  const host = hostnameOf(url);
  if (!host) return PLATFORMS.WEB;
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return PLATFORMS.YOUTUBE;
  if (host === "drive.google.com" || host === "docs.google.com") return PLATFORMS.GDRIVE;
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return PLATFORMS.INSTAGRAM;
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return PLATFORMS.TIKTOK;
  if (host === "x.com" || host === "twitter.com") return PLATFORMS.X;
  if (host === "facebook.com" || host === "fb.watch" || host.endsWith(".facebook.com")) return PLATFORMS.FACEBOOK;
  return PLATFORMS.WEB;
}

// ── YouTube ──────────────────────────────────────────────────────────────
// Covers watch?v=, youtu.be/<id>, /shorts/<id>, /embed/<id>, /live/<id>.
export function parseYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts) return shorts[1];
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed) return embed[1];
      const live = u.pathname.match(/^\/live\/([^/?]+)/);
      if (live) return live[1];
    }
  } catch { /* not a valid URL — caller treats as undetected */ }
  return null;
}
export const youTubeEmbedUrl = (videoId) => `https://www.youtube.com/embed/${videoId}`;
export const youTubeThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

// ── Google Drive ─────────────────────────────────────────────────────────
// Covers /file/d/<id>/view, ?id=<id> (open?id=, uc?id=), and Docs/Sheets/
// Slides' /d/<id>/ shape (docs.google.com).
export function parseGoogleDriveId(url) {
  try {
    const u = new URL(url);
    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];
    const idParam = u.searchParams.get("id");
    if (idParam) return idParam;
    const docMatch = u.pathname.match(/\/d\/([^/]+)/);
    if (docMatch) return docMatch[1];
  } catch { /* not a valid URL */ }
  return null;
}
// Drive's own official embeddable preview iframe — works for publicly
// shared docs/sheets/slides/PDFs/images and many video files, no API key.
export const googleDriveEmbedUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;
// Public, unauthenticated thumbnail endpoint — also no API key required,
// works as long as the file is shared with "anyone with the link".
export const googleDriveThumbnailUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w640`;
