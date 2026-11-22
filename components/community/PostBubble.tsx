"use client";

import Link from "next/link";
import { mediaUrl, wholesalePriceOf } from "@/lib/listings";
import { CONDITION_LABEL, formatTime, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import type { CommunityPostRow } from "@/lib/types";
import { Photo } from "../Photo";
import { VerifiedTick } from "../VerifiedBadge";

/** A photo or video in the stream, with its caption, phone details and a button to reach the seller. */
export function PostBubble({
  post,
  mine,
  starting,
  canDelete,
  onMessageSeller,
  onDelete,
  full = false,
}: {
  post: CommunityPostRow;
  mine: boolean;
  starting: boolean;
  canDelete: boolean;
  onMessageSeller: (post: CommunityPostRow) => void;
  onDelete: (post: CommunityPostRow) => void;
  /** Fill the width (used in the gallery pop-up) instead of a chat-bubble width. */
  full?: boolean;
}) {
  const url = mediaUrl(post.media_path);
  const wholesale = post.listing ? wholesalePriceOf(post.listing) : null;
  const sold = post.listing?.status === "sold";

  return (
    <div className={`flex ${mine && !full ? "justify-end" : "justify-start"}`}>
      <div
        className={`${full ? "w-full" : "w-[82%] max-w-sm"} rounded-2xl p-1.5 shadow-sm ${
          mine && !full ? "rounded-br-sm bg-blue-600 text-white" : `${full ? "" : "rounded-bl-sm"} border border-zinc-200 bg-white text-zinc-900`
        }`}
      >
        {!mine && (
          <p className="flex items-center gap-1 px-2 pb-1 pt-1 text-xs font-semibold text-blue-700">
            <Link href={`/seller/${post.author_id}`} className="hover:underline">
              {sellerName(post.author)}
            </Link>
            {isActiveSeller(post.author) && <VerifiedTick />}
          </p>
        )}

        <div className="overflow-hidden rounded-xl bg-zinc-100">
          {post.media_kind === "video" ? (
            <video
              src={`${url}#t=0.1`}
              controls
              playsInline
              preload="metadata"
              className="max-h-80 w-full bg-black object-contain"
            />
          ) : (
            <Photo src={url} alt={post.caption ?? "Community photo"} className="max-h-80 w-full object-contain" />
          )}
        </div>

        {post.caption && <p className="whitespace-pre-line px-2 pt-2 text-sm">{post.caption}</p>}

        {post.listing && (
          <Link
            href={`/listing/${post.listing.id}`}
            className="mx-1 mt-2 block rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-900 hover:border-blue-300"
          >
            <p className="text-sm font-semibold">{post.listing.title}</p>
            <p className="text-xs text-zinc-500">{CONDITION_LABEL[post.listing.condition]}</p>
            <p className="mt-0.5 text-sm font-bold text-blue-600">{formatUGX(post.listing.retail_price)}</p>
            {wholesale !== null && <p className="text-xs font-semibold text-green-700">Wholesale: {formatUGX(wholesale)}</p>}
          </Link>
        )}

        {sold ? (
          <p className="px-2 pt-2 text-xs font-semibold opacity-80">Sold</p>
        ) : (
          !mine && (
            <button
              onClick={() => onMessageSeller(post)}
              disabled={starting}
              className="mx-1 mt-2 w-[calc(100%-0.5rem)] rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {starting ? "Opening chat..." : "Message seller"}
            </button>
          )
        )}

        <div className={`flex items-center justify-between gap-3 px-2 pb-1 pt-1.5 text-[10px] ${mine && !full ? "text-blue-200" : "text-zinc-400"}`}>
          {canDelete ? (
            <button onClick={() => onDelete(post)} className="font-semibold underline">
              Delete
            </button>
          ) : (
            <span />
          )}
          <span>{formatTime(post.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
