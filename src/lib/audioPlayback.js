/**
 * audioPlayback.js
 *
 * Single source of truth for voice-note playback across the whole app —
 * feed cards (Posts/Updates/Subtemas via VoiceAndMedia in Post.jsx) AND the
 * fullscreen image viewer all read/control the SAME underlying <audio>
 * element through this module, so there is exactly one voice note actually
 * playing at any time no matter how many <AudioNotePlayer> instances are
 * mounted.
 *
 * Model: one real HTMLAudioElement (`audioEl`, created lazily, lives for the
 * whole app session — NOT tied to any React component's lifecycle) plus a
 * `sessions` map keyed by audio URL holding { currentTime, duration, playing,
 * speed, lastActiveAt } for every voice note touched so far. Only one URL is
 * ever "active" (actually loaded into audioEl) at a time.
 *
 * Switching which URL is active (attach(url)) pauses and snapshots whatever
 * was active before, then loads the new URL starting from ITS OWN saved
 * position — this is what makes "switch from Post A to Post B" pause A
 * (keeping its progress) instead of stopping/resetting it. A session is only
 * ever hard-reset to 0:00 by resetSession(url) (called when the fullscreen
 * viewer closes) or lazily, the next time it's attached, if it's been idle
 * longer than IDLE_RESET_MS.
 *
 * React components consume this via the useAudioPlayback(url) hook below
 * (useSyncExternalStore), never by touching audioEl directly.
 */
import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { pauseSpeech } from "./textToSpeech.js";

const IDLE_RESET_MS = 5 * 60 * 1000; // 5 minutes — matches the product spec

let audioEl = null;
let activeUrl = null;
const sessions = new Map(); // url -> { currentTime, duration, playing, speed, lastActiveAt, snapshot }
const listeners = new Set();

const EMPTY_SNAPSHOT = { currentTime: 0, duration: 0, playing: false, speed: 1 };

function notify() { listeners.forEach(fn => fn()); }

function refreshSnapshot(session) {
  session.snapshot = {
    currentTime: session.currentTime,
    duration: session.duration,
    playing: session.playing,
    speed: session.speed,
  };
}

function getOrCreateSession(url, knownDuration = 0) {
  let s = sessions.get(url);
  if (!s) {
    s = { currentTime: 0, duration: knownDuration || 0, playing: false, speed: 1, lastActiveAt: Date.now(), snapshot: null };
    refreshSnapshot(s);
    sessions.set(url, s);
  }
  return s;
}

function ensureAudioEl() {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.preload = "metadata";

  audioEl.addEventListener("timeupdate", () => {
    const s = sessions.get(activeUrl);
    if (!s) return;
    s.currentTime = audioEl.currentTime;
    s.lastActiveAt = Date.now();
    refreshSnapshot(s);
    notify();
  });
  audioEl.addEventListener("loadedmetadata", () => {
    const s = sessions.get(activeUrl);
    if (!s) return;
    if (isFinite(audioEl.duration)) s.duration = audioEl.duration;
    refreshSnapshot(s);
    notify();
  });
  audioEl.addEventListener("play", () => {
    const s = sessions.get(activeUrl);
    if (!s) return;
    s.playing = true; s.lastActiveAt = Date.now();
    refreshSnapshot(s); notify();
  });
  audioEl.addEventListener("pause", () => {
    const s = sessions.get(activeUrl);
    if (!s) return;
    s.playing = false; s.lastActiveAt = Date.now();
    refreshSnapshot(s); notify();
  });
  audioEl.addEventListener("ended", () => {
    const s = sessions.get(activeUrl);
    if (!s) return;
    s.playing = false; s.currentTime = 0; audioEl.currentTime = 0; s.lastActiveAt = Date.now();
    refreshSnapshot(s); notify();
  });
  audioEl.addEventListener("ratechange", () => {
    const s = sessions.get(activeUrl);
    if (!s) return;
    s.speed = audioEl.playbackRate;
    refreshSnapshot(s); notify();
  });

  return audioEl;
}

/** Make `url` the active (actually loaded) session — pausing & snapshotting
 *  whichever was active before. No-op (doesn't touch playback) if `url` is
 *  already active. Resets to 0:00 if this session has been idle > 5min. */
