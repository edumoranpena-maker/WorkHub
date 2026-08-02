/**
 * ProfileRegion.jsx
 *
 * The one persistent "identity region" of PlanSpace — avatar, name, bio,
 * stats, action buttons, and the tab strip — mounted exactly once, directly
 * under TopBar, for the lifetime of the app session:
 *
 *   TopBar
 *     ↓
 *   ProfileRegion (this file) — persistent, never remounts on tab switch
 *     ↓
 *   Content region (Post / Announcements / Stats / Rooms / future sections)
 *
 * Nobody outside this file renders a header, avatar, bio, stats block, or
 * tab strip — App.jsx mounts <ProfileRegion> once, and every section below
 * it only ever swaps the content region. Sections never receive profile data
 * and never render identity chrome; if a future section needs to show
 * something about the profile owner, it asks for that data as a prop, it
 * does not reach for a second copy of this UI.
 *
 * ── Owner vs Viewer (no auth yet, but designed for it) ───────────────────
 * `profile` describes WHOSE identity is being shown — never assumed to be
 * "the current app user". `isOwner` describes whether the person looking at
 * the screen right now owns that profile. Today there's no real auth, so
 * every call site simply passes `isOwner={false}` (matches today's visible
 * behavior — see the prop's default below) — but the moment auth exists,
 * a caller flips that to `isOwner={session.user.id === profile.id}` and the
 * right actions show/hide with zero changes inside this file. That's the
 * whole point of drawing this line now instead of later.
 *
 * `onEditAvatar` follows the same idea but doesn't need any internal gating
 * at all: it's caller-gated by construction — only pass a handler when
 * `isOwner` is true, and the edit pencil naturally never renders otherwise.
 * Today it's still always passed (single-user reality), which is exactly
 * why the pencil still shows today — no behavior change.
 *
 * ── Visibility handoff — the single source of truth for this whole region ──
 * TopBar (a sibling, outside this file) needs to know whether the header is
 * currently on screen, to decide whether to show the profile name in its own
 * center column. That's the ONLY thing that depends on scroll position here
 * — the tab strip's sticky behavior is plain CSS (position:sticky) and needs
 * no JS state at all. So there is exactly one derived value in this whole
 * region: "is the header visible right now", detected once via
 * IntersectionObserver and reported upward through onVisibilityChange.
 * Nothing here duplicates that as a second "isSticky" flag — sticky and
 * "header visible" describe the same physical moment, they just don't need
 * the same mechanism to work (one is native CSS, the other crosses a
 * component boundary and genuinely needs JS).
 *
 * ── `hidden` — visually off while a fullscreen portal covers everything ────
 * App.jsx passes `hidden={true}` while a Thread/Dashboard/Tool portal is
 * open on top of this region, instead of conditionally unmounting
 * <ProfileRegion> the way it used to. Each of this component's two pieces
 * (header, sticky tab strip) gets `visibility:hidden` individually, applied
 * directly on the div that piece already renders — never on a wrapper
 * around them. That distinction matters: see the comment right above the
 * return statement for why wrapping the header and the sticky strip
 * together, even just for a visibility toggle, breaks position:sticky.
 */
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import {
  Pencil, Plus, Globe, Instagram, Youtube, Twitter, Linkedin, Github,
  Link as LinkIcon,
} from "lucide-react";
import { PageContainer, isolateOverlayGestures } from "../lib/layout.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#000000", surface: "#0a0a0a", card: "#13131f", border: "#1c1c2e",
  accent: "#7c4dff", accentLight: "#9d71ff", accentDim: "#3d2480",
  text: "#fafafa", textMuted: "#8e8e8e",
  blue: "#4fa3ff", gold: "#d4a843", green: "#1ed99a", orange: "#f97316",
};
const BRAND_ACCENT = "#2DD4BF"; // teal — tab strip active state / indicator, matches App.jsx's brand constant

const SOCIAL_ICON_MAP = {
  instagram: Instagram, x: Twitter, twitter: Twitter,
  youtube: Youtube, linkedin: Linkedin, github: Github, website: Globe,
};

