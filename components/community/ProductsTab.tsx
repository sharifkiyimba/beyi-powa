"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { openConversation } from "@/lib/chat";
import { mediaUrl, wholesalePriceOf } from "@/lib/listings";
import { CONDITION_LABEL, formatDate, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import type { CommunityPostRow } from "@/lib/types";
import { Photo } from "../Photo";
import { VerifiedTick } from "../VerifiedBadge";
import { ErrorBox, NoticeBox, PageLoading, primaryButton } from "../ui";
import { PostForm } from "./PostForm";

const POST_SELECT = `
  id, community_id, author_id, listing_id, caption, media_path, media_kind, created_at,
  author:profiles!author_id (id, full_name, shop_name, location, verified, paid_until, suspended),
  listing:listings (id, title, retail_price, condition, status, wholesale:listing_wholesale (wholesale_price))
`;

/** The "cart" of the community: every photo and video, each one leading to its seller. */
export function ProductsTab({
  communityId,
  userId,
  communityOwnerId,
}: {
  communityId: string;
  userId: string;
  communityOwnerId: string;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await getSupabase()
      .from("community_posts")
      .select(POST_SELECT)
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (loadError) setError("Could not load posts. Check your connection and try again.");
    else setPosts((data ?? []) as unknown as CommunityPostRow[]);
    setLoaded(true);
  }, [communityId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // New posts from other members appear without refreshing.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`community-posts:${communityId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts", filter: `community_id=eq.${communityId}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId, load]);

  const messageSeller = async (post: CommunityPostRow) => {
    setStartingId(post.id);
    setError("");
    try {
      const conversationId = await openConversation(userId, post.author_id, post.listing_id);
      router.push(`/inbox?c=${conversationId}`);
    } catch {
      setError("Could not open the chat. Please try again.");
      setStartingId(null);
    }
  };

  const removePost = async (post: CommunityPostRow) => {
    if (!window.confirm("Delete this post?")) return;
    const supabase = getSupabase();
    // Best effort: only the author can remove the file itself.
    await supabase.storage.from("listing-media").remove([post.media_path]);
    const { error: deleteError } = await supabase.from("community_posts").delete().eq("id", post.id);
    if (deleteError) setError("Could not delete that post.");
    await load();
  };

  return (
    <div className="space-y-6">
      <PostForm userId={userId} communityId={communityId} onPosted={load} />
      <ErrorBox message={error} />

      {!loaded ? (
        <PageLoading text="Loading posts..." />
      ) : posts.length === 0 ? (
        <NoticeBox>Nothing here yet. Share the first photo or video of the stock you have.</NoticeBox>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {posts.map((post) => {
            const mine = post.author_id === userId;
            const url = mediaUrl(post.media_path);
            const wholesale = post.listing ? wholesalePriceOf(post.listing) : null;
            const sold = post.listing?.status === "sold";

            return (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="bg-zinc-100">
                  {post.media_kind === "video" ? (
                    <video
                      src={`${url}#t=0.1`}
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-square w-full bg-black object-contain"
                    />
                  ) : (
                    <Photo src={url} alt={post.caption ?? "Community photo"} className="aspect-square w-full object-contain" />
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Link href={`/seller/${post.author_id}`} className="font-semibold text-zinc-800 hover:text-blue-600 hover:underline">
                        {sellerName(post.author)}
                      </Link>
                      {isActiveSeller(post.author) && <VerifiedTick />}
                    </span>
                    <span>{formatDate(post.created_at)}</span>
                  </div>

                  {post.caption && <p className="whitespace-pre-line text-sm text-zinc-700">{post.caption}</p>}

                  {post.listing && (
                    <Link
                      href={`/listing/${post.listing.id}`}
                      className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 hover:border-blue-300"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{post.listing.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{CONDITION_LABEL[post.listing.condition]}</p>
                      <p className="mt-1 text-sm font-bold text-blue-600">{formatUGX(post.listing.retail_price)}</p>
                      {wholesale !== null && (
                        <p className="text-xs font-semibold text-green-700">Wholesale: {formatUGX(wholesale)}</p>
                      )}
                    </Link>
                  )}

                  <div className="flex items-center gap-2">
                    {sold ? (
                      <span className="text-sm font-semibold text-zinc-500">Sold</span>
                    ) : !mine ? (
                      <button
                        onClick={() => messageSeller(post)}
                        disabled={startingId === post.id}
                        className={`flex-1 ${primaryButton}`}
                      >
                        {startingId === post.id ? "Opening chat..." : "Message seller"}
                      </button>
                    ) : null}
                    {(mine || communityOwnerId === userId) && (
                      <button onClick={() => removePost(post)} className="ml-auto text-xs font-semibold text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
