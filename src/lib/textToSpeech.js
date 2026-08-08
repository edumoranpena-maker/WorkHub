/**
 * textToSpeech.js
 *
 * Reads a content's plain-text description aloud via the browser's built-in
 * SpeechSynthesis API — no external services. This is the TTS counterpart
 * to audioPlayback.js (recorded voice notes), and now mirrors its three-tier
 * lifecycle model exactly:
 *
 *   1. pauseSpeechForNavigation() — a TEMPORARY leave (swipe to different
 *      content, leaving a Thread/Subtema, the fullscreen viewer's content
 *      actually changing, the Android back button). Saves the current
 *      content's position (rolled back ~1s to compensate for
 *      SpeechSynthesis's imprecise boundary reporting, floored at 0) and
 *      cancels the live utterance — but the position is kept, in
 *      `savedSessions`, for up to a 5-minute grace period. Returning to the
 *      SAME content within that window shows Play/Resume at the saved
 *      position, never auto-playing. This is the direct equivalent of
 *      audioPlayback.js's pauseActiveAudio().
 *   2. stopSpeech() — a FINAL abandon: the user's own "Detener" button, or
 *      the fullscreen viewer closing outright. Discards everything, no
 *      saved position — equivalent to audioPlayback.js's resetAudioSession().
 *   3. Explicit pause/resume while STAYING on the same content (the
 *      Play/Pause button in the compact control) — true native
 *      speechSynthesis.pause()/resume(), unrelated to either of the above
 *      and unchanged from before.
 *
 * The single shared source of truth every UI instance compares its own
 * contentId against:
 *   activeContentId — which content is currently LIVE in the synthesizer
 *                      (actually speaking or natively paused), or null.
 *   speechState      — "idle" | "playing" | "paused"
 *   savedSessions     — Map<contentId, { text, elapsed, total, lastActiveAt }>
 *                        for content paused-by-navigation, not currently live.
 *
 * ── History — why earlier versions broke ─────────────────────────────────
 * 1. Race condition on content switch: starting a new utterance cancelled
 *    the old one, but the old utterance's onend/onerror fires
 *    asynchronously — sometimes AFTER the new session's state had already
 *    been written, stomping on it. Fixed with a `generation` counter: every
 *    speak()/stopSpeech()/pauseSpeechForNavigation() bumps it, and every
 *    utterance's callbacks capture the generation they belong to and bail
 *    out if a newer one has since started.
 * 2. Stopping was tied to component UNMOUNT — broke the moment that stopped
 *    meaning "the user left the content", exactly what happens in the
 *    fullscreen viewer when the chrome auto-hides the description (and the
 *    button inside it) with no actual content change. Fixed by making every
 *    stop/pause an explicit call from a real navigation event, never a side
 *    effect of React's render tree shape.
 *
 * Exclusivity with recorded audio (see audioPlayback.js): starting speech
 * pauses (never resets) any playing recorded voice note, and starting a
 * recorded voice note pauses (never resets) speech. Deliberate two-way
 * import between these two modules; both references are only used inside
 * function bodies (never evaluated at module-load time), the standard safe
 * way to structure a mutual dependency between two ES modules.
 *
 * React components consume this via useTextToSpeech(id, text) below
 * (useSyncExternalStore) — never window.speechSynthesis directly.
 */
import { useSyncExternalStore } from "react";
import { pauseActiveAudio } from "./audioPlayback.js";

const GRACE_MS = 5 * 60 * 1000; // matches audioPlayback.js's IDLE_RESET_MS
const REWIND_SECONDS = 1; // "retroceder ~1s" — compensates for boundary imprecision

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
// the compact "0:18 / 0:42" readout AND for estimating roughly where (as a
// character offset) to resume a saved session — see charOffsetFor below.
// SpeechSynthesis has no reliable seek API either, so an estimate — with the
// ~1s rewind as a safety margin — is the practical option, not a corner cut.
function estimateTotalSeconds(text) {
  const words = (text.trim().match(/\S+/g) || []).length;
  return Math.max(1, Math.round((words / 155) * 60));
}
function charOffsetFor(text, elapsedSec, totalSec) {
  if (totalSec <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedSec / totalSec));
  return Math.round(text.length * ratio);
}

// ── The single shared source of truth ───────────────────────────────────
let activeContentId = null;
let speechState = "idle"; // "idle" | "playing" | "paused"
let currentText = "";
let elapsed = 0;
let total = 0;
let timer = null;
let generation = 0; // bumped whenever the live utterance changes — see file header

// Paused-by-navigation content, NOT currently live — see pauseSpeechForNavigation.
const savedSessions = new Map(); // id -> { text, elapsed, total, lastActiveAt }

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
  currentText = "";
  elapsed = 0;
  total = 0;
  refresh();
}

function makeUtterance(text, fromCharIndex, myGen) {
  const utter = new SpeechSynthesisUtterance(text.slice(fromCharIndex));
  utter.lang = "es-ES";
  utter.onend = () => {
    if (myGen !== generation) return; // stale — a newer utterance already replaced this one
    resetState();
  };
  utter.onerror = () => {
    if (myGen !== generation) return;
    resetState();
  };
  return utter;
}

