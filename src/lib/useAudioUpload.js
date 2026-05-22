/**
 * useAudioUpload.js
 * A hook that wraps the MediaRecorder API and uploads the resulting blob
 * to Supabase Storage, returning a permanent URL instead of a blob: URL.
 *
 * Usage:
 *   const { start, stop, cancel, isRecording, seconds, error } = useAudioUpload({ onDone, onCancel });
 *
 *   onDone({ url, duration, waveform, blob }) — called with persistent URL after upload
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { uploadFile, storagePath } from "./supabase.js";

export function useAudioUpload({ onDone, onCancel, folder = "recordings" } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const streamRef   = useRef(null);

  // Auto-start on mount (matches existing AudioRecorder behaviour)
  useEffect(() => {
    startRecording();
    return () => {
      clearInterval(timerRef.current);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function startRecording() {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        const mr = new MediaRecorder(stream);
        mediaRecRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => handleStop(mr._duration ?? seconds);
        mr.start();
        setIsRecording(true);
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      })
      .catch(() => setError("Microphone access denied"));
  }

  // We need to capture the final seconds value at stop time
  const secondsRef = useRef(0);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    const mr = mediaRecRef.current;
    if (mr && mr.state !== "inactive") {
      mr._duration = secondsRef.current;
      mr.stop();
    }
    stopStream();
    setIsRecording(false);
  }, []);

  const cancel = useCallback(() => {
    clearInterval(timerRef.current);
    const mr = mediaRecRef.current;
    if (mr) {
      mr.ondataavailable = null;
      mr.onstop = null;
      try { if (mr.state !== "inactive") mr.stop(); } catch {}
    }
    stopStream();
    setIsRecording(false);
    setSeconds(0);
    onCancel?.();
  }, [onCancel]);

  async function handleStop(duration) {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const waveform = Array.from({ length: 20 }, () => Math.random() * 0.7 + 0.2);

    // Optimistic: pass a blob URL immediately so the UI can preview
    const blobUrl = URL.createObjectURL(blob);

    // Upload to Supabase Storage in background
    setUploading(true);
    try {
      const path = storagePath(folder, "recording.webm");
      const persistentUrl = await uploadFile("audio", blob, path);

      if (persistentUrl) {
        // Revoke blob URL now we have a real one
        URL.revokeObjectURL(blobUrl);
        onDone?.({ url: persistentUrl, duration, waveform, blob: null });
      } else {
        // Upload failed — fall back to blob URL (won't survive refresh)
        console.warn("[useAudioUpload] Upload failed; using local blob URL (not persistent).");
        onDone?.({ url: blobUrl, duration, waveform, blob });
      }
    } catch (err) {
      console.error("[useAudioUpload] Upload error:", err);
      onDone?.({ url: blobUrl, duration, waveform, blob });
    } finally {
      setUploading(false);
    }
  }

  return { start: startRecording, stop, cancel, isRecording, seconds, uploading, error };
}
