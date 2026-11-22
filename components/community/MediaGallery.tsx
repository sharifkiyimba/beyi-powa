"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/listings";
import type { CommunityPostRow } from "@/lib/types";
import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { PostBubble } from "./PostBubble";

/** Every photo and video shared in the community. Tap one to see the phone and reach the seller. */
export function MediaGallery({
  posts,
  userId,
  communityOwnerId,
  startingId,
  onMessageSeller,
  onDelete,
}: {
  posts: CommunityPostRow[];
  userId: string;
  communityOwnerId: string;
  startingId: string | null;
  onMessageSeller: (post: CommunityPostRow) => void;
  onDelete: (post: CommunityPostRow) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = posts.find((p) => p.id === openId) ?? null;

  if (posts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-zinc-50 p-8 text-center text-sm text-zinc-400">
        No photos or videos yet. Share one from the chat with the attach button.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 p-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {posts.map((post) => {
          const url = mediaUrl(post.media_path);
          return (
            <button
              key={post.id}
              onClick={() => setOpenId(post.id)}
              className="relative aspect-square overflow-hidden rounded-lg bg-zinc-200"
              aria-label={post.caption ?? (post.media_kind === "video" ? "Video" : "Photo")}
            >
              {post.media_kind === "video" ? (
                <>
                  <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                    <Icon name="play" className="h-8 w-8" />
                  </span>
                </>
              ) : (
                <Photo src={url} alt="" className="h-full w-full object-cover" />
              )}
              {post.listing && (
                <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {post.listing.title.length > 14 ? post.listing.title.slice(0, 13) + "…" : post.listing.title}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenId(null)}
        >
          <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end pb-1">
              <button onClick={() => setOpenId(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <PostBubble
              post={open}
              mine={open.author_id === userId}
              starting={startingId === open.id}
              canDelete={open.author_id === userId || communityOwnerId === userId}
              onMessageSeller={onMessageSeller}
              onDelete={(p) => {
                setOpenId(null);
                onDelete(p);
              }}
              full
            />
          </div>
        </div>
      )}
    </div>
  );
}
