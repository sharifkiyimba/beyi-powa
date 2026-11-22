"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { LISTING_SELECT, mediaUrl, sortedMedia, wholesalePriceOf } from "@/lib/listings";
import { openConversation } from "@/lib/chat";
import { CONDITION_LABEL, formatDate, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import type { ListingWithRelations } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Photo } from "@/components/Photo";
import { VerifiedPill } from "@/components/VerifiedBadge";
import { ErrorBox, NoticeBox, PageLoading, primaryButton } from "@/components/ui";

export default function ListingDetailsPage() {
  // useParams() needs a Suspense boundary in this version of Next.js.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50">
          <Header />
          <PageLoading text="Loading details..." />
        </div>
      }
    >
      <ListingContent />
    </Suspense>
  );
}

function ListingContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [listing, setListing] = useState<ListingWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("listings")
      .select(LISTING_SELECT)
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setLoadFailed(true);
        setListing((data as unknown as ListingWithRelations | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleMessageSeller = async () => {
    if (!listing) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/listing/${listing.id}`)}`);
      return;
    }
    setStarting(true);
    setError("");
    try {
      const conversationId = await openConversation(user.id, listing.seller_id, listing.id);
      router.push(`/inbox?c=${conversationId}`);
    } catch {
      setError("Could not open the chat. Please try again.");
      setStarting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading text="Loading details..." />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{loadFailed ? "Could not load this phone" : "Phone not found"}</h1>
          <p className="mt-2 text-zinc-500">
            {loadFailed
              ? "Check your internet connection and try again."
              : "This listing may have been removed or is no longer available."}
          </p>
          <Link href="/" className={`mt-6 ${primaryButton}`}>
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const photos = sortedMedia(listing).filter((m) => m.kind === "image");
  const wholesale = wholesalePriceOf(listing);
  const verified = isActiveSeller(listing.seller);
  const isMine = user?.id === listing.seller_id;
  const sold = listing.status === "sold";

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />

      <main className="pb-12 mx-auto max-w-5xl px-4 pt-8">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          &larr; Back to search
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="aspect-square w-full bg-zinc-100">
                <Photo
                  src={photos[activePhoto] ? mediaUrl(photos[activePhoto].path) : null}
                  alt={listing.title}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            {photos.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {photos.map((p, i) => (
                  <button
                    key={p.path}
                    onClick={() => setActivePhoto(i)}
                    aria-label={`Photo ${i + 1}`}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                      i === activePhoto ? "border-blue-600" : "border-transparent"
                    }`}
                  >
                    <Photo src={mediaUrl(p.path)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                {CONDITION_LABEL[listing.condition]}
              </span>
              <span className="text-xs font-medium text-zinc-500">{listing.brand}</span>
              {sold && (
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Sold
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-zinc-900">{listing.title}</h1>
            <p className="mt-2 text-2xl font-bold text-blue-600">{formatUGX(listing.retail_price)}</p>
            <p className="mt-1 text-xs text-zinc-500">Fixed price. Pay at the shop or on delivery.</p>

            {wholesale !== null && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-800">Wholesale price: {formatUGX(wholesale)}</p>
                <p className="mt-1 text-xs text-green-600">Only visible to verified sellers.</p>
              </div>
            )}

            {listing.location && (
              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-600">
                <span className="font-medium text-zinc-900">Location:</span>
                <span>{listing.location}</span>
              </div>
            )}
            <div className="mt-1 text-xs text-zinc-400">Listed {formatDate(listing.created_at)}</div>

            <div className="mt-6 border-t border-zinc-200 pt-6">
              <h2 className="text-lg font-semibold text-zinc-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-600">
                {listing.description || "No description provided by the seller."}
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500">Sold by</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Link href={`/seller/${listing.seller_id}`} className="text-base font-bold text-zinc-900 hover:text-blue-600 hover:underline">
                      {sellerName(listing.seller)}
                    </Link>
                    {verified && <VerifiedPill />}
                  </div>
                  {listing.seller?.location && (
                    <p className="mt-1 text-xs text-zinc-500">Shop: {listing.seller.location}</p>
                  )}
                </div>
                <Link href={`/seller/${listing.seller_id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                  View profile
                </Link>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <ErrorBox message={error} />
              {isMine ? (
                <NoticeBox>This is your listing.</NoticeBox>
              ) : sold ? (
                <NoticeBox tone="amber">This phone has been sold.</NoticeBox>
              ) : (
                <button onClick={handleMessageSeller} disabled={starting} className={`w-full py-3 text-base ${primaryButton}`}>
                  {starting ? "Opening chat..." : user ? "Message seller" : "Log in to message seller"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <BottomNav active="shop" />
    </div>
  );
}
