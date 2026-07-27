/**
 * layout.jsx
 *
 * PlanSpace's definitive desktop container system. Three named widths, each
 * tied to a type of experience — nobody picks an arbitrary pixel value
 * anymore, every section/composer/portal picks ONE of these three:
 *
 *   reading   (800px)  — Thread, Subtema, Announcements. Anywhere the user is
 *                         mainly reading. Comfortable for long reading
 *                         sessions, not a wide scanning layout.
 *   feed      (1200px) — Home, Perfil, Post feed, Rooms, Stats' main screen,
 *                         and every composer (Post/Announcement/Update).
 *                         PlanSpace's main container — wide, modern, never
 *                         reads as "mobile UI stretched".
 *   dashboard (1400px) — The Stats Dashboard portal, and any future
 *                         analytics/table/chart-heavy view where horizontal
 *                         room matters more than reading comfort.
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
