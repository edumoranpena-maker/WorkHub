/**
 * useAudioUpload.js
 *
 * Thin wrapper around the shared recording core in audioRecorder.js that
 * additionally uploads to Supabase Storage the moment recording stops,
 * returning a permanent URL instead of a blob: URL. Recording mechanics
 * (MediaRecorder, duration tracking, waveform) live in audioRecorder.js —
 * this file only adds the "upload immediately" behavior on top, for any
 * context that explicitly wants that instead of uploading on submit (the
 * composers — Posts/Updates/Subtemas — do NOT use this; they use
 * useAudioRecorder directly and upload the blob on Publish, so a cancelled
 * composer never leaves an orphaned file in Storage).
 *
 * Usage:
 *   const { start, stop, cancel, isRecording, seconds, error } = useAudioUpload({ onDone, onCancel });
 *
 *   onDone({ url, duration, waveform, blob }) — called with persistent URL after upload
 */

import { useState, useCallback } from "react";
import { uploadFile, storagePath } from "./supabase.js";
import { useAudioRecorder } from "./audioRecorder.js";

export function useAudioUpload({ onDone, onCancel, folder = "recordings" } = {}) {
  const [uploading, setUploading] = useState(false);

  const handleRecordingDone = useCallback(async ({ blob, duration, waveform, url: blobUrl }) => {
    setUploading(true);
    try {
      const path = storagePath(folder, "recording.webm");
      const persistentUrl = await uploadFile("audio", blob, path);

      if (persistentUrl) {
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
  }, [onDone, folder]);

  const { start, stop, cancel, isRecording, seconds, error } = useAudioRecorder({
    onDone: handleRecordingDone,
    onCancel,
  });

  return { start, stop, cancel, isRecording, seconds, uploading, error };
}
