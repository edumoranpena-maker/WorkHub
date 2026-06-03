/**
 * profileConfig.js
 *
 * Single source of truth for everything the AI can control.
 * The React render engine reads this config and renders accordingly.
 * The AI only ever modifies this object — never touches JSX or components.
 *
 * Schema is intentionally flat and serializable (JSON-safe, no functions).
 * Icon ids resolve to components via the ICON_REGISTRY in registry/icons.js.
 * Theme palette ids resolve to token sets in config/themes.js.
 */

export const DEFAULT_PROFILE_CONFIG = {

  // ── Identity ────────────────────────────────────────────────────────────────
  identity: {
    name:       "Alex Herrera",
    handle:     "@alexherrera.trades",
    initials:   "A",
    avatarUrl:  null,          // null = use initials fallback
    bio:        "Trader & educator — 6+ years in FX & commodities. Sharing live setups, weekly recaps & real-time analysis.",
    bioHighlight: "XAUUSD · DXY · EURUSD",
    verified:   true,
    liveNow:    true,
    rating:     4.9,
    ratingCount: 147,
  },

  // ── Stats shown in profile header (order = display order) ──────────────────
  stats: [
    { key: "followers",  label: "Followers",   value: "12.4k" },
    { key: "trades",     label: "Trades",      value: "147"   },
    { key: "winrate",    label: "Winrate",      value: "68%"  },
    { key: "ev",         label: "Exp. Value",   value: "2.8R" },
  ],

  // ── Theme ───────────────────────────────────────────────────────────────────
  theme: {
    paletteId:      "dark-purple",   // resolves via THEME_REGISTRY
    accentOverride: null,            // hex string or null (null = use palette default)
    borderRadius:   "rounded",       // "sharp" | "rounded" | "pill"
    fontScale:      1.0,             // 0.85–1.2
    density:        "comfortable",   // "compact" | "comfortable" | "spacious"
    glowEffects:    true,
    animationSpeed: "normal",        // "reduced" | "normal" | "expressive"
  },

  // ── Profile layout ──────────────────────────────────────────────────────────
  layout: {
    profileTemplate: "avatar-left",  // "avatar-left" | "centered" | "banner"
    showRating:      true,
    showLiveDot:     true,
    showBio:         true,
    showStats:       true,
    showActionButtons: true,         // Follow / Subscribe / Message
    actionButtons:   ["follow", "subscribe", "message"],
  },

  // ── Feed widgets shown on the Perfil (home) tab (order = display order) ────
  feedWidgets: [
    { id: "latest-trades", visible: true,  order: 0 },
    { id: "reviews-mini",  visible: true,  order: 1 },
    { id: "section-feed",  visible: true,  order: 2 },
    { id: "badges",        visible: true,  order: 3 },
  ],

  // ── Section registry (order = chip/sidebar order) ───────────────────────────
  sections: [
    {
      id:           "planning",
      label:        "Planning",
      iconId:       "CalendarDays",
      subtitle:     "Trade plans & market analysis",
      accentColor:  "#7c4dff",
      badge:        "4 new",
      visible:      true,
      order:        0,
      isBuiltIn:    true,
    },
    {
      id:           "recaps",
      label:        "Updates",
      iconId:       "FileText",
      subtitle:     "Weekly summaries & progress",
      accentColor:  "#22d3a0",
      badge:        "1 new",
      visible:      true,
      order:        1,
      isBuiltIn:    true,
    },
    {
      id:           "announcements",
      label:        "Announcements",
      iconId:       "Megaphone",
      subtitle:     "Official updates from leadership",
      accentColor:  "#f59e0b",
      badge:        null,
      visible:      true,
      order:        2,
      isBuiltIn:    true,
    },
    {
      id:           "metrics",
      label:        "Metrics",
      iconId:       "BarChart2",
      subtitle:     "Performance & trade stats",
      accentColor:  "#22d3a0",
      badge:        null,
      visible:      true,
      order:        3,
      isBuiltIn:    true,
    },
    {
      id:           "rooms",
      label:        "Rooms",
      iconId:       "Hash",
      subtitle:     "Live sessions · Chat · Reviews",
      accentColor:  "#60a5fa",
      badge:        "2 live",
      visible:      true,
      order:        4,
      isBuiltIn:    true,
    },
  ],
};

/**
 * Merge a partial AI-generated config diff into the current config.
 * The AI returns only the keys it wants to change; this deep-merges safely.
 * Arrays of objects (stats, sections, feedWidgets) are merged by key/id.
 */
export function mergeProfileConfig(current, diff) {
  const merged = { ...current };

  if (diff.identity)    merged.identity    = { ...current.identity,    ...diff.identity };
  if (diff.theme)       merged.theme       = { ...current.theme,       ...diff.theme };
  if (diff.layout)      merged.layout      = { ...current.layout,      ...diff.layout };

  if (diff.stats) {
    merged.stats = diff.stats; // AI provides full ordered array
  }

  if (diff.feedWidgets) {
    // Merge by id — AI can reorder or toggle visibility
    const base = [...current.feedWidgets];
    diff.feedWidgets.forEach(dw => {
      const idx = base.findIndex(w => w.id === dw.id);
      if (idx >= 0) base[idx] = { ...base[idx], ...dw };
      else base.push(dw);
    });
    merged.feedWidgets = base.sort((a, b) => a.order - b.order);
  }

  if (diff.sections) {
    const base = [...current.sections];
    diff.sections.forEach(ds => {
      const idx = base.findIndex(s => s.id === ds.id);
      if (idx >= 0) base[idx] = { ...base[idx], ...ds };
      else base.push(ds);
    });
    merged.sections = base.sort((a, b) => a.order - b.order);
  }

  return merged;
}

/**
 * Validate that a config diff from the AI is within allowed bounds.
 * Prevents the AI from touching things it shouldn't.
 */
export function validateConfigDiff(diff) {
  const ALLOWED_KEYS = ["identity", "theme", "layout", "feedWidgets", "sections"];
  const FORBIDDEN_IDENTITY = ["handle"]; // handle should never be AI-changed
  const errors = [];

  Object.keys(diff).forEach(k => {
    if (!ALLOWED_KEYS.includes(k)) errors.push(`Unknown top-level key: ${k}`);
  });

  if (diff.identity) {
    FORBIDDEN_IDENTITY.forEach(k => {
      if (k in diff.identity) errors.push(`Cannot modify identity.${k} via AI`);
    });
  }

  if (diff.theme?.fontScale) {
    const fs = diff.theme.fontScale;
    if (fs < 0.8 || fs > 1.3) errors.push("fontScale must be between 0.8 and 1.3");
  }

  return { valid: errors.length === 0, errors };
}
