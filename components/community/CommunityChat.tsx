"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { uploadCommunityPost } from "@/lib/community";
import { MAX_VIDEO_MB, MAX_VIDEO_SECONDS } from "@/lib/config";
import { dayLabel, formatTime, formatUGX } from "@/lib/format";
import type { CommunityPostRow } from "@/lib/types";
import { PostBubble } from "./PostBubble";
import type { FeedMessage, useCommunityFeed } from "./useCommunityFeed";

type Feed = ReturnType<typeof useCommunityFeed>;
type MyPhone = { id: string; title: string; retail_price: number };

type Upload = {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  caption: string;
  listingId: string | null;
  status: "uploading" | "failed";
  error?: string;
};

type Item =
  | { kind: "message"; key: string; at: number; day: string; message: FeedMessage }
  | { kind: "post"; key: string; at: number; day: string; post: CommunityPostRow }
  | { kind: "upload"; key: string; at: number; day: string; upload: Upload };

const FAR_FUTURE = 8.64e15;

/** The community stream: messages, photos and videos together, with a WhatsApp-style bottom bar. */
export function CommunityChat({
  communityId,
  userId,
  communityOwnerId,
  feed,
  nameOf,
  startingId,
  onMessageSeller,
}: {
  communityId: string;
  userId: string;
  communityOwnerId: string;
  feed: Feed;
  nameOf: (userId: string) => string;
  startingId: string | null;
  onMessageSeller: (post: CommunityPostRow) => void;
}) {
  const { posts, messages, loaded, sendText, reloadPosts, removePost } = feed;

  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [listingId, setListingId] = useState("");
  const [phones, setPhones] = useState<MyPhone[]>([]);
  const [phonesLoaded, setPhonesLoaded] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [attachError, setAttachError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const attachmentUrl = useMemo(() => (attachment ? URL.createObjectURL(attachment) : null), [attachment]);
  useEffect(
    () => () => {
      if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
    },
    [attachmentUrl]
  );

  // Revoke any leftover preview links when leaving the screen.
  const uploadsRef = useRef<Upload[]>([]);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);
  useEffect(() => () => uploadsRef.current.forEach((u) => URL.revokeObjectURL(u.previewUrl)), []);

  // Load my phones the first time a file is attached, so a post can point at one.
  useEffect(() => {
    if (!attachment || phonesLoaded) return;
    let cancelled = false;
    getSupabase()
      .from("listings")
      .select("id, title, retail_price")
      .eq("seller_id", userId)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setPhones((data ?? []) as MyPhone[]);
        setPhonesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment, phonesLoaded, userId]);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...messages.map((m): Item => ({ kind: "message", key: m.client_id, at: new Date(m.created_at).getTime(), day: new Date(m.created_at).toDateString(), message: m })),
      ...posts.map((p): Item => ({ kind: "post", key: p.id, at: new Date(p.created_at).getTime(), day: new Date(p.created_at).toDateString(), post: p })),
      ...uploads.map((u): Item => ({ kind: "upload", key: u.id, at: FAR_FUTURE, day: "now", upload: u })),
    ];
    return all.sort((a, b) => a.at - b.at);
  }, [messages, posts, uploads]);

  // Stay at the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length, loaded]);

  const runUpload = async (upload: Upload) => {
    setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "uploading", error: undefined } : u)));
    try {
      await uploadCommunityPost({
        userId,
        communityId,
        file: upload.file,
        caption: upload.caption,
        listingId: upload.listingId,
      });
      await reloadPosts();
      URL.revokeObjectURL(upload.previewUrl);
      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not post. Please try again.";
      setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "failed", error: message } : u)));
    }
  };

  const dismissUpload = (upload: Upload) => {
    URL.revokeObjectURL(upload.previewUrl);
    setUploads((prev) => prev.filter((u) => u.id !== upload.id));
  };

  const clearAttachment = () => {
    setAttachment(null);
    setListingId("");
    setAttachError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();

    if (attachment) {
      const upload: Upload = {
        id: crypto.randomUUID(),
        file: attachment,
        previewUrl: URL.createObjectURL(attachment),
        isVideo: attachment.type.startsWith("video/"),
        caption: body,
        listingId: listingId || null,
        status: "uploading",
      };
      setUploads((prev) => [...prev, upload]);
      setText("");
      clearAttachment();
      void runUpload(upload);
      return;
    }

    if (!body) return;
    setText("");
    void sendText(body);
  };

  const confirmDelete = (post: CommunityPostRow) => {
    if (window.confirm("Delete this post?")) void removePost(post);
  };

  const isVideo = attachment?.type.startsWith("video/") ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The stream */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-zinc-100 px-3 py-4">
        {feed.error && <p className="rounded-lg bg-red-50 p-2 text-center text-xs font-medium text-red-700">{feed.error}</p>}

        {loaded && items.length === 0 && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-zinc-400">
            Nothing here yet. Say hello, or tap 📎 to share a photo or video of your stock.
          </p>
        )}

        {items.map((item, i) => {
          const showDay = item.kind !== "upload" && (i === 0 || items[i - 1].day !== item.day);
          const dayIso =
            item.kind === "message" ? item.message.created_at : item.kind === "post" ? item.post.created_at : "";

          return (
            <div key={item.key} className="space-y-2">
              {showDay && dayIso && (
                <div className="flex justify-center py-1">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-zinc-500 shadow-sm">{dayLabel(dayIso)}</span>
                </div>
              )}

              {item.kind === "message" && (
                <MessageBubble
                  message={item.message}
                  mine={item.message.sender_id === userId}
                  senderName={nameOf(item.message.sender_id)}
                  onRetry={() => void sendText(item.message.body, item.message.client_id)}
                />
              )}

              {item.kind === "post" && (
                <PostBubble
                  post={item.post}
                  mine={item.post.author_id === userId}
                  starting={startingId === item.post.id}
                  canDelete={item.post.author_id === userId || communityOwnerId === userId}
                  onMessageSeller={onMessageSeller}
                  onDelete={confirmDelete}
                />
              )}

              {item.kind === "upload" && (
                <UploadBubble upload={item.upload} onRetry={() => void runUpload(item.upload)} onDismiss={() => dismissUpload(item.upload)} />
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Bottom bar */}
      <div className="border-t border-zinc-200 bg-white p-2 sm:p-3">
        {attachment && attachmentUrl && (
          <div className="mb-2 flex gap-3 rounded-xl bg-zinc-50 p-2">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
              {isVideo ? (
                <video src={attachmentUrl} muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachmentUrl} alt="Chosen" className="h-full w-full object-cover" />
              )}
              {isVideo && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-xl text-white">▶</span>}
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="attach-phone" className="block text-xs font-medium text-zinc-700">
                Which phone is this? (optional)
              </label>
              <select
                id="attach-phone"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-1.5 text-sm text-zinc-900"
              >
                <option value="">Not one of my listings</option>
                {phones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({formatUGX(p.retail_price)})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">Type a caption below, then send.</p>
            </div>
            <button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="h-7 w-7 shrink-0 rounded-full bg-zinc-200 text-xs text-zinc-700">
              ✕
            </button>
          </div>
        )}
        {attachError && <p className="mb-2 text-xs font-medium text-red-600">{attachError}</p>}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl hover:bg-zinc-100" aria-label="Attach a photo or video" title={`Photos, or videos up to ${MAX_VIDEO_SECONDS} seconds and ${MAX_VIDEO_MB} MB`}>
            📎
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
                  setAttachError("Choose a photo or a video.");
                  return;
                }
                if (file.type.startsWith("video/") && file.size > MAX_VIDEO_MB * 1024 * 1024) {
                  setAttachError(`That video is too large. Keep it under ${MAX_VIDEO_MB} MB (about a minute).`);
                  return;
                }
                setAttachError("");
                setAttachment(file);
              }}
            />
          </label>
          <input
            type="text"
            maxLength={attachment ? 300 : 2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={attachment ? "Add a caption..." : "Message"}
            aria-label={attachment ? "Caption" : "Message"}
            className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button type="submit" aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  senderName,
  onRetry,
}: {
  message: FeedMessage;
  mine: boolean;
  senderName: string;
  onRetry: () => void;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          mine ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
        } ${message.pending ? "opacity-70" : ""}`}
      >
        {!mine && <p className="mb-0.5 text-xs font-semibold text-blue-700">{senderName}</p>}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <span className={`mt-1 block text-right text-[10px] ${mine ? "text-blue-200" : "text-zinc-400"}`}>
          {message.failed ? (
            <button onClick={onRetry} className="font-semibold underline">
              Not sent. Tap to retry
            </button>
          ) : message.pending ? (
            "Sending..."
          ) : (
            formatTime(message.created_at)
          )}
        </span>
      </div>
    </div>
  );
}

function UploadBubble({ upload, onRetry, onDismiss }: { upload: Upload; onRetry: () => void; onDismiss: () => void }) {
  return (
    <div className="flex justify-end">
      <div className="w-[82%] max-w-sm rounded-2xl rounded-br-sm bg-blue-600 p-1.5 text-white shadow-sm">
        <div className="relative overflow-hidden rounded-xl bg-black/20">
          {upload.isVideo ? (
            <video src={upload.previewUrl} muted playsInline className="max-h-64 w-full object-contain opacity-60" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={upload.previewUrl} alt="Uploading" className="max-h-64 w-full object-contain opacity-60" />
          )}
          {upload.status === "uploading" && (
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">Uploading...</span>
          )}
        </div>
        {upload.caption && <p className="px-2 pt-2 text-sm">{upload.caption}</p>}
        {upload.status === "failed" && (
          <div className="px-2 pb-1 pt-2 text-xs">
            <p className="font-semibold">{upload.error}</p>
            <div className="mt-1 flex gap-3">
              <button onClick={onRetry} className="font-semibold underline">
                Retry
              </button>
              <button onClick={onDismiss} className="font-semibold underline">
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
