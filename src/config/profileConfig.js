/**
 * profileConfig.js
 *
 * Single source of truth for profile appearance and structure.
 * The React render engine reads this config and renders accordingly.
 * Schema is intentionally flat and serializable (JSON-safe, no functions).
 * Icon ids resolve to components via the ICON_REGISTRY in registry/icons.js.
 * Theme palette ids resolve to token sets in config/themes.js.
 */

export const DEFAULT_PROFILE_CONFIG = {

  // ── Identity ────────────────────────────────────────────────────────────────
  identity: {
    name:       "Luis Morp",
    handle:     "@luismorp",
    initials:   "L",
    avatarUrl:  null,          // null = use initials fallback
    bio:        "Trader & educator — 6+ years in FX & commodities. Sharing live setups, weekly recaps & real-time analysis.",
    bioHighlight: "XAUUSD · DXY · EURUSD",
    verified:   true,
    liveNow:    true,
  },

  // ── Social links shown as a row of icons below the bio. Empty by default —
  // ready for the user to connect accounts; each entry needs { platform, url }.
  // platform resolves to an icon via SOCIAL_ICON_MAP in App.jsx (falls back to
  // a generic Globe icon for anything not explicitly mapped yet).
  socials: [],

  // ── Stats shown in profile header (order = display order) ──────────────────
  stats: [
    { key: "followers",  label: "Followers",   value: "12.4k" },
    { key: "posts",      label: "Posts",        value: "86"    },
    { key: "ev",         label: "Exp Value",    value: "2.8R"  },
  ],

  // ── Theme ───────────────────────────────────────────────────────────────────
  theme: {
    paletteId:      "dark-purple",   // resolves via THEME_REGISTRY
    accentOverride: null,            // hex string or null (null = use palette default)
    borderRadius:   "rounded",       // "sharp" | "rounded" | "pill"
    fontScale:      1.0,             // 0.85–1.2
    density:        "comfortable",   // "compact" | "comfortable" | "spacious"
    glowEffects:    false,
    animationSpeed: "normal",        // "reduced" | "normal" | "expressive"
  },

  // ── Profile layout ──────────────────────────────────────────────────────────
  layout: {
    profileTemplate: "centered",     // "avatar-left" | "centered" | "banner"
    showRating:      false,
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
      label:        "Post",
      iconId:       "FileText",
      subtitle:     "Posts & threads",
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
      id:           "stats",
      label:        "Stats",
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
