/**
 * aiPersonalization.js  —  Hybrid Personalization Engine
 *
 * TWO-LAYER ARCHITECTURE:
 *
 *  Layer 1 — LOCAL SMART ENGINE  (zero API cost, instant)
 *    Handles all common/structural requests via:
 *    - keyword pattern matching (multilingual: en + es)
 *    - intent classifier returning a typed IntentResult
 *    - config transformation rules
 *    - widget/section reorder logic
 *    - theme/layout/visibility mutations
 *
 *  Layer 2 — ADVANCED AI ENGINE  (Claude API, tokens consumed)
 *    Only invoked when the local classifier returns confidence < THRESHOLD
 *    or intent type === "creative_aesthetic"
 *    Handles abstract/creative prompts that require genuine language reasoning.
 *
 *  The caller NEVER chooses the engine. classifyPrompt() decides automatically.
 *
 *  Entry point:  applyPersonalizationPrompt(prompt, currentConfig)
 *  Returns:      { newConfig, diff, applied, engine, label, error }
 *                engine: "local" | "ai"
 */

import { validateConfigDiff, mergeProfileConfig } from "../config/profileConfig.js";
import { THEME_REGISTRY }                         from "../config/themes.js";
import { ICON_OPTIONS }                           from "../registry/icons.js";

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — INTENT CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intent types the local engine can handle directly.
 * Anything not matched → "creative_aesthetic" → routed to AI.
 */
const INTENT_TYPES = {
  THEME_SWITCH:       "theme_switch",       // "use premium theme", "dark mode"
  VISIBILITY_TOGGLE:  "visibility_toggle",  // "hide badges", "show reviews"
  WIDGET_REORDER:     "widget_reorder",     // "move badges before reviews"
  SECTION_REORDER:    "section_reorder",    // "put metrics first"
  SECTION_TOGGLE:     "section_toggle",     // "hide the metrics section"
  LAYOUT_CHANGE:      "layout_change",      // "center my profile", "avatar left"
  DENSITY_CHANGE:     "density_change",     // "make it more compact"
  GLOW_TOGGLE:        "glow_toggle",        // "turn off glows", "more glow"
  ANIMATION_CHANGE:   "animation_change",   // "slower animations", "more expressive"
  FONT_SCALE:         "font_scale",         // "bigger text", "smaller font"
  BORDER_RADIUS:      "border_radius",      // "sharper corners", "more rounded"
  PRESET:             "preset",             // "minimal", "premium", "trader"
  CREATIVE_AESTHETIC: "creative_aesthetic", // fallthrough → AI
};

/** Normalized aliases for theme names (en + es) */
const THEME_ALIASES = {
  "dark-purple":   ["purple", "violet", "morado", "purpura", "default", "original"],
  "dark-mono":     ["mono", "monochrome", "minimal", "minimalista", "clean", "limpio", "simple", "black", "negro", "grey", "gray"],
  "midnight-gold": ["gold", "oro", "golden", "dorado", "premium", "luxury", "lujo", "midnight", "medianoche"],
  "trader-dark":   ["trader", "trading", "terminal", "green", "verde", "matrix", "professional", "profesional"],
  "deep-blue":     ["blue", "azul", "navy", "marino", "ocean", "oceano", "calm", "calmado"],
};

/** Widget label aliases (en + es) */
const WIDGET_ALIASES = {
  "latest-trades": ["trades", "trade", "operaciones", "latest", "últimas", "ultimas", "trading"],
  "reviews-mini":  ["reviews", "reseñas", "resenas", "review", "ratings", "valoraciones"],
  "badges":        ["badges", "badges", "insignias", "trofeos", "achievements", "logros"],
  "section-feed":  ["sections", "feed", "secciones", "posts", "publicaciones", "content"],
};