/** Stop reading entirely and discard any progress — the user's own
 *  "Detener", and the fullscreen viewer closing outright. NOT used for
 *  ordinary navigation-away (see pauseSpeechForNavigation for that) — this
 *  is the "final abandon" tier, equivalent to audioPlayback.js's
 *  resetAudioSession(). Always safe to call even if nothing is speaking. */
export function stopSpeech() {
  generation++; // invalidate any in-flight utterance callbacks first
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  resetState();
}

/** Discard a saved (paused-by-navigation, not live) session outright —
 *  the Stop button's behavior when pressed on content that's saved but not
 *  currently live. */
function discardSaved(id) {
  if (savedSessions.delete(id)) refresh();
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

/** TEMPORARY leave — swiping to different content, leaving a Thread/
 *  Subtema, the fullscreen viewer's content actually changing, the Android
 *  back button. Saves the current position (rolled back ~1s, floored at 0)
 *  so returning to this exact content within the 5-minute grace period
 *  resumes close to where it left off instead of restarting. Does nothing
 *  if nothing is currently active. This is the direct equivalent of
 *  audioPlayback.js's pauseActiveAudio() — same spot in the lifecycle, same
 *  "pause and remember, don't discard" intent. */
export function pauseSpeechForNavigation() {
  if (!activeContentId || speechState === "idle") return;
  const id = activeContentId;
  const rolledBack = Math.max(0, elapsed - REWIND_SECONDS);
  savedSessions.set(id, { text: currentText, elapsed: rolledBack, total, lastActiveAt: Date.now() });

  generation++;
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  resetState(); // resetState() calls refresh(), which also covers the savedSessions change above
}

/** Start reading `text` aloud for content `id` from the beginning —
 *  replaces whatever was being read before, for any id (SpeechSynthesis
 *  only ever speaks one thing). Also pauses (never resets) a playing
 *  recorded voice note — see file header on exclusivity. */
export function speak(id, text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const clean = toSpeechText(text);
  if (!clean) return;

  pauseActiveAudio(); // exclusivity rule — recorded audio only pauses
  savedSessions.delete(id); // starting fresh supersedes any saved position for this id

  generation++;
  const myGen = generation;
  window.speechSynthesis.cancel();

  activeContentId = id;
  currentText = clean;
  elapsed = 0;
  total = estimateTotalSeconds(clean);
  speechState = "playing";

  window.speechSynthesis.speak(makeUtterance(clean, 0, myGen));
  startTimer();
  refresh();
}

/** Resume a saved (paused-by-navigation) session from its stored position.
 *  If the 5-minute grace period has lapsed, starts fresh from 0 instead —
 *  "la próxima vez que pulse Leer debe comenzar desde 0". */
function resumeFromSaved(id, saved) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  savedSessions.delete(id);

  if (Date.now() - saved.lastActiveAt > GRACE_MS) {
    speak(id, saved.text);
    return;
  }

  pauseActiveAudio(); // exclusivity rule, same as speak()
  generation++;
  const myGen = generation;
  window.speechSynthesis.cancel();

  const offset = charOffsetFor(saved.text, saved.elapsed, saved.total);
  activeContentId = id;
  currentText = saved.text;
  elapsed = saved.elapsed;
  total = saved.total;
  speechState = "playing";

  window.speechSynthesis.speak(makeUtterance(saved.text, offset, myGen));
  startTimer();
  refresh();
}

/** Play/Pause toggle used by the compact control. Three cases: this content
 *  is already live (native pause/resume, unchanged) → a saved session
 *  exists for it (resume from saved position) → neither (fresh start). */
export function toggleSpeech(id, text) {
  if (activeContentId === id) {
    speechState === "paused" ? resumeSpeech() : pauseSpeech();
    return;
  }
  const saved = savedSessions.get(id);
  if (saved) resumeFromSaved(id, saved);
  else speak(id, text);
}

// The Android/browser back button — a temporary-leave event, same as
// swiping to different content, NOT a final abandon (matches
// audioPlayback.js's own popstate handling, which also only pauses).
if (typeof window !== "undefined") {
  window.addEventListener("popstate", pauseSpeechForNavigation);
}

/**
 * useTextToSpeech(id, text)
 *
 * `id` should be the content's own id (post/update/subtema id) — the same
 * value used elsewhere in the app to key a specific piece of content. Every
 * instance compares its own `id` against the single shared activeContentId
 * AND checks for a saved (paused-by-navigation) session for that id — never
 * any local "am I playing" state of its own.
 */
export function useTextToSpeech(id, text) {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const isLive = snap.activeContentId === id;
  const saved = !isLive ? savedSessions.get(id) : null;
  const active = isLive || !!saved;

  return {
    speaking: isLive && snap.speechState === "playing",
    // A saved-but-not-live session always displays as "paused" — that's the
    // whole point: returning to it shows Play/Resume, never auto-plays.
    paused: isLive ? snap.speechState === "paused" : !!saved,
    active,
    elapsed: isLive ? snap.elapsed : (saved ? saved.elapsed : 0),
    total: isLive ? snap.total : (saved ? saved.total : 0),
    toggle: () => toggleSpeech(id, text),
    stop: () => { if (isLive) stopSpeech(); else discardSaved(id); },
  };
}
