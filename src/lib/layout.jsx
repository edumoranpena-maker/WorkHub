/**
 * layout.jsx
 *
 * PlanSpace's definitive desktop container system. Four named widths, each
 * tied to a type of experience — nobody picks an arbitrary pixel value
 * anymore, every section/composer/portal picks ONE of these:
 *
 *   reading   (800px)  — Thread, Subtema, Announcements. Anywhere the user is
 *                         mainly reading. Comfortable for long reading
 *                         sessions, not a wide scanning layout.
 *   feed      (1200px) — Home, Perfil, Post feed, Rooms, Stats' main screen,
 *                         Tools' grid, and every composer (Post/Announcement/
 *                         Update). PlanSpace's main container — wide,
 *                         modern, never reads as "mobile UI stretched".
 *   dashboard (1400px) — The Stats Dashboard portal, and any future
 *                         analytics/table/chart-heavy view where horizontal
 *                         room matters more than reading comfort.
 *   workspace (760px)  — Focused single-task tool portals (Risk Calculator
 *                         and future Tools). Narrower than "feed" on purpose:
 *                         a calculator or a single-purpose utility reads
 *                         better as a tight working column than a wide
 *                         browsing layout — same "chrome vs content" split
 *                         as the other portals (their own topbar stays full
 *                         width, only the body caps here).
 *
 * The architecture this plugs into (unchanged, this file only replaces the
 * width decision itself):
 *   - Background and TopBar always span 100% of the viewport.
 *   - PageContainer NEVER wraps them — it only wraps *content* placed inside
 *     an already-full-width shell, which is what keeps the sides of the
 *     screen reading as "still PlanSpace" instead of empty margin.
 *   - On mobile (isDesktop=false) this is an inert pass-through: maxWidth
 *     100%, zero side padding — every section already carries its own
 *     mobile-appropriate inner padding, completely unaffected.
 *   - On desktop, side padding uses clamp() so it scales smoothly instead of
 *     jumping, and the cap means content stops growing no matter how wide
 *     the window gets (2K/4K/ultrawide just means more air on the sides).
 */
export const CONTAINER_WIDTHS = {
  reading: 800,
  feed: 1200,
  dashboard: 1400,
  workspace: 760,
};

export function PageContainer({ variant = "feed", isDesktop, children, style }) {
  const maxWidth = CONTAINER_WIDTHS[variant] ?? CONTAINER_WIDTHS.feed;
  return (
    <div style={{
      width: "100%",
      maxWidth: isDesktop ? maxWidth : "100%",
      marginInline: "auto",
      paddingInline: isDesktop ? "clamp(20px, 4vw, 40px)" : 0,
      boxSizing: "border-box",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Overlay gesture isolation ──────────────────────────────────────────────
// Thread/Subtema overlays are portaled to document.body (see createPortal
// below), but a React portal's events still bubble through the REACT tree,
// not the DOM tree — so a touch gesture starting inside the overlay would
// otherwise keep bubbling up through <Post>'s real React ancestor (App.jsx's
// unifiedScrollRef), reaching its horizontal-swipe-to-change-section handler
// even though the overlay visually covers it. Stopping propagation right at
// the overlay's own boundary is what actually makes it "the only interactive
// element" while it's open — nothing below can react to what happens on top
// of it, regardless of what handlers exist (or get added later) upstream.
//
// Moved here unchanged (originally defined locally in Post.jsx, right above
// its own createPortal usages) so Stats.jsx and Tools.jsx's portals — built
// to the same architecture — spread the exact same object instead of each
// keeping their own copy. Post.jsx now imports this too; nothing about the
// object itself changed in the move.
export const isolateOverlayGestures = {
  onTouchStart: (e) => e.stopPropagation(),
  onTouchMove: (e) => e.stopPropagation(),
  onTouchEnd: (e) => e.stopPropagation(),
};