/** Section label aliases */
const SECTION_ALIASES = {
  "planning":      ["planning", "planificación", "plan", "plans", "análisis", "analysis"],
  "recaps":        ["updates", "recaps", "actualizaciones", "resúmenes"],
  "announcements": ["announcements", "anuncios", "announcement"],
  "metrics":       ["metrics", "métricas", "stats", "estadísticas", "performance"],
  "rooms":         ["rooms", "salas", "chat", "live", "directo"],
};

/** Normalize: lowercase, strip accents/punctuation */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score how many tokens from `tokens` appear in `text` */
function tokenScore(text, tokens) {
  return tokens.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
}

/** Find which entity id (theme/widget/section) best matches a normalized prompt */
function matchEntity(norm, aliasMap) {
  let bestId = null, bestScore = 0;
  for (const [id, aliases] of Object.entries(aliasMap)) {
    const score = tokenScore(norm, aliases);
    if (score > bestScore) { bestScore = score; bestId = id; }
  }
  return bestScore > 0 ? bestId : null;
}

/** Extract a numeric value from tokens like "2x", "20%", "bigger", "smaller" */
function extractMagnitude(norm) {
  const bigger  = /bigger|larger|increase|mas grande|aumentar|subir|up/.test(norm);
  const smaller = /smaller|decrease|mas pequeño|reducir|bajar|down/.test(norm);
  const m = norm.match(/(\d+(?:\.\d+)?)\s*(?:x|%|pt|px)?/);
  if (m) return parseFloat(m[1]);
  if (bigger)  return 1;   // +1 step
  if (smaller) return -1;  // -1 step
  return 0;
}

/**
 * Primary classifier — returns typed intent with confidence 0–1.
 * High confidence (≥0.65) → local engine.
 * Low confidence (<0.65)  → AI engine.
 */
