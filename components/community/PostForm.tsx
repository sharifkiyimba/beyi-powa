"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { MAX_VIDEO_MB, MAX_VIDEO_SECONDS } from "@/lib/config";
import { formatUGX } from "@/lib/format";
import { ErrorBox, NoticeBox, inputClass, primaryButton, secondaryButton } from "../ui";

type MyPhone = { id: string; title: string; retail_price: number };

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

export function PostForm({
  userId,
  communityId,
  onPosted,
}: {
  userId: string;
  communityId: string;
  onPosted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [listingId, setListingId] = useState("");
  const [phones, setPhones] = useState<MyPhone[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // My available phones, so a post can point at one of them.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getSupabase()
      .from("listings")
      .select("id, title, retail_price")
      .eq("seller_id", userId)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setPhones((data ?? []) as MyPhone[]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const isVideo = file?.type.startsWith("video/") ?? false;

  const reset = () => {
    setFile(null);
    setCaption("");
    setListingId("");
    setError("");
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Choose a photo or video first.");
    setError("");
    setBusy(true);

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
        listing_id: listingId || null,
        caption: caption.trim() || null,
        media_path: path,
        media_kind: kind,
      });
      if (insertError) throw insertError;

      reset();
      await onPosted();
    } catch (err) {
      if (uploadedPath) await supabase.storage.from("listing-media").remove([uploadedPath]);
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
      setError(
        message?.toLowerCase().includes("row-level security")
          ? "Your blue tick is not active, so you cannot post right now."
          : (message ?? "Could not post. Please try again.")
      );
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`w-full ${primaryButton}`}>
        + Share a photo or video
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-zinc-900">Share with the community</h3>

      <div>
        {preview ? (
          <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            {isVideo ? (
              <video src={preview} controls playsInline className="max-h-72 w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Chosen" className="max-h-72 w-full object-contain" />
            )}
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center hover:border-blue-400">
            <span className="text-3xl">📸</span>
            <span className="mt-2 text-sm font-medium text-zinc-700">Choose a photo or video</span>
            <span className="mt-1 text-xs text-zinc-500">
              Videos: up to {MAX_VIDEO_SECONDS} seconds and {MAX_VIDEO_MB} MB
            </span>
            <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        )}
      </div>

      <textarea
        rows={2}
        maxLength={300}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Say something. For example: 5 pieces iPhone 12, 128GB, clean."
        aria-label="Caption"
        className={inputClass}
      />

      <div>
        <label htmlFor="post-phone" className="mb-1 block text-sm font-medium text-zinc-900">Which phone is this?</label>
        <select id="post-phone" value={listingId} onChange={(e) => setListingId(e.target.value)} className={inputClass}>
          <option value="">Not one of my listings</option>
          {phones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({formatUGX(p.retail_price)})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Linking a listing shows its price and sends buyers to that phone. Others can message you either way.
        </p>
      </div>

      <ErrorBox message={error} />
      {busy && <NoticeBox>{isVideo ? "Uploading video. This can take a minute on mobile data..." : "Uploading..."}</NoticeBox>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "Posting..." : "Post"}
        </button>
        <button type="button" onClick={reset} disabled={busy} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
