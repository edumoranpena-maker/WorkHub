/**
 * textToSpeech.js
 *
 * Reads a content's plain-text description aloud via the browser's built-in
 * SpeechSynthesis API — no external services. This is the TTS counterpart
 * to audioPlayback.js (recorded voice notes), rewritten around a single
 * explicit source of truth per the product spec:
 *
 *   activeContentId — which content (post/update/subtema id) is currently
 *                      loaded into the synthesizer, or null.
 *   speechState      — "idle" | "playing" | "paused"
 *
 * Every UI instance (Post/Update/Subtema inline, fullscreen viewer) reads
 * BOTH of these from the same store and compares its own contentId against
 * activeContentId — there is no per-instance "am I playing" flag anywhere,
 * which is what the previous version got wrong (see history below).
 *
 * ── Why the previous version broke ──────────────────────────────────────
 * Two separate bugs, now fixed by this rewrite:
 *
 * 1. Race condition on content switch. Starting a new utterance called
 *    speechSynthesis.cancel() on the OLD one, but the old utterance's
 *    onend/onerror fires asynchronously — sometimes AFTER the new session's
 *    state had already been written. Because those callbacks mutated a
 *    shared mutable object by reference (not a value captured per-utterance),
 *    the stale callback from utterance A could stomp on utterance B's just-
 *    started state, making the UI think nothing was playing even though
 *    SpeechSynthesis was actually mid-utterance. Fixed here with a
 *    `generation` counter: every speak()/stop() bumps it, and every
 *    utterance's callbacks capture the generation they belong to and bail
 *    out if a newer one has since started — a stale utterance can never
 *    touch current state.
 * 2. Stopping was tied to component UNMOUNT, which is a proxy for "the user
 *    left this content" that breaks the moment that assumption isn't true —
 *    exactly what happens in the fullscreen viewer, where the description
 *    (and the button inside it) unmounts/remounts purely because the chrome
 *    auto-hides, with no actual content change. Fixed here by removing all
 *    unmount-based stopping from the hook: stopSpeech() is now called ONLY
 *    from real navigation/content-change events (ThreadView/SubtemaView
 *    enter/leave, the fullscreen viewer's content-change effect, the
 *    Android back button) — the same explicit, event-driven pattern already
 *    used for pausing recorded audio, not an incidental side effect of
 *    React's render tree shape.
 *
 * Deliberately simpler than audioPlayback.js in one respect: there is only ever
 * ONE session (SpeechSynthesis only ever speaks one utterance at a time —
 * no per-content sessions to juggle), and it fully STOPS (never pauses-and-
 * resumes-later) when the user leaves the content — unlike a recorded voice
 * note, which preserves position across content switches.
 *
 * Exclusivity with recorded audio (see audioPlayback.js): starting speech
 * pauses (never resets) any playing recorded voice note, and starting a
 * recorded voice note pauses (never resets) speech — see pauseActiveAudio()
 * below and the matching pauseSpeech() call inside audioPlayback.js's
 * play(). This is a deliberate two-way import between these two modules;
 * both references are only used inside function bodies (never evaluated at
 * module-load time), which is the standard, safe way to structure a mutual
 * dependency between two ES modules.
 *
 * React components consume this via useTextToSpeech(id, text) below
 * (useSyncExternalStore) — never window.speechSynthesis directly.
 */
import { useSyncExternalStore } from "react";
import { pauseActiveAudio } from "./audioPlayback.js";

// Strip URLs and collapse whitespace before handing text to the synthesizer
// — reading a raw URL aloud is bad UX, and SpeechSynthesis has no concept of
// markup/links to skip on its own. Deliberately a small local helper, not a
// shared import from linkPreview.jsx: that module's URL handling exists to
// fetch OG previews and cache them — a different concern from stripping
// URLs out of text that's about to be *spoken*.
const URL_RE = /https?:\/\/[^\s]+/g;
export function toSpeechText(text) {
  return (text || "").replace(URL_RE, "").replace(/\s+/g, " ").trim();
}

