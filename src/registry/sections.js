/**
 * sections.js
 *
 * Maps section ids to their React component implementations.
 * Kept separate from the JSON config so config stays serializable.
 *
 * Built-in sections are registered here.
 * Custom sections (user-created) use CustomSectionContent by default,
 * but could be upgraded to richer implementations in the future.
 */

import Planning      from "../sections/Planning.jsx";
import Recaps        from "../sections/Recaps.jsx";
import Announcements from "../sections/Announcements.jsx";

// Lazy-loaded content components (defined in App.jsx, passed in at registration)
// We use a mutable registry so App.jsx can register its local components
// without creating circular imports.
const SECTION_REGISTRY = {};

/**
 * Register a component for a section id.
 * Called during app initialization for built-in and dynamic sections.
 */
export function registerSection(id, Component) {
  SECTION_REGISTRY[id] = Component;
}

/**
 * Resolve a section id to its React component.
 * Returns null if no component is registered (caller handles fallback).
 */
export function resolveSection(id) {
  return SECTION_REGISTRY[id] ?? null;
}

/**
 * Pre-register all built-in sections.
 * Called once at app startup.
 */
export function registerBuiltInSections(extraComponents = {}) {
  SECTION_REGISTRY["planning"]      = Planning;
  SECTION_REGISTRY["recaps"]        = Recaps;
  SECTION_REGISTRY["announcements"] = Announcements;

  // These are registered from App.jsx (local components)
  Object.entries(extraComponents).forEach(([id, Component]) => {
    SECTION_REGISTRY[id] = Component;
  });
}