function attach(url, knownDuration = 0) {
  if (!url) return null;
  const el = ensureAudioEl();

  if (activeUrl === url) return sessions.get(url) || getOrCreateSession(url, knownDuration);

  if (activeUrl) {
    const old = sessions.get(activeUrl);
    if (old) {
      old.currentTime = el.currentTime;
      old.playing = false;
      old.lastActiveAt = Date.now();
      refreshSnapshot(old);
    }
    el.pause();
  }

  const session = getOrCreateSession(url, knownDuration);
  if (Date.now() - session.lastActiveAt > IDLE_RESET_MS) {
    session.currentTime = 0;
    session.playing = false;
  }

  activeUrl = url;
  el.src = url;
  el.currentTime = session.currentTime;
  el.playbackRate = session.speed;
  refreshSnapshot(session);
  notify();
  return session;
}

function play(url, knownDuration = 0) {
  pauseSpeech(); // exclusivity rule — text-to-speech only pauses, never resets
  attach(url, knownDuration);
  ensureAudioEl().play().catch(() => {}); // autoplay-policy edge case — button stays usable
}

function pause(url) {
  if (activeUrl === url && audioEl) audioEl.pause();
}

/** Pause whatever is currently active, if anything — position is preserved
 *  (same pause path as pause(url) above), nothing is reset. Used for
 *  navigation-driven pauses (leaving a Thread/Subtema, the Android back
 *  button, opening an overlay that backgrounds the current content) where
 *  the caller doesn't necessarily know — or care — which URL was playing. */
export function pauseActiveAudio() {
  if (activeUrl && audioEl && !audioEl.paused) audioEl.pause();
}

// The Android/browser back button fires a native `popstate` event — this is
// the ONE place in the whole app that reacts to it for audio purposes,
// rather than every screen that can be reached via back needing its own
// listener. Registered once at module load (this module is a singleton, same
// as audioEl itself), so it covers every current and future screen for free.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", pauseActiveAudio);
}

function toggle(url, knownDuration = 0) {
  if (activeUrl === url && audioEl && !audioEl.paused) pause(url);
  else play(url, knownDuration);
}

/** Seek — updates the stored position even if this session isn't the
 *  active one (it'll resume from there next time it's attached). */
function seek(url, time) {
  const s = getOrCreateSession(url);
  s.currentTime = time;
  s.lastActiveAt = Date.now();
  if (url === activeUrl && audioEl) audioEl.currentTime = time;
  refreshSnapshot(s);
  notify();
}

/** Playback speed — same "works even when inactive" behavior as seek(). */
function setSpeed(url, rate) {
  const s = getOrCreateSession(url);
  s.speed = rate;
  s.lastActiveAt = Date.now();
  if (url === activeUrl && audioEl) audioEl.playbackRate = rate;
  refreshSnapshot(s);
  notify();
}

/** Hard reset to 0:00, paused. Called when the fullscreen viewer closes —
 *  the one deliberate case where a voice note should NOT resume where it
 *  left off. */
export function resetAudioSession(url) {
  if (!url) return;
  const s = sessions.get(url);
  if (!s) return;
  s.currentTime = 0;
  s.playing = false;
  s.lastActiveAt = Date.now();
  if (url === activeUrl && audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
  refreshSnapshot(s);
  notify();
}

function getSnapshot(url) {
  if (!url) return EMPTY_SNAPSHOT;
  const s = sessions.get(url);
  return s ? s.snapshot : EMPTY_SNAPSHOT;
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * useAudioPlayback(url, { knownDuration })
 *
 * Read-only until the returned play()/toggle()/seek()/setSpeed() are
 * called — mounting a player never auto-attaches or auto-plays, so simply
 * rendering a compact player next to a dozen feed posts doesn't steal
 * playback from whichever note the user actually has going.
 */
export function useAudioPlayback(url, { knownDuration = 0 } = {}) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getSnapshot(url),
    () => EMPTY_SNAPSHOT
  );

  // Seed a passive (not-yet-active) session so duration shows immediately
  // even before the user presses play, using the already-known duration
  // captured at recording time (see audioRecorder.js) rather than waiting
  // on <audio>'s own loadedmetadata.
  useEffect(() => {
    if (url && !sessions.has(url)) getOrCreateSession(url, knownDuration);
  }, [url, knownDuration]);

  return {
    ...snapshot,
    isActive: url === activeUrl,
    play: () => play(url, knownDuration),
    pause: () => pause(url),
    toggle: () => toggle(url, knownDuration),
    seek: (t) => seek(url, t),
    setSpeed: (r) => setSpeed(url, r),
  };
}
