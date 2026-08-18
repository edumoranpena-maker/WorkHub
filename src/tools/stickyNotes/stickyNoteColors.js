/**
 * stickyNoteColors.js
 *
 * The small, fixed palette a Sticky Note's paper can be. Every note stores
 * one of these ids in its `color` column (see
 * supabase-migration-005-sticky-notes-color.sql); StickyNoteChip and
 * StickyNoteExpanded both read from this same map so the grid and the
 * expanded view are always visually identical for a given note.
 */

export const DEFAULT_STICKY_COLOR = "yellow";

export const STICKY_COLORS = {
  yellow: { label: "Amarillo", bg: "#fbeb8f", fold: "#e9d766", text: "#4a3f0a" },
  blue:   { label: "Azul",     bg: "#bfe4f7", fold: "#9bccec", text: "#0d3a52" },
  green:  { label: "Verde",    bg: "#c9edb8", fold: "#a6e097", text: "#204d0f" },
  pink:   { label: "Rosa",     bg: "#f8cbe4", fold: "#efa6ce", text: "#5a1338" },
  orange: { label: "Naranja",  bg: "#ffd6a3", fold: "#ffbd77", text: "#5c2f04" },
};

export const STICKY_COLOR_IDS = Object.keys(STICKY_COLORS);

export function stickyColor(id) {
  return STICKY_COLORS[id] || STICKY_COLORS[DEFAULT_STICKY_COLOR];
}

/** Small, stable pseudo-random tilt per note (by id), so the grid doesn't
 *  re-jitter on every re-render but still reads as "a pile of notes", not
 *  a grid of identical cards. */
export function stickyTilt(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 70) / 10) - 3.5; // -3.5deg .. 3.5deg
}
