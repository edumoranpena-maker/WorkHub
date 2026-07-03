/**
 * visibility.jsx
 *
 * "Visibilidad" (privacy) for Posts. Replaces the old composer "Status" field
 * (Active/In Progress/Closed stays — that's a trade-status chip, unrelated).
 *
 * Values map 1:1 to the `visibility` column already in Supabase
 * (recap_threads.visibility / planning_posts.visibility), whose check
 * constraint was migrated from ('public','members','private') to
 * ('public','members','followers') — see supabase-schema.sql.
 *
 * Updates and Subtemas do NOT have their own visibility — they always
 * inherit the parent Post's visibility.
 */

import { Globe2, Users, UserCheck } from "lucide-react";

export const VISIBILITY_OPTIONS = [
  { id: "public",    label: "Público",   icon: Globe2,    color: "#4fa3ff" },
  { id: "members",   label: "Miembros",  icon: Users,     color: "#22d3a0" },
  { id: "followers", label: "Followers", icon: UserCheck, color: "#f5a623" },
];

export const DEFAULT_VISIBILITY = "public";

export function getVisibilityOption(id) {
  return VISIBILITY_OPTIONS.find(v => v.id === id) || VISIBILITY_OPTIONS[0];
}

/**
 * Small flat (outline, not 3D) icon shown next to date/time on
 * published posts and updates.
 */
export function PrivacyIcon({ visibility = DEFAULT_VISIBILITY, size = 11, color, title }) {
  const opt = getVisibilityOption(visibility);
  const Icon = opt.icon;
  return (
    <Icon
      size={size}
      strokeWidth={2}
      color={color || "#8e8e8e"}
      style={{ flexShrink: 0, display: "block" }}
      aria-label={title || opt.label}
    />
  );
}
