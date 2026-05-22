import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[Supabase] Missing environment variables.\n" +
    "Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Upload a file to a Supabase Storage bucket.
 * Returns the permanent public URL on success, or null on failure.
 *
 * @param {"images"|"videos"|"audio"} bucket  - target bucket name
 * @param {File|Blob} file                    - the file / blob to upload
 * @param {string}    path                    - storage path (e.g. "posts/uuid.webm")
 */
export async function uploadFile(bucket, file, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, cacheControl: "3600" });

  if (error) {
    console.error(`[Storage] Upload failed for ${bucket}/${path}:`, error.message);
    return null;
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData?.publicUrl ?? null;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error(`[Storage] Delete failed for ${bucket}/${path}:`, error.message);
}

/**
 * Generate a unique storage path for a given file.
 * Example: "posts/1716000000000-photo.jpg"
 */
export function storagePath(folder, originalName) {
  const ext = originalName ? originalName.split(".").pop() : "bin";
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
