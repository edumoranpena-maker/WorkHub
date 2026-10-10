/**
 * ProfileRegion.jsx
 *
 * The one persistent "identity region" of Planation, mounted exactly once,
 * directly under TopBar, for the lifetime of the app session:
 *
 *   TopBar
 *     ↓
 *   ProfileRegion (this file) — persistent, never remounts on tab switch
 *     ├─ ProfileCard — compact identity card (avatar, name, action button),
 *     │                tap to unfold stats + description + socials
 *     └─ TabBar      — sticky tab strip
 *     ↓
 *   Content region (Post / Announcements / Stats / Rooms / future sections)
 *
 * Nobody outside this file renders an identity header or the tab strip —
 * App.jsx mounts <ProfileRegion> once and every section below it only swaps
 * the content region. Sections never receive profile data; if one needs
 * something about the profile owner it asks for it as a prop, it does not
 * build a second copy of this UI.
 *
 * ── Data ─────────────────────────────────────────────────────────────────────
 * Presentation only. `profile` arrives ready-made from App.jsx:
 *   { name, handle, avatarUrl, bio, bioHighlight, verified, liveNow, socials,
 *     stats: { followers, trades, winrate } }
 * where each stat is a raw number or null (null renders "—" — nothing in this
 * file invents or formats-from-nothing a figure). Stats come from the same
 * allTimeStats Stats.jsx reads; followers has no source yet, so it is null.
 *
 * ── Owner vs Viewer (no auth yet, but designed for it) ───────────────────────
 * `profile` describes WHOSE identity is shown; `isOwner` whether the person
 * looking owns it. The action button is "Editar" (→ onEditProfile) on your
 * own profile and Follow/Following on anyone else's. Today App.jsx passes
 * isOwner={false} (no auth), so Follow shows; the day auth exists the caller
 * flips that to `session.user.id === profile.id` with zero changes here.
 * Follow state is local on purpose: this region never remounts, so lifting it
 * into App bought nothing — when follows get a real backend, it comes in as
 * props like everything else.
 *
 * ── Expand / collapse ────────────────────────────────────────────────────────
 * One boolean (`expanded`) inside ProfileCard. Tapping the identity area or
 * the hint row toggles it; the first scroll of `scrollRef` (App's single
 * scroll container) folds it. The listener only exists while expanded, so a
 * compact card costs nothing per scroll. The panel animates `grid-template-
 * rows` 0fr↔1fr — a pure-CSS height transition that needs no measuring — and
 * the card wrapper opts out of scroll anchoring so the browser doesn't fight
 * that animation by adjusting scrollTop mid-collapse.
 *
 * ── Layout contract with App.jsx — don't wrap ───────────────────────────────
 * ProfileRegion renders two direct siblings (card, sticky tab strip) inside
 * the scroll container, deliberately NOT wrapped in one shared box: the tab
 * strip's position:sticky is bounded by its own parent, so sharing a short
 * parent with the card leaves sticky nothing to stick within once you scroll
 * past it. There is still exactly one scroll container in the app.
 *
 * `hidden` — visually off while a fullscreen portal covers everything.
 * App.jsx passes hidden={true} instead of unmounting (an unmount shrinks
 * scrollHeight and clamps scrollTop on short sections). Applied as
 * visibility:hidden on each of the two pieces individually, never on a
 * wrapper — see above.
 */
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId } from "react";
import { motion } from "framer-motion";
import {
  Plus, ChevronDown, BadgeCheck, Globe, Instagram, Youtube, Twitter, Linkedin, Github,
  Link as LinkIcon,
} from "lucide-react";
import { PageContainer, isolateOverlayGestures } from "../lib/layout.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  surface: "#0a0a0a", border: "#1c1c2e", text: "#fafafa", textMuted: "#8e8e8e", // shared with the tab strip
  card: "#14171d", divider: "#262a33", gold: "#F0B90B", onGold: "#1a1300", green: "#1ed99a",
};
const BRAND_ACCENT = "#2DD4BF"; // teal — tab strip active state / indicator, matches App.jsx's brand constant

const REDUCED_MOTION = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const FOLD_MS = REDUCED_MOTION ? 0 : 240;
const FOLD_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const SOCIAL_ICON_MAP = {
  instagram: Instagram, x: Twitter, twitter: Twitter,
  youtube: Youtube, linkedin: Linkedin, github: Github, website: Globe,
};

const fmtCount   = (n) => (n == null ? "—" : n.toLocaleString());
const fmtPercent = (n) => (n == null ? "—" : `${n.toFixed(1)}%`);

// Plain-button reset — the toggle areas are real <button>s (keyboard + screen
// reader support for free) that must look like the plain card they sit in.
const bareButton = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" };

// ─── Pieces — module-level, never defined inside another component ──────────
// A component declared inside another one's body is a new *type* on every
// render, so React unmounts/remounts its whole subtree each time — this
// region re-renders on every App-level state change. Keeping these at module
// level keeps their identity stable.
function Avatar({ profile }) {
  const initial = profile.name?.trim()?.[0]?.toUpperCase() ?? "";
  return (
    <div style={{ position: "relative", flexShrink: 0, width: 52, height: 52 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "#1d2128", border: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontFamily: font, fontSize: 20, fontWeight: 800, color: C.textMuted }}>{initial}</span>}
      </div>
      {profile.liveNow && (
        <div style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: "50%", background: C.green, border: "2px solid " + C.card }} />
      )}
    </div>
  );
}

function StatCell({ value, label, color = C.text }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <p style={{ margin: 0, fontFamily: font, fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 13, color: C.textMuted }}>{label}</p>
    </div>
  );
}