// ─── Header (avatar, name, bio, stats, actions) ─────────────────────────────
function ProfileHeader({ onNavigate, isOwner, profile, onEditAvatar,
                       followed, onToggleFollow, subscribed, onToggleSubscribe, isDesktop }) {
  const stats = profile?.stats ?? [
    { key: "followers", label: "Followers", value: "12.4k" },
    { key: "posts",      label: "Posts",     value: "86" },
    { key: "ev",         label: "Exp Value", value: "2.8R" },
  ];
  const socials = profile?.socials ?? [];

  const Avatar = ({ size }) => (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ cursor: "pointer" }} onClick={() => onNavigate && onNavigate("announcements")}>
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: `conic-gradient(${C.orange} 0deg, #fbbf24 120deg, ${C.orange} 240deg, #fbbf24 360deg)`,
          padding: 3,
          boxShadow: `0 0 10px ${C.orange}30`,
        }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `3px solid ${C.bg}`, overflow: "hidden", background: `linear-gradient(135deg, ${C.accentDim}, #1a0a3a)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: font, fontSize: size * 0.33, fontWeight: 800, color: C.accentLight, letterSpacing: "-0.02em" }}>A</span>
          </div>
        </div>
      </div>
      {profile?.showLiveDot !== false && (
        <div style={{ position: "absolute", bottom: 5, right: 5, width: 14, height: 14, borderRadius: "50%", background: C.green, border: `2px solid ${C.bg}`, boxShadow: `0 0 6px ${C.green}70` }} />
      )}
      {onEditAvatar && (
        <motion.button whileTap={{ scale: 0.88 }} onClick={onEditAvatar}
          style={{ position: "absolute", bottom: 0, left: 0, width: 25, height: 25, borderRadius: "50%", background: C.accent, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Pencil size={11} color="#fff" strokeWidth={2.5} />
        </motion.button>
      )}
    </div>
  );

  const Socials = () => socials.length > 0 && (
    <div style={{ display: "flex", gap: 10 }}>
      {socials.map((s) => {
        const Icon = SOCIAL_ICON_MAP[s.platform] ?? LinkIcon;
        return (
          <motion.a key={s.platform + s.url} href={s.url} target="_blank" rel="noopener noreferrer" whileTap={{ scale: 0.88 }}
            style={{ width: 34, height: 34, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, cursor: "pointer" }}>
            <Icon size={15} strokeWidth={2} />
          </motion.a>
        );
      })}
    </div>
  );

  // Follow/Subscribe/Message are viewer-only actions — they don't make sense
  // on your own profile. Gated on !isOwner (see file header for the Owner/
  // Viewer design note); isOwner defaults to false below, which is exactly
  // today's single-user behavior (buttons always show) preserved as-is.
  const Buttons = ({ style }) => !isOwner && (
    <div style={{ display: "flex", gap: 9, ...style }}>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onToggleFollow}
        style={{ flex: isDesktop ? "0 0 auto" : 1, minWidth: isDesktop ? 100 : undefined, height: 36, borderRadius: 22, padding: isDesktop ? "0 20px" : 0, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.01em", background: followed ? "transparent" : C.accent, border: followed ? `1.5px solid ${C.accent}` : "none", color: followed ? C.accent : "#fff", transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
        {followed ? "Following" : "Follow"}
      </motion.button>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onToggleSubscribe}
        style={{ flex: isDesktop ? "0 0 auto" : 1, minWidth: isDesktop ? 100 : undefined, height: 36, borderRadius: 22, padding: isDesktop ? "0 20px" : 0, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", background: subscribed ? "transparent" : C.gold, border: subscribed ? `1.5px solid ${C.gold}` : "none", color: subscribed ? C.gold : "#1a0f00", transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
        {subscribed ? "Subscribed" : "Subscribe"}
      </motion.button>
      <motion.button whileTap={{ scale: 0.95 }}
        style={{ flex: isDesktop ? "0 0 auto" : 1, minWidth: isDesktop ? 100 : undefined, height: 36, borderRadius: 22, padding: isDesktop ? "0 20px" : 0, border: "none", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.01em", background: C.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Message
      </motion.button>
    </div>
  );

  const Stats = ({ align = "center" }) => (profile?.showStats !== false) && (
    <div style={{ display: "flex", gap: isDesktop ? 28 : 0 }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          flex: isDesktop ? "0 0 auto" : 1, textAlign: isDesktop ? align : "center", padding: isDesktop ? 0 : "0 8px",
          borderLeft: !isDesktop && i > 0 ? `1px solid ${C.border}` : "none",
        }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: isDesktop ? 20 : 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>{s.value}</p>
          <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 11, color: C.textMuted }}>{s.label}</p>
        </div>
      ))}
    </div>
  );

  // ── Desktop — horizontal header: avatar left, identity+actions right ────
  if (isDesktop) {
    return (
      <motion.div
        data-profile-card="1"
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ padding: "32px 0 24px" }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
          <Avatar size={104} />

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <h2 style={{ margin: 0, fontFamily: font, fontSize: 21, fontWeight: 800, color: C.text, letterSpacing: "-0.015em" }}>{profile?.name ?? "Luis Morp"}</h2>
                  {profile?.verified && (
                    <div style={{ width: 17, height: 17, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: "#fff" }}>✓</span>
                    </div>
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{profile?.handle ?? "@luismorp"}</p>
              </div>
              <Buttons style={{ flexShrink: 0 }} />
            </div>

            {(profile?.showBio !== false) && (
              <p style={{ margin: 0, fontFamily: font, fontSize: 13.5, color: C.text, lineHeight: 1.6, maxWidth: 480 }}>
                {profile?.bio ?? "Trader & educator — 6+ years in FX & commodities."}{" "}
                {profile?.bioHighlight && <span style={{ color: C.accentLight, fontWeight: 600 }}>{profile.bioHighlight}</span>}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <Stats align="left" />
              <Socials />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Mobile — centered vertical stack ─────────────────────────────────────
  return (
    <motion.div
      data-profile-card="1"
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ padding: "28px 20px 0" }}>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Avatar size={84} />
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <h2 style={{ margin: 0, fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{profile?.name ?? "Luis Morp"}</h2>
            {profile?.verified && (
              <div style={{ width: 15, height: 15, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: "#fff" }}>✓</span>
              </div>
            )}
          </div>
          <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 12, color: C.textMuted, fontWeight: 600, letterSpacing: "0.01em" }}>{profile?.handle ?? "@luismorp"}</p>
        </div>
      </div>

      <div style={{ marginTop: 20 }}><Stats /></div>

      {(profile?.showBio !== false) && (
        <p style={{ margin: "18px 0 0", fontFamily: font, fontSize: 13, color: C.text, lineHeight: 1.6, textAlign: "center" }}>
          {profile?.bio ?? "Trader & educator — 6+ years in FX & commodities."}{" "}
          {profile?.bioHighlight && <span style={{ color: C.accentLight, fontWeight: 600 }}>{profile.bioHighlight}</span>}
        </p>
      )}

      {socials.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
          <Socials />
        </div>
      )}

      <Buttons style={{ marginTop: 20, paddingBottom: 18 }} />
    </motion.div>
  );
}

// ─── Tab strip ───────────────────────────────────────────────────────────────
function TabBar({ activeSectionId, onNavigate, onHome, onSections, onAddSection }) {
  const containerRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // Callers always provide onSections today (App.jsx passes allSections) —
  // the empty-array fallback just avoids crashing if that ever changes,
  // it's never actually exercised in practice.
  const tabs = [{ id: null, label: "Perfil" }, ...(onSections || []).map(s => ({ id: s.id, label: s.label, badge: s.badge }))];
  const activeKey = activeSectionId ?? "__perfil__";

  const measure = useCallback(() => {
    const el = tabRefs.current[activeKey];
    if (!el) return;
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [activeKey]);

  useLayoutEffect(() => { measure(); }, [measure, tabs.length]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  return (
    // isolateOverlayGestures stops these touch events from bubbling up to
    // App.jsx's horizontal-swipe-to-change-section handler on unifiedScrollRef
    // — without it, swiping through this strip to browse tabs also reads as a
    // section-change swipe once it crosses App's own drag threshold, changing
    // section out from under you mid-search. Native horizontal scrolling of
    // the strip itself is untouched (no preventDefault involved, same as
    // every other use of this object) — only the bubbling to the ancestor is
    // cut. Swiping anywhere else in the app still changes sections normally.
    <div ref={containerRef} {...isolateOverlayGestures} style={{ position: "relative", display: "flex", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
      {tabs.map(t => {
        const key = t.id ?? "__perfil__";
        const active = key === activeKey;
        return (
          <button
            key={key}
            ref={el => { if (el) tabRefs.current[key] = el; }}
            onClick={() => (t.id ? onNavigate(t.id) : onHome())}
            style={{ flexShrink: 0, position: "relative", background: "none", border: "none", cursor: "pointer", padding: "10px 16px", display: "flex", alignItems: "center", gap: 5 }}
          >
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: active ? 700 : 600, color: active ? BRAND_ACCENT : C.textMuted, whiteSpace: "nowrap", transition: "color 0.15s" }}>
              {t.label}
            </span>
            {t.badge && !active && (
              <span style={{ fontSize: 9, fontWeight: 800, color: C.textMuted, background: C.border, borderRadius: 99, padding: "1px 5px", fontFamily: font }}>{t.badge}</span>
            )}
          </button>
        );
      })}

      {onAddSection && (
        <button onClick={onAddSection} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "10px 14px", background: "none", border: "none", cursor: "pointer" }}>
          <Plus size={12} color={C.textMuted} strokeWidth={2.5} />
          <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>Añadir</span>
        </button>
      )}

      <motion.div
        animate={{ left: indicator.left, width: indicator.width, opacity: indicator.ready ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        style={{ position: "absolute", bottom: 0, height: 3, borderRadius: 3, background: BRAND_ACCENT, boxShadow: `0 0 8px ${BRAND_ACCENT}70`, pointerEvents: "none" }}
      />
    </div>
  );
}

// ─── ProfileRegion — the public API of this file ────────────────────────────
// The only export. App.jsx (or, later, a per-user profile route) mounts this
// once; nothing else in the app builds its own header or tab strip.
//
// Rendered as two direct children of whatever scroll container hosts it
// (unifiedScrollRef in App.jsx today) — deliberately NOT wrapped in one
// shared box together, and deliberately introduces no overflow/scroll of its
// own. Both matter for the same reason: the tab strip's position:sticky is
// bounded by its own parent's box, so if the header and the sticky wrapper
// shared one (short) parent, sticky would have nothing left to stick within
// once you scrolled past it — this is literally the bug a previous pass
// found and fixed (and a later pass re-broke by wrapping both in a div just
// to toggle visibility — don't do that; that's exactly why `hidden` below
// is a prop applied inside, per-piece, instead). Keeping them as siblings
// inside the tall, single, already-existing page scroll is what makes
// sticky work AND keeps scrolling itself completely untouched — there is
// still exactly one scroll container in the whole app, this component
// doesn't add another.
export default function ProfileRegion({
  profile, isOwner = false, onEditAvatar,
  followed, onToggleFollow, subscribed, onToggleSubscribe,
  activeSectionId, onNavigate, onHome, onSections, onAddSection,
  isDesktop,
  onVisibilityChange,
  hidden = false,
}) {
  // The one piece of state this region produces: whether the header is
  // currently visible. Detected here (the component that owns the DOM node
  // being watched), reported upward via a callback — App.jsx doesn't need
  // to know an IntersectionObserver is involved at all, just that
  // "visible: true/false" happened. See the file header for why this is the
  // single source of truth for both the TopBar name and — implicitly,
  // through plain CSS rather than a second flag — the sticky tab strip.
  const headerAnchorRef = useRef(null);

  useEffect(() => {
    const target = headerAnchorRef.current;
    if (!target) return;
    // root:null (the nearest scrolling ancestor, i.e. whatever scroll
    // container this is mounted inside) — ProfileRegion doesn't need to
    // know that container's ref explicitly, IntersectionObserver finds it
    // on its own by walking up the DOM.
    const observer = new IntersectionObserver(
      ([entry]) => onVisibilityChange?.(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [onVisibilityChange]);

  return (
    <>
      <div ref={headerAnchorRef} style={{ visibility: hidden ? "hidden" : "visible" }}>
        <PageContainer isDesktop={isDesktop} variant="feed">
          <ProfileHeader
            onNavigate={onNavigate}
            profile={profile}
            isOwner={isOwner}
            onEditAvatar={onEditAvatar}
            followed={followed}
            onToggleFollow={onToggleFollow}
            subscribed={subscribed}
            onToggleSubscribe={onToggleSubscribe}
            isDesktop={isDesktop}
          />
        </PageContainer>
      </div>

      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 25,
        flexShrink: 0,
        background: `${C.surface}fd`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`,
        visibility: hidden ? "hidden" : "visible",
      }}>
        <PageContainer isDesktop={isDesktop} variant="feed">
          <div style={{ padding: "6px 14px 8px" }}>
            <TabBar
              activeSectionId={activeSectionId}
              onNavigate={onNavigate}
              onHome={onHome}
              onSections={onSections}
              onAddSection={onAddSection}
            />
          </div>
        </PageContainer>
      </div>
    </>
  );
}
