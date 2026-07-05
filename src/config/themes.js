/**
 * themes.js
 *
 * All visual themes available to the platform.
 * Each theme is a complete token set. The AI selects a paletteId;
 * ThemeProvider resolves it to CSS custom properties at runtime.
 *
 * To add a new theme: add an entry to THEME_REGISTRY and it becomes
 * immediately available to the AI and to the theme picker UI.
 */

export const THEME_REGISTRY = {

  "dark-purple": {
    label: "Dark Purple",
    description: "Deep space with electric violet — the default",
    preview: ["#08080e", "#7c4dff", "#22d3a0"],
    tokens: {
      bg:          "#000000",
      surface:     "#0a0a0a",
      card:        "#13131f",
      cardHover:   "#19192a",
      border:      "#1c1c2e",
      accent:      "#7c4dff",
      accentLight: "#9d71ff",
      accentDim:   "#3d2480",
      text:        "#fafafa",
      textMuted:   "#8e8e8e",
      textDim:     "#32324a",
      green:       "#1ed99a",
      greenDim:    "rgba(30,217,154,0.12)",
      amber:       "#f5a623",
      gold:        "#d4a843",
      goldLight:   "#f0c866",
      blue:        "#4fa3ff",
      red:         "#ff4f6a",
      orange:      "#f97316",
      teal:        "#22d3a0",
    },
  },

  "dark-mono": {
    label: "Dark Mono",
    description: "Minimal monochrome — clean, distraction-free",
    preview: ["#0a0a0a", "#e0e0e0", "#555"],
    tokens: {
      bg:          "#0a0a0a",
      surface:     "#111111",
      card:        "#181818",
      cardHover:   "#202020",
      border:      "#2a2a2a",
      accent:      "#e0e0e0",
      accentLight: "#ffffff",
      accentDim:   "#333333",
      text:        "#fafafa",
      textMuted:   "#8e8e8e",
      textDim:     "#303030",
      green:       "#5dfc8d",
      greenDim:    "rgba(93,252,141,0.10)",
      amber:       "#f5c842",
      gold:        "#c8a84b",
      goldLight:   "#e8c96a",
      blue:        "#6ab4ff",
      red:         "#ff5566",
      orange:      "#ff8c42",
      teal:        "#4dd9c0",
    },
  },

  "midnight-gold": {
    label: "Midnight Gold",
    description: "Black with gold accents — ultra premium",
    preview: ["#050505", "#d4a843", "#1a1200"],
    tokens: {
      bg:          "#050505",
      surface:     "#0c0c0c",
      card:        "#111108",
      cardHover:   "#161610",
      border:      "#1e1e10",
      accent:      "#d4a843",
      accentLight: "#f0c866",
      accentDim:   "#3d2f00",
      text:        "#fafafa",
      textMuted:   "#8e8e8e",
      textDim:     "#2a2518",
      green:       "#4dcc88",
      greenDim:    "rgba(77,204,136,0.10)",
      amber:       "#f5a623",
      gold:        "#d4a843",
      goldLight:   "#f0c866",
      blue:        "#4fa3ff",
      red:         "#ff4f6a",
      orange:      "#f97316",
      teal:        "#22d3a0",
    },
  },

  "trader-dark": {
    label: "Trader Dark",
    description: "High contrast green-on-black — terminal aesthetic",
    preview: ["#040d04", "#00ff88", "#003a1a"],
    tokens: {
      bg:          "#040d04",
      surface:     "#081408",
      card:        "#0d1a0d",
      cardHover:   "#122012",
      border:      "#1a2e1a",
      accent:      "#00ff88",
      accentLight: "#33ffaa",
      accentDim:   "#003a1a",
      text:        "#fafafa",
      textMuted:   "#8e8e8e",
      textDim:     "#1a3a1a",
      green:       "#00ff88",
      greenDim:    "rgba(0,255,136,0.10)",
      amber:       "#ffe566",
      gold:        "#d4a843",
      goldLight:   "#f0c866",
      blue:        "#44aaff",
      red:         "#ff4455",
      orange:      "#ff8833",
      teal:        "#00e5cc",
    },
  },

  "deep-blue": {
    label: "Deep Blue",
    description: "Navy with electric blue — professional & calm",
    preview: ["#040814", "#4fa3ff", "#0a1628"],
    tokens: {
      bg:          "#040814",
      surface:     "#080e1e",
      card:        "#0d1628",
      cardHover:   "#121e32",
      border:      "#1a2a44",
      accent:      "#4fa3ff",
      accentLight: "#7bbfff",
      accentDim:   "#0a2040",
      text:        "#fafafa",
      textMuted:   "#8e8e8e",
      textDim:     "#1a2a44",
      green:       "#2de898",
      greenDim:    "rgba(45,232,152,0.10)",
      amber:       "#f5c842",
      gold:        "#d4a843",
      goldLight:   "#f0c866",
      blue:        "#4fa3ff",
      red:         "#ff5577",
      orange:      "#ff8844",
      teal:        "#22d3e0",
    },
  },
};

/**
 * Resolve a paletteId + optional overrides into a flat token object.
 * This is what ThemeProvider uses to set CSS custom properties.
 */
export function resolveTheme(paletteId, accentOverride = null) {
  const palette = THEME_REGISTRY[paletteId] ?? THEME_REGISTRY["dark-purple"];
  const tokens  = { ...palette.tokens };
  if (accentOverride) {
    tokens.accent      = accentOverride;
    tokens.accentLight = accentOverride + "cc";
    tokens.accentDim   = accentOverride + "33";
  }
  return tokens;
}

/**
 * Apply resolved tokens as CSS custom properties on :root.
 * Called by ThemeProvider whenever the config theme changes.
 */
export function applyThemeToDOM(tokens) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(`--c-${key}`, value);
  });
}

/**
 * Generate a C object (matching the existing C.xxx usage pattern)
 * from resolved tokens. Used for backward-compat during migration.
 */
export function tokensToC(tokens) {
  return { ...tokens };
}
