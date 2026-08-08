/**
 * textToSpeech.js
 *
 * Reads a content's plain-text description aloud via the browser's built-in
 * SpeechSynthesis API — no external services, nothing new to build for
 * recording/upload. This is the "lector de texto" that was previously only
 * a visual placeholder (TtsControls in Post.jsx, next to ❤️/comments) with
 * no real engine wired in. That placeholder button is being removed —
 * everything here is the real implementation, in a new spot (see
 * ReadAloudButton.jsx).
 *
 * This is the TTS counterpart to audioPlayback.js (recorded voice notes),
 * but deliberately simpler, with one important behavioral difference: a
 * recorded voice note PAUSES and keeps its position when the user leaves the
 * content; text-to-speech always fully STOPS instead — per spec, it should
 * never keep reading something the user already navigated away from. There
 * is only ever one active session (SpeechSynthesis itself only ever speaks
 * one utterance at a time — no per-content sessions to juggle here, unlike
 * the recorded-audio store).
 *
 * React components consume this via useTextToSpeech(id, text) below
 * (useSyncExternalStore) — never window.speechSynthesis directly.
 */
import { useEffect } from "react";
import { useSyncExternalStore } from "react";

export const SPEECH_RATES = [0.5, 1, 1.25, 1.5, 2];

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
// ~155 words/minute at rate=1 is a reasonable average speaking pace; scales
// linearly with rate. Good enough for the compact "0:18 / 0:42" readout;
// corrected live as onboundary events come in wouldn't meaningfully improve
// accuracy given how coarse those boundaries are across browsers.
function estimateTotalSeconds(text, rate) {
  const words = (text.trim().match(/\S+/g) || []).length;
  const wpm = 155 * (rate || 1);
  return wpm > 0 ? Math.max(1, Math.round((words / wpm) * 60)) : 0;
}

let session = null; // { id, text, rate, speaking, paused, elapsed, total, spokenChars, timer, utterance }
const listeners = new Set();
const EMPTY = { id: null, speaking: false, paused: false, elapsed: 0, total: 0, rate: 1 };
let snapshot = EMPTY;

function notify() { listeners.forEach(fn => fn()); }
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }

function refresh() {
  snapshot = session
    ? { id: session.id, speaking: session.speaking, paused: session.paused, elapsed: session.elapsed, total: session.total, rate: session.rate }
    : EMPTY;
  notify();
}

function clearTimer() {
  if (session?.timer) { clearInterval(session.timer); session.timer = null; }
}
function startTimer() {
  clearTimer();
  session.timer = setInterval(() => {
    if (!session || session.paused) return;
    session.elapsed = Math.min(session.total, session.elapsed + 1);
    refresh();
  }, 1000);
}

function endSession() {
  clearTimer();
  session = null;
  refresh();
}

/** Stop reading entirely — the user's own "Detener" AND every navigation-
 *  driven lifecycle rule (leaving content, closing the viewer, the Android
 *  back button, switching to different content) route through this. Always
 *  safe to call even if nothing is speaking. */
export function stopSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  endSession();
}

function makeUtterance(text, rate, fromCharIndex) {
  const utter = new SpeechSynthesisUtterance(text.slice(fromCharIndex));
  utter.rate = rate;
  utter.lang = "es-ES";
  utter.onboundary = (e) => { if (session) session.spokenChars = fromCharIndex + (e.charIndex || 0); };
  utter.onend = () => {
    if (!session) return;
    session.speaking = false;
    session.paused = false;
    session.elapsed = session.total;
    clearTimer();
    refresh();
    // Brief delay so "finished" is visible for a moment instead of the
    // control instantly reverting to the plain button mid-frame.
    setTimeout(() => { if (session && !session.speaking) endSession(); }, 600);
  };
  utter.onerror = () => endSession();
  return utter;
}

function speakFrom(fromCharIndex) {
  const synth = window.speechSynthesis;
  synth.cancel(); // only one utterance system-wide — always start clean
  const utter = makeUtterance(session.text, session.rate, fromCharIndex);
  session.utterance = utter;
  session.speaking = true;
  session.paused = false;
  synth.speak(utter);
  startTimer();
  refresh();
}

/** Start reading `text` aloud for content `id` — replaces whatever was
 *  being read before (for any id); SpeechSynthesis only ever speaks one
 *  thing at a time. Keeps the previous rate if resuming the SAME id. */
export function speak(id, text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const clean = toSpeechText(text);
  if (!clean) return;
  const rate = session?.id === id ? session.rate : 1;
  session = { id, text: clean, rate, speaking: false, paused: false, elapsed: 0, total: estimateTotalSeconds(clean, rate), spokenChars: 0, timer: null, utterance: null };
  speakFrom(0);
}

export function pauseSpeech() {
  if (!session?.speaking || session.paused) return;
  window.speechSynthesis.pause();
  session.paused = true;
  clearTimer();
  refresh();
}

export function resumeSpeech() {
  if (!session || !session.paused) return;
  window.speechSynthesis.resume();
  session.paused = false;
  startTimer();
  refresh();
}

export function toggleSpeech(id, text) {
  if (session?.id === id && session.speaking) {
    session.paused ? resumeSpeech() : pauseSpeech();
  } else {
    speak(id, text);
  }
}

// SpeechSynthesisUtterance.rate can't change mid-utterance in any browser —
// changing speed restarts from wherever onboundary last reported, at the
// new rate, so it feels like a live speed change rather than starting over.
export function setSpeechRate(rate) {
  if (!session) return;
  session.rate = rate;
  session.total = estimateTotalSeconds(session.text, rate);
  if (session.speaking && !session.paused) speakFrom(session.spokenChars);
  else refresh();
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
 */
export function useTextToSpeech(id, text) {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const isThis = snap.id === id;

  // Base lifecycle rule: stop when the component whose text this is
  // unmounts (closing a Thread/Subtema, navigating away, the fullscreen
  // viewer closing). Screens that need to also stop WITHOUT unmounting
  // (e.g. the fullscreen viewer swiping to different content while staying
  // mounted) call stopSpeech() directly themselves — same pattern already
  // established for recorded audio.
  useEffect(() => {
    return () => { if (session?.id === id) stopSpeech(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stop = () => { if (isThis) stopSpeech(); };
  const setRate = (r) => { if (isThis) setSpeechRate(r); };

  return {
    speaking: isThis && snap.speaking,
    paused: isThis && snap.paused,
    active: isThis, // a session exists for this id, speaking or paused
    elapsed: isThis ? snap.elapsed : 0,
    total: isThis ? snap.total : 0,
    rate: isThis ? snap.rate : 1,
    toggle: () => toggleSpeech(id, text),
    stop,
    setRate,
  };
}
