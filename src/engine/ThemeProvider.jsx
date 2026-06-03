/**
 * ThemeProvider.jsx
 *
 * Reads the active theme config and applies it as CSS custom properties on :root.
 * All components read from CSS variables (or from the C object derived from them),
 * so changing the theme is instant — no component re-renders needed for styling.
 *
 * Also exposes useTheme() hook so components can read the current C token object.
 */

import { createContext, useContext, useEffect, useMemo } from "react";
import { resolveTheme, applyThemeToDOM, tokensToC } from "../config/themes.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ themeConfig, children }) {
  // Resolve paletteId + optional override → flat token object
  const tokens = useMemo(
    () => resolveTheme(themeConfig.paletteId, themeConfig.accentOverride),
    [themeConfig.paletteId, themeConfig.accentOverride]
  );

  // Apply to DOM as CSS variables whenever tokens change
  useEffect(() => {
    applyThemeToDOM(tokens);
  }, [tokens]);

  // Derive border-radius scale from config
  useEffect(() => {
    const BR = { sharp: "6px", rounded: "12px", pill: "99px" };
    const br = BR[themeConfig.borderRadius] ?? "12px";
    document.documentElement.style.setProperty("--br-base", br);
    document.documentElement.style.setProperty("--br-sm",   `calc(${br} * 0.6)`);
    document.documentElement.style.setProperty("--br-lg",   `calc(${br} * 1.5)`);
    document.documentElement.style.setProperty("--br-card",  br);
    document.documentElement.style.setProperty("--br-chip",  themeConfig.borderRadius === "pill" ? "99px" : br);
  }, [themeConfig.borderRadius]);

  // Font scale
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", themeConfig.fontScale ?? 1);
  }, [themeConfig.fontScale]);

  // Animation speed
  useEffect(() => {
    const speeds = { reduced: "0.1s", normal: "0.22s", expressive: "0.38s" };
    document.documentElement.style.setProperty(
      "--anim-speed", speeds[themeConfig.animationSpeed] ?? "0.22s"
    );
  }, [themeConfig.animationSpeed]);

  // C object for backward compatibility (components still use C.accent etc.)
  const C = useMemo(() => tokensToC(tokens), [tokens]);

  return (
    <ThemeContext.Provider value={{ C, tokens, themeConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook: returns the C token object for the current theme.
 * Drop-in replacement for the old `const C = { ... }` constant.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
