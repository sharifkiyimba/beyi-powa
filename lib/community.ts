import { getSupabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { MAX_VIDEO_MB, MAX_VIDEO_SECONDS } from "@/lib/config";

const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

/** Reads a video's length in seconds. Resolves null if this browser cannot read the file. */
function videoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/**
 * Checks, shrinks (photos), uploads and records one photo or video for a community.
 * Throws an Error with a message that is fine to show to the seller.
 */
export async function uploadCommunityPost(args: {
  userId: string;
  communityId: string;
  file: File;
  caption: string;
  listingId: string | null;
}): Promise<void> {
  const { userId, communityId, file, caption, listingId } = args;
  const supabase = getSupabase();
  let uploadedPath: string | null = null;

  try {
    let body: Blob = file;
    let contentType = file.type;
    let ext = "jpg";
    let kind: "image" | "video" = "image";

    if (file.type.startsWith("video/")) {
      kind = "video";
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        throw new Error(`That video is too large. Keep it under ${MAX_VIDEO_MB} MB (about a minute).`);
      }
      const seconds = await videoSeconds(file);
      if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
        throw new Error(`That video is too long. Keep it under ${MAX_VIDEO_SECONDS} seconds.`);
      }
      ext = VIDEO_EXT[file.type] ?? "mp4";
    } else if (file.type.startsWith("image/")) {
      body = await compressImage(file);
      contentType = "image/jpeg";
    } else {
      throw new Error("Choose a photo or a video.");
    }

    const path = `${userId}/community/${communityId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("listing-media")
      .upload(path, body, { contentType, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    uploadedPath = path;

    const { error: insertError } = await supabase.from("community_posts").insert({
      community_id: communityId,
      author_id: userId,
      listing_id: listingId,
      caption: caption.trim() || null,
      media_path: path,
      media_kind: kind,
    });
    if (insertError) throw insertError;
  } catch (err) {
    if (uploadedPath) await supabase.storage.from("listing-media").remove([uploadedPath]);
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
    throw new Error(
      message?.toLowerCase().includes("row-level security")
        ? "Your blue tick is not active, so you cannot post right now."
        : (message ?? "Could not post. Please try again.")
    );
  }
}