// Rough estimate only — SpeechSynthesis exposes no reliable duration API.
// ~155 words/minute is a reasonable average speaking pace. Good enough for
// the compact "0:18 / 0:42" readout.
function estimateTotalSeconds(text) {
  const words = (text.trim().match(/\S+/g) || []).length;
  return Math.max(1, Math.round((words / 155) * 60));
}

// ── The single shared source of truth ───────────────────────────────────
let activeContentId = null;
let speechState = "idle"; // "idle" | "playing" | "paused"
let elapsed = 0;
let total = 0;
let timer = null;
let generation = 0; // bumped on every speak()/stop() — see file header

const listeners = new Set();
const EMPTY = { activeContentId: null, speechState: "idle", elapsed: 0, total: 0 };
let snapshot = EMPTY;

function notify() { listeners.forEach(fn => fn()); }
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function refresh() {
  snapshot = { activeContentId, speechState, elapsed, total };
  notify();
}

function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }
function startTimer() {
  clearTimer();
  timer = setInterval(() => {
    if (speechState !== "playing") return;
    elapsed = Math.min(total, elapsed + 1);
    refresh();
  }, 1000);
}

function resetState() {
  clearTimer();
  activeContentId = null;
  speechState = "idle";
  elapsed = 0;
  total = 0;
  refresh();
}

/** Stop reading entirely — the user's own "Detener" AND every real
 *  navigation/content-change event (leaving a Thread/Subtema, entering a
 *  Subtema, the fullscreen viewer's content actually changing, closing the
 *  viewer, the Android back button) route through this. Deliberately NOT
 *  called just because a component showing the button happens to unmount
 *  (see file header — that was the fullscreen-hide bug). Always safe to
 *  call even if nothing is speaking. */
export function stopSpeech() {
  generation++; // invalidate any in-flight utterance callbacks first
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  resetState();
}

export function pauseSpeech() {
  if (speechState !== "playing") return;
  window.speechSynthesis.pause();
  speechState = "paused";
  clearTimer();
  refresh();
}

export function resumeSpeech() {
  if (speechState !== "paused") return;
  window.speechSynthesis.resume();
  speechState = "playing";
  startTimer();
  refresh();
}

/** Start reading `text` aloud for content `id` — replaces whatever was
 *  being read before, for any id (SpeechSynthesis only ever speaks one
 *  thing). Also pauses (never resets) a playing recorded voice note — see
 *  file header on exclusivity. */
export function speak(id, text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const clean = toSpeechText(text);
  if (!clean) return;

  pauseActiveAudio(); // exclusivity rule — recorded audio only pauses

  generation++;
  const myGen = generation;
  window.speechSynthesis.cancel();

  activeContentId = id;
  elapsed = 0;
  total = estimateTotalSeconds(clean);
  speechState = "playing";

  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "es-ES";
  utter.onend = () => {
    if (myGen !== generation) return; // stale — a newer speak()/stop() already happened
    resetState();
  };
  utter.onerror = () => {
    if (myGen !== generation) return;
    resetState();
  };
  window.speechSynthesis.speak(utter);
  startTimer();
  refresh();
}

export function toggleSpeech(id, text) {
  if (activeContentId === id) {
    speechState === "paused" ? resumeSpeech() : pauseSpeech();
  } else {
    speak(id, text);
  }
}

// The Android/browser back button — same class of fix already applied to
// recorded audio in audioPlayback.js. One listener, registered once at
// module load, covers every current and future screen.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", stopSpeech);
}

/**
 * useTextToSpeech(id, text)
 *
 * `id` should be the content's own id (post/update/subtema id) — the same
 * value used elsewhere in the app to key a specific piece of content.
 * Every instance compares its own `id` against the single shared
 * activeContentId — that comparison, not any local state, is what the UI
 * reflects.
 */
export function useTextToSpeech(id, text) {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const isThis = snap.activeContentId === id;

  return {
    speaking: isThis && snap.speechState === "playing",
    paused: isThis && snap.speechState === "paused",
    active: isThis, // this content is the one currently loaded (playing or paused)
    elapsed: isThis ? snap.elapsed : 0,
    total: isThis ? snap.total : 0,
    toggle: () => toggleSpeech(id, text),
    stop: () => { if (isThis) stopSpeech(); },
  };
}
