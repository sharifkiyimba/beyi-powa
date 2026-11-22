"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { uploadCommunityPost } from "@/lib/community";
import { MAX_VIDEO_MB, MAX_VIDEO_SECONDS } from "@/lib/config";
import { dayLabel, formatUGX } from "@/lib/format";
import type { CommunityPostRow } from "@/lib/types";
import { ChatBubble, CHAT_BACKGROUND, DayPill } from "../chat/ChatBubble";
import { Icon } from "../Icon";
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
      <div className={`flex-1 overflow-y-auto px-3 py-2 ${CHAT_BACKGROUND}`}>
        {feed.error && <p className="rounded-lg bg-red-50 p-2 text-center text-xs font-medium text-red-700">{feed.error}</p>}

        {loaded && items.length === 0 && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-zinc-400">
            Nothing here yet. Say hello, or use the attach button to share a photo or video of your stock.
          </p>
        )}

        {items.map((item, i) => {
          const showDay = item.kind !== "upload" && (i === 0 || items[i - 1].day !== item.day);
          const dayIso =
            item.kind === "message" ? item.message.created_at : item.kind === "post" ? item.post.created_at : "";

          return (
            <div key={item.key} className={item.kind === "message" ? "" : "mt-2"}>
              {showDay && dayIso && <DayPill label={dayLabel(dayIso)} />}

              {item.kind === "message" && (
                <ChatBubble
                  body={item.message.body}
                  at={item.message.created_at}
                  mine={item.message.sender_id === userId}
                  first={
                    showDay ||
                    i === 0 ||
                    items[i - 1].kind !== "message" ||
                    (items[i - 1] as Extract<Item, { kind: "message" }>).message.sender_id !== item.message.sender_id
                  }
                  pending={item.message.pending}
                  failed={item.message.failed}
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
      <div className="border-t border-zinc-200 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
        {attachment && attachmentUrl && (
          <div className="mb-2 flex gap-3 rounded-xl bg-zinc-50 p-2">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
              {isVideo ? (
                <video src={attachmentUrl} muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachmentUrl} alt="Chosen" className="h-full w-full object-cover" />
              )}
              {isVideo && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                  <Icon name="play" className="h-7 w-7" />
                </span>
              )}
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
            <button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}
        {attachError && <p className="mb-2 text-xs font-medium text-red-600">{attachError}</p>}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100" aria-label="Attach a photo or video" title={`Photos, or videos up to ${MAX_VIDEO_SECONDS} seconds and ${MAX_VIDEO_MB} MB`}>
            <Icon name="attach" className="h-6 w-6" />
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
            className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-600"
          />
          <button type="submit" aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">
            <Icon name="send" className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function UploadBubble({ upload, onRetry, onDismiss }: { upload: Upload; onRetry: () => void; onDismiss: () => void }) {
  return (
    <div className="flex justify-end">
      <div className="w-[82%] max-w-sm rounded-xl rounded-tr-none bg-[#d3e4fd] p-1.5 text-zinc-900 shadow-sm">
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