function SocialsColumn({ socials }) {
  return (
    <div style={{ flex: "0 0 auto", maxWidth: "42%", display: "flex", flexDirection: "column", gap: 14 }}>
      {socials.map((s) => {
        const Icon = SOCIAL_ICON_MAP[s.platform] ?? LinkIcon;
        return (
          <a key={s.platform + s.url} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 10, color: C.text, textDecoration: "none", minWidth: 0 }}>
            <Icon size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.label ?? s.platform}
            </span>
          </a>
        );
      })}
    </div>
  );
}

// ─── ProfileCard — identity (always) + info (when expanded) ────────────────
function ProfileCard({ profile, isOwner, onEditProfile, isDesktop, scrollRef }) {
  const [expanded, setExpanded] = useState(false);
  const [followed, setFollowed] = useState(false);
  const panelId = useId();
  const toggle = useCallback(() => setExpanded((e) => !e), []);

  // Fold as soon as the content starts scrolling. Only attached while
  // expanded; `once` because folding is all this ever does.
  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!expanded || !scroller) return;
    const fold = () => setExpanded(false);
    scroller.addEventListener("scroll", fold, { passive: true, once: true });
    return () => scroller.removeEventListener("scroll", fold);
  }, [expanded, scrollRef]);

  const stats = profile.stats ?? {};
  const socials = profile.socials ?? [];
  const hasDescription = !!(profile.bio || profile.bioHighlight);
  const hasMore = hasDescription || socials.length > 0;

  const actionStyle = {
    flexShrink: 0, minWidth: 92, height: 40, padding: "0 18px", borderRadius: 12, cursor: "pointer",
    fontFamily: font, fontSize: 15, fontWeight: 700,
    transition: "background 0.2s, color 0.2s",
  };

  return (
    <div style={{ padding: isDesktop ? "20px 0 14px" : "14px 14px 12px" }}>
      <div style={{ maxWidth: isDesktop ? 640 : undefined, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "14px 16px 6px" }}>

        {/* Identity row — the toggle area and the action button are siblings
            (never nested buttons), so tapping the action never folds the card. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={toggle} aria-expanded={expanded} aria-controls={panelId}
            style={{ ...bareButton, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar profile={profile} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: font, fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name}</span>
                {profile.verified && <BadgeCheck size={17} color={C.gold} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-label="Verificado" />}
              </span>
              <span style={{ display: "block", marginTop: 2, fontFamily: font, fontSize: 15, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.handle}</span>
            </span>
          </button>

          {isOwner ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={onEditProfile}
              style={{ ...actionStyle, background: C.gold, border: "none", color: C.onGold }}>
              Editar
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFollowed((f) => !f)}
              style={{ ...actionStyle, background: followed ? "transparent" : C.gold, border: followed ? `1.5px solid ${C.gold}` : "none", color: followed ? C.gold : C.onGold }}>
              {followed ? "Following" : "Follow"}
            </motion.button>
          )}
        </div>

        {/* Expandable info. grid 0fr↔1fr animates height without measuring;
            visibility keeps the folded content out of the tab order, delayed
            on the way out so it stays visible while it folds. */}
        <div id={panelId} style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr", transition: `grid-template-rows ${FOLD_MS}ms ${FOLD_EASE}` }}>
          <div style={{ minHeight: 0, overflow: "hidden", visibility: expanded ? "visible" : "hidden", opacity: expanded ? 1 : 0, transition: `opacity ${FOLD_MS}ms ${FOLD_EASE}, visibility 0s linear ${expanded ? 0 : FOLD_MS}ms` }}>
            <div style={{ display: "flex", padding: "16px 0", marginTop: 14, borderTop: `1px solid ${C.divider}` }}>
              <StatCell value={fmtCount(stats.followers)} label="Followers" />
              <StatCell value={fmtCount(stats.trades)} label="Trades" />
              <StatCell value={fmtPercent(stats.winrate)} label="Winrate" color={C.gold} />
            </div>

            {hasMore && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "16px 0", borderTop: `1px solid ${C.divider}` }}>
                {hasDescription && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: font, fontSize: 15, fontWeight: 700, color: C.gold }}>Descripción</p>
                    <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 15, lineHeight: 1.5, color: C.text, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                      {profile.bio}{profile.bio && profile.bioHighlight ? " " : ""}
                      {profile.bioHighlight && <span style={{ color: C.gold, fontWeight: 600 }}>{profile.bioHighlight}</span>}
                    </p>
                  </div>
                )}
                {socials.length > 0 && <SocialsColumn socials={socials} />}
              </div>
            )}
          </div>
        </div>

        {/* Hint row — the same element in both states, always last in the card */}
        <button type="button" onClick={toggle} aria-expanded={expanded} aria-controls={panelId}
          style={{ ...bareButton, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0 8px" }}>
          <ChevronDown size={16} color={C.gold} strokeWidth={2.4} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: `transform ${FOLD_MS}ms ${FOLD_EASE}` }} />
          <span style={{ fontFamily: font, fontSize: 14, color: C.textMuted }}>{expanded ? "Toca para contraer" : "Toca para ver el perfil"}</span>
        </button>
      </div>
    </div>
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
// The only export. See the file header for the two-sibling layout contract.
export default function ProfileRegion({
  profile, isOwner = false, onEditProfile,
  activeSectionId, onNavigate, onHome, onSections, onAddSection,
  isDesktop, scrollRef,
  hidden = false,
}) {
  return (
    <>
      <div style={{ visibility: hidden ? "hidden" : "visible", overflowAnchor: "none" }}>
        <PageContainer isDesktop={isDesktop} variant="feed">
          <ProfileCard
            profile={profile}
            isOwner={isOwner}
            onEditProfile={onEditProfile}
            isDesktop={isDesktop}
            scrollRef={scrollRef}
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
