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
  // Everything ProfileRegion shows about the profile owner, minus live
  // numbers: Trades and Winrate come from Doers Journal (statsApi.js, via
  // App.jsx), and there is no followers source yet — so none of those are
  // stored here, and nothing in this file should ever hold a placeholder
  // figure for them.
  identity: {
    name:       "Luis Morp",
    handle:     "@luismorp",
    avatarUrl:  null,          // null = initial-of-name fallback
    bio:        "Trader & educator — 6+ years in FX & commodities. Sharing live setups, weekly recaps & real-time analysis.",
    bioHighlight: "XAUUSD · DXY · EURUSD",
    verified:   true,
    liveNow:    true,          // green dot on the avatar
  },

  // ── Social links shown in the side column of the expanded profile. Empty by
  // default — ready for the user to connect accounts; each entry needs
  // { platform, url }. platform resolves to an icon via SOCIAL_ICON_MAP in
  // ProfileRegion.jsx (falls back to a generic link icon for anything not
  // explicitly mapped yet).
  socials: [],

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
    {
      id:           "tools",
      label:        "Tools",
      iconId:       "Wrench",
      subtitle:     "Trading utilities & calculators",
      accentColor:  "#d4a843",
      badge:        null,
      visible:      true,
      order:        5,
      isBuiltIn:    true,
    },
  ],
};