export function classifyPrompt(prompt) {
  const norm = normalize(prompt);
  const words = norm.split(" ");

  // ── PRESET detection (highest priority) ──────────────────────────────────
  const presetMap = {
    minimal:   ["minimal", "minimalista", "simple", "clean", "limpio"],
    premium:   ["premium", "luxury", "lujo", "exclusive", "exclusivo", "gold", "oro", "vip"],
    trader:    ["trader", "trading", "professional", "profesional", "terminal", "matrix"],
    social:    ["social", "community", "comunidad", "vibrant", "vibrante", "engaging"],
    default:   ["reset", "default", "original", "restore", "restaurar", "volver"],
  };
  for (const [id, aliases] of Object.entries(presetMap)) {
    if (tokenScore(norm, aliases) >= 1) {
      // Extra check: if also has aesthetic modifiers, might be creative
      const hasAesthetic = /feel|feels|vibe|vibes|aesthetic|like a|como un|como una|style of/.test(norm);
      if (!hasAesthetic) return { type: INTENT_TYPES.PRESET, presetId: id, confidence: 0.9 };
    }
  }

  // ── THEME SWITCH ─────────────────────────────────────────────────────────
  const themeVerbs = ["use", "switch", "change", "apply", "usa", "cambia", "pon", "aplica", "quiero", "want", "make", "haz"];
  const hasThemeVerb = tokenScore(norm, themeVerbs) > 0;
  const matchedTheme = matchEntity(norm, THEME_ALIASES);
  if (matchedTheme && (hasThemeVerb || words.length <= 4)) {
    return { type: INTENT_TYPES.THEME_SWITCH, themeId: matchedTheme, confidence: 0.88 };
  }
  // Implicit theme from aesthetic words
  const darkerWords = ["darker", "dark", "oscuro", "mas oscuro", "more dark", "blackout"];
  const lighterWords = ["lighter", "brighter", "lighter", "más claro"];
  if (tokenScore(norm, darkerWords) > 0) return { type: INTENT_TYPES.THEME_SWITCH, themeId: "dark-mono", confidence: 0.75 };

  // ── VISIBILITY TOGGLE ────────────────────────────────────────────────────
  const hideVerbs = ["hide", "remove", "oculta", "ocultar", "quita", "quitar", "elimina", "remove", "sin", "without", "disable", "deshabilita"];
  const showVerbs = ["show", "display", "muestra", "mostrar", "añade", "add", "enable", "habilita", "bring back", "restore"];
  const hasHide = tokenScore(norm, hideVerbs) > 0;
  const hasShow = tokenScore(norm, showVerbs) > 0;
  if (hasHide || hasShow) {
    const widgetId  = matchEntity(norm, WIDGET_ALIASES);
    const sectionId = matchEntity(norm, SECTION_ALIASES);
    if (widgetId)  return { type: INTENT_TYPES.VISIBILITY_TOGGLE, entityType: "widget",  id: widgetId,  visible: hasShow, confidence: 0.92 };
    if (sectionId) return { type: INTENT_TYPES.SECTION_TOGGLE,    entityType: "section", id: sectionId, visible: hasShow, confidence: 0.92 };
  }

  // ── REORDER detection ────────────────────────────────────────────────────
  const moveVerbs  = ["move", "put", "place", "mueve", "pon", "coloca", "bring", "push"];
  const orderWords = ["before", "after", "above", "below", "first", "last", "primero", "último", "antes", "después", "arriba", "abajo", "higher", "lower", "top", "bottom"];
  const hasMoveVerb  = tokenScore(norm, moveVerbs)  > 0;
  const hasOrderWord = tokenScore(norm, orderWords) > 0;
  if (hasMoveVerb || hasOrderWord) {
    const widgetId  = matchEntity(norm, WIDGET_ALIASES);
    const sectionId = matchEntity(norm, SECTION_ALIASES);
    if (widgetId)  return { type: INTENT_TYPES.WIDGET_REORDER,  id: widgetId,  norm, confidence: 0.80 };
    if (sectionId) return { type: INTENT_TYPES.SECTION_REORDER, id: sectionId, norm, confidence: 0.80 };
  }

  // ── LAYOUT ───────────────────────────────────────────────────────────────
  const centerWords = ["center", "centrar", "centered", "centrado", "middle"];
  const leftWords   = ["left", "izquierda", "avatar left", "lado izquierdo"];
  const bannerWords = ["banner", "wide", "full", "amplio", "cover"];
  if (tokenScore(norm, centerWords) > 0) return { type: INTENT_TYPES.LAYOUT_CHANGE, template: "centered",   confidence: 0.85 };
  if (tokenScore(norm, leftWords)   > 0) return { type: INTENT_TYPES.LAYOUT_CHANGE, template: "avatar-left", confidence: 0.85 };
  if (tokenScore(norm, bannerWords) > 0) return { type: INTENT_TYPES.LAYOUT_CHANGE, template: "banner",      confidence: 0.85 };

  // ── DENSITY ──────────────────────────────────────────────────────────────
  const compactWords  = ["compact", "compacto", "dense", "tight", "apretado", "condensado"];
  const spaciousWords = ["spacious", "espacioso", "airy", "open", "abierto", "spread", "breathing"];
  if (tokenScore(norm, compactWords)  > 0) return { type: INTENT_TYPES.DENSITY_CHANGE, density: "compact",   confidence: 0.85 };
  if (tokenScore(norm, spaciousWords) > 0) return { type: INTENT_TYPES.DENSITY_CHANGE, density: "spacious",  confidence: 0.85 };

  // ── GLOW ─────────────────────────────────────────────────────────────────
  const glowOnWords  = ["glow", "glow on", "more glow", "más brillo", "luminoso", "glowing", "neon"];
  const glowOffWords = ["no glow", "sin brillo", "flat", "matte", "apaga brillo", "remove glow", "glow off", "sin resplandor"];
  if (tokenScore(norm, glowOffWords) > 0) return { type: INTENT_TYPES.GLOW_TOGGLE, value: false, confidence: 0.88 };
  if (tokenScore(norm, glowOnWords)  > 0) return { type: INTENT_TYPES.GLOW_TOGGLE, value: true,  confidence: 0.88 };

  // ── ANIMATIONS ───────────────────────────────────────────────────────────
  const slowWords      = ["slow", "lento", "reduce animation", "less animation", "calm", "tranquilo", "reduced motion"];
  const fastWords      = ["fast", "rápido", "expressive", "expresivo", "snappy", "dynamic", "dinámico", "more animation"];
  const normalAnimWords = ["normal animation", "animación normal", "default animation"];
  if (tokenScore(norm, slowWords)       > 0) return { type: INTENT_TYPES.ANIMATION_CHANGE, speed: "reduced",    confidence: 0.85 };
  if (tokenScore(norm, fastWords)       > 0) return { type: INTENT_TYPES.ANIMATION_CHANGE, speed: "expressive", confidence: 0.85 };
  if (tokenScore(norm, normalAnimWords) > 0) return { type: INTENT_TYPES.ANIMATION_CHANGE, speed: "normal",     confidence: 0.85 };

  // ── FONT SCALE ───────────────────────────────────────────────────────────
  const bigFontWords   = ["bigger text", "larger text", "bigger font", "increase font", "texto más grande", "letra más grande", "larger"];
  const smallFontWords = ["smaller text", "smaller font", "decrease font", "texto más pequeño", "letra más pequeña", "smaller"];
  if (tokenScore(norm, bigFontWords)   > 0) return { type: INTENT_TYPES.FONT_SCALE, direction:  1, confidence: 0.85 };
  if (tokenScore(norm, smallFontWords) > 0) return { type: INTENT_TYPES.FONT_SCALE, direction: -1, confidence: 0.85 };

  // ── BORDER RADIUS ────────────────────────────────────────────────────────
  const sharpWords  = ["sharp", "angular", "square corners", "esquinas rectas", "no rounded", "sin redondeo"];
  const roundWords  = ["round", "rounded", "redondeado", "soft corners", "esquinas suaves"];
  const pillWords   = ["pill", "pill shape", "very round", "muy redondeado", "capsule", "capsula"];
  if (tokenScore(norm, sharpWords) > 0) return { type: INTENT_TYPES.BORDER_RADIUS, value: "sharp",   confidence: 0.85 };
  if (tokenScore(norm, pillWords)  > 0) return { type: INTENT_TYPES.BORDER_RADIUS, value: "pill",    confidence: 0.85 };
  if (tokenScore(norm, roundWords) > 0) return { type: INTENT_TYPES.BORDER_RADIUS, value: "rounded", confidence: 0.85 };

  // ── FALLTHROUGH → CREATIVE AESTHETIC (AI) ────────────────────────────────
  return { type: INTENT_TYPES.CREATIVE_AESTHETIC, confidence: 0.0 };
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — LOCAL TRANSFORM ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reorder helper: move item `id` to just before `targetId` in an array.
 * Works for both widgets and sections (any array of objects with .id and .order).
 */
function reorderBefore(items, id, targetId) {
  const arr = [...items].sort((a, b) => a.order - b.order);
  const srcIdx = arr.findIndex(x => x.id === id);
  const tgtIdx = arr.findIndex(x => x.id === targetId);
  if (srcIdx < 0) return items;
  const [removed] = arr.splice(srcIdx, 1);
  const insertAt = tgtIdx < srcIdx ? tgtIdx : tgtIdx - 1;
  arr.splice(Math.max(0, insertAt), 0, removed);
  return arr.map((x, i) => ({ ...x, order: i }));
}

function reorderFirst(items, id) {
  const arr = [...items].sort((a, b) => a.order - b.order);
  const idx = arr.findIndex(x => x.id === id);
  if (idx < 0) return items;
  const [removed] = arr.splice(idx, 1);
  arr.unshift(removed);
  return arr.map((x, i) => ({ ...x, order: i }));
}

function reorderLast(items, id) {
  const arr = [...items].sort((a, b) => a.order - b.order);
  const idx = arr.findIndex(x => x.id === id);
  if (idx < 0) return items;
  const [removed] = arr.splice(idx, 1);
  arr.push(removed);
  return arr.map((x, i) => ({ ...x, order: i }));
}

function detectReorderTarget(norm, aliasMap, currentItems, excludeId) {
  // Find a secondary entity in the prompt (the "anchor" for before/after)
  for (const [id, aliases] of Object.entries(aliasMap)) {
    if (id === excludeId) continue;
    if (tokenScore(norm, aliases) > 0) return id;
  }
  return null;
}

/**
 * Apply a classified local intent to the current config.
 * Returns { diff, label } — diff is merged externally.
 */
function applyLocalIntent(intent, currentConfig) {
  const { type } = intent;

  switch (type) {

    case INTENT_TYPES.PRESET: {
      const preset = PRESET_CONFIGS[intent.presetId];
      return { diff: preset, label: `Preset applied: ${intent.presetId}` };
    }

    case INTENT_TYPES.THEME_SWITCH: {
      const diff = { theme: { paletteId: intent.themeId } };
      return { diff, label: `Theme → ${intent.themeId}` };
    }

    case INTENT_TYPES.VISIBILITY_TOGGLE: {
      const diff = { feedWidgets: [{ id: intent.id, visible: intent.visible }] };
      return { diff, label: `${intent.visible ? "Showed" : "Hidden"} widget: ${intent.id}` };
    }

    case INTENT_TYPES.SECTION_TOGGLE: {
      const diff = { sections: [{ id: intent.id, visible: intent.visible }] };
      return { diff, label: `${intent.visible ? "Showed" : "Hidden"} section: ${intent.id}` };
    }

    case INTENT_TYPES.WIDGET_REORDER: {
      const norm = intent.norm;
      const isFirst = /first|top|primero|arriba|higher/.test(norm);
      const isLast  = /last|bottom|último|abajo|lower/.test(norm);
      let newWidgets;
      if (isFirst) {
        newWidgets = reorderFirst(currentConfig.feedWidgets, intent.id);
      } else if (isLast) {
        newWidgets = reorderLast(currentConfig.feedWidgets, intent.id);
      } else {
        const targetId = detectReorderTarget(norm, WIDGET_ALIASES, currentConfig.feedWidgets, intent.id);
        newWidgets = targetId
          ? reorderBefore(currentConfig.feedWidgets, intent.id, targetId)
          : reorderFirst(currentConfig.feedWidgets, intent.id);
      }
      return { diff: { feedWidgets: newWidgets }, label: `Reordered widget: ${intent.id}` };
    }

    case INTENT_TYPES.SECTION_REORDER: {
      const norm = intent.norm;
      const isFirst = /first|top|primero|arriba/.test(norm);
      const isLast  = /last|bottom|último|abajo/.test(norm);
      let newSections;
      if (isFirst) {
        newSections = reorderFirst(currentConfig.sections, intent.id);
      } else if (isLast) {
        newSections = reorderLast(currentConfig.sections, intent.id);
      } else {
        const targetId = detectReorderTarget(norm, SECTION_ALIASES, currentConfig.sections, intent.id);
        newSections = targetId
          ? reorderBefore(currentConfig.sections, intent.id, targetId)
          : reorderFirst(currentConfig.sections, intent.id);
      }
      return { diff: { sections: newSections }, label: `Reordered section: ${intent.id}` };
    }

    case INTENT_TYPES.LAYOUT_CHANGE: {
      return { diff: { layout: { profileTemplate: intent.template } }, label: `Layout → ${intent.template}` };
    }

    case INTENT_TYPES.DENSITY_CHANGE: {
      return { diff: { theme: { density: intent.density } }, label: `Density → ${intent.density}` };
    }

    case INTENT_TYPES.GLOW_TOGGLE: {
      return { diff: { theme: { glowEffects: intent.value } }, label: `Glow effects → ${intent.value ? "on" : "off"}` };
    }

    case INTENT_TYPES.ANIMATION_CHANGE: {
      return { diff: { theme: { animationSpeed: intent.speed } }, label: `Animations → ${intent.speed}` };
    }

    case INTENT_TYPES.FONT_SCALE: {
      const current = currentConfig.theme.fontScale ?? 1.0;
      const step = 0.08;
      const next = Math.min(1.25, Math.max(0.85, current + intent.direction * step));
      return { diff: { theme: { fontScale: next } }, label: `Font scale → ${next.toFixed(2)}` };
    }

    case INTENT_TYPES.BORDER_RADIUS: {
      return { diff: { theme: { borderRadius: intent.value } }, label: `Borders → ${intent.value}` };
    }

    default:
      return null;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — ADVANCED AI ENGINE  (Claude API)
// ─────────────────────────────────────────────────────────────────────────────

const AI_CONFIDENCE_THRESHOLD = 0.65; // below this → use AI

function buildSystemPrompt(currentConfig) {
  const availableThemes = Object.entries(THEME_REGISTRY)
    .map(([id, t]) => `  - "${id}": ${t.description}`)
    .join("\n");

  const currentSections = currentConfig.sections
    .map(s => `  - id:"${s.id}" label:"${s.label}" visible:${s.visible} order:${s.order}`)
    .join("\n");

  return `You are a profile personalization AI for a creator/social platform called Workspace.
Translate the user request into a partial JSON config diff. Output ONLY valid JSON, no markdown.

## Modifiable keys

theme: { paletteId, accentOverride, borderRadius, fontScale, density, glowEffects, animationSpeed }
  paletteId options: ${Object.keys(THEME_REGISTRY).join(", ")}
  borderRadius: "sharp"|"rounded"|"pill"
  density: "compact"|"comfortable"|"spacious"
  animationSpeed: "reduced"|"normal"|"expressive"

layout: { profileTemplate, showBio, showStats, showRating, showLiveDot, showActionButtons }
  profileTemplate: "avatar-left"|"centered"|"banner"

feedWidgets: [{ id, visible, order }]
  ids: "latest-trades", "reviews-mini", "badges", "section-feed"

sections: [{ id, visible, order }]
  current sections:
${currentSections}

identity: { bio, bioHighlight } — only if the request is clearly about bio text

## Available themes
${availableThemes}

## Current state
- Theme: ${currentConfig.theme.paletteId}, borderRadius: ${currentConfig.theme.borderRadius}
- Layout: ${currentConfig.layout.profileTemplate}
- Glow: ${currentConfig.theme.glowEffects}, density: ${currentConfig.theme.density}

## Rules
- Output ONLY the keys that change. Minimal diff.
- Never set identity.handle.
- For abstract aesthetic prompts, pick a fitting theme + borderRadius + glowEffects combo.
- For structural prompts, only change sections/feedWidgets.
- fontScale changes: ±0.1 max.

Output only JSON.`;
}

async function applyAIEngine(prompt, currentConfig) {
  const systemPrompt = buildSystemPrompt(currentConfig);
  let rawResponse = "";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 800,
        system:     systemPrompt,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data  = await response.json();
    rawResponse = data.content?.[0]?.text ?? "";
    const clean = rawResponse.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const diff  = JSON.parse(clean);

    const { valid, errors } = validateConfigDiff(diff);
    if (!valid) throw new Error(`Validation: ${errors.join(", ")}`);

    return { diff, applied: true, error: null };

  } catch (err) {
    console.error("[AI Engine]", err, "\nRaw:", rawResponse);
    return { diff: null, applied: false, error: err.message };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — UNIFIED ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main function. Automatically routes to local or AI engine.
 *
 * @param {string} prompt
 * @param {object} currentConfig
 * @returns {{ newConfig, diff, applied, engine, label, error }}
 */
export async function applyPersonalizationPrompt(prompt, currentConfig) {
  const intent  = classifyPrompt(prompt);
  const isLocal = intent.type !== INTENT_TYPES.CREATIVE_AESTHETIC
               && intent.confidence >= AI_CONFIDENCE_THRESHOLD;

  // ── LOCAL PATH ────────────────────────────────────────────────────────────
  if (isLocal) {
    const result = applyLocalIntent(intent, currentConfig);
    if (result?.diff) {
      const { valid, errors } = validateConfigDiff(result.diff);
      if (!valid) return { newConfig: currentConfig, diff: null, applied: false, engine: "local", label: "", error: errors.join(", ") };
      const newConfig = mergeProfileConfig(currentConfig, result.diff);
      return { newConfig, diff: result.diff, applied: true, engine: "local", label: result.label, error: null };
    }
  }

  // ── AI PATH ───────────────────────────────────────────────────────────────
  const { diff, applied, error } = await applyAIEngine(prompt, currentConfig);
  if (!applied) return { newConfig: currentConfig, diff: null, applied: false, engine: "ai", label: "", error };
  const newConfig = mergeProfileConfig(currentConfig, diff);
  return { newConfig, diff, applied: true, engine: "ai", label: "AI redesign applied", error: null };
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — PRESETS  (instant, no routing needed)
// ─────────────────────────────────────────────────────────────────────────────

export const PRESET_CONFIGS = {
  "minimal": {
    theme:       { paletteId: "dark-mono", glowEffects: false, borderRadius: "sharp", density: "compact", animationSpeed: "reduced" },
    layout:      { showBio: true, showStats: true, showRating: false },
    feedWidgets: [
      { id: "latest-trades", visible: true,  order: 0 },
      { id: "section-feed",  visible: true,  order: 1 },
      { id: "reviews-mini",  visible: false, order: 2 },
      { id: "badges",        visible: false, order: 3 },
    ],
  },
  "premium": {
    theme:  { paletteId: "midnight-gold", borderRadius: "pill", glowEffects: true, animationSpeed: "expressive" },
    layout: { profileTemplate: "centered" },
  },
  "trader": {
    theme:    { paletteId: "trader-dark", density: "compact", borderRadius: "sharp" },
    sections: [
      { id: "metrics",       visible: true, order: 0 },
      { id: "recaps",        visible: true, order: 1 },
      { id: "planning",      visible: true, order: 2 },
      { id: "announcements", visible: true, order: 3 },
      { id: "rooms",         visible: true, order: 4 },
    ],
    feedWidgets: [
      { id: "latest-trades", visible: true,  order: 0 },
      { id: "section-feed",  visible: true,  order: 1 },
      { id: "reviews-mini",  visible: false, order: 2 },
      { id: "badges",        visible: false, order: 3 },
    ],
  },
  "social": {
    theme:       { paletteId: "dark-purple", glowEffects: true, animationSpeed: "expressive" },
    layout:      { profileTemplate: "centered" },
    feedWidgets: [
      { id: "reviews-mini",  visible: true, order: 0 },
      { id: "badges",        visible: true, order: 1 },
      { id: "latest-trades", visible: true, order: 2 },
      { id: "section-feed",  visible: true, order: 3 },
    ],
  },
  "default": {
    theme:       { paletteId: "dark-purple", glowEffects: true, borderRadius: "rounded", density: "comfortable", animationSpeed: "normal" },
    layout:      { profileTemplate: "avatar-left", showBio: true, showStats: true, showRating: true },
    feedWidgets: [
      { id: "latest-trades", visible: true,  order: 0 },
      { id: "reviews-mini",  visible: true,  order: 1 },
      { id: "section-feed",  visible: true,  order: 2 },
      { id: "badges",        visible: true,  order: 3 },
    ],
  },
};

export function applyPreset(presetId, currentConfig) {
  const preset = PRESET_CONFIGS[presetId];
  if (!preset) return { newConfig: currentConfig, applied: false };
  return { newConfig: mergeProfileConfig(currentConfig, preset), applied: true };
}
