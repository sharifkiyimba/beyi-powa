"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { LISTING_SELECT, hasImei, mediaUrl, sortedMedia, wholesalePriceOf } from "@/lib/listings";
import { viewerKey } from "@/lib/viewer";
import { openConversation } from "@/lib/chat";
import { CONDITION_LABEL, formatDate, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import type { ListingWithRelations } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { BuyerChecklist } from "@/components/BuyerChecklist";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { Photo } from "@/components/Photo";
import { ReportListingSheet } from "@/components/ReportListingSheet";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const viewCounted = useRef(false);

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

  // Count this visit once (the seller sees the number on their Me tab).
  const foundId = listing?.id;
  useEffect(() => {
    if (!foundId || authLoading || viewCounted.current) return;
    viewCounted.current = true;
    // The request is only sent once something waits on it, hence the .then().
    getSupabase()
      .rpc("record_view", { p_listing: foundId, p_viewer: viewerKey(user?.id) })
      .then(
        () => undefined,
        () => undefined
      );
  }, [foundId, authLoading, user?.id]);

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

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const showPhoto = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActivePhoto(i);
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

  const canMessage = !isMine && !sold;
  const messageLabel = starting ? "Opening chat..." : user ? "Message seller" : "Log in to message seller";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Laptops keep the normal top bar; phones get a slim bar with a back arrow. */}
      <div className="hidden md:block">
        <Header />
      </div>
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-zinc-200 bg-white px-2 py-2 md:hidden">
        <button
          onClick={goBack}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
        >
          <Icon name="back" className="h-6 w-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-base font-semibold text-zinc-900">{listing.title}</p>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 md:px-4 md:pb-12 md:pt-6">
        <button onClick={goBack} className="mb-3 hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 md:inline-block">
          &larr; Back to search
        </button>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-8">
          {/* Photos: swipe on a phone, dots show where you are */}
          <div>
            <div className="relative overflow-hidden bg-white md:rounded-2xl md:border md:border-zinc-200">
              <div
                ref={trackRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setActivePhoto(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
                }}
                className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {photos.length === 0 ? (
                  <div className="aspect-square w-full shrink-0 bg-zinc-100">
                    <Photo src={null} alt={listing.title} className="h-full w-full" />
                  </div>
                ) : (
                  photos.map((p, i) => (
                    <div key={p.path} className="aspect-square w-full shrink-0 snap-center bg-zinc-100">
                      <Photo src={mediaUrl(p.path)} alt={`${listing.title}, photo ${i + 1}`} className="h-full w-full object-contain" />
                    </div>
                  ))
                )}
              </div>
              {photos.length > 1 && (
                <>
                  <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                    {activePhoto + 1} / {photos.length}
                  </span>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {photos.map((p, i) => (
                      <button
                        key={p.path}
                        onClick={() => showPhoto(i)}
                        aria-label={`Show photo ${i + 1}`}
                        className={`h-2 rounded-full transition-all ${i === activePhoto ? "w-5 bg-blue-600" : "w-2 bg-zinc-400/70"}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {sold && (
                <span className="absolute left-3 top-3 rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Sold
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 px-4 py-4 md:px-0 md:py-0">
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-3xl font-bold text-blue-600">{formatUGX(listing.retail_price)}</p>
                <span className="mt-1 shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  {CONDITION_LABEL[listing.condition]}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-semibold text-zinc-900">{listing.title}</h1>
              <p className="mt-1 text-xs text-zinc-500">Fixed price. Pay at the shop or on delivery.</p>
              {hasImei(listing) && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Icon name="check" className="h-3.5 w-3.5" />
                  IMEI on record with BEYI POWA
                </p>
              )}
            </div>

            {wholesale !== null && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-800">Wholesale price: {formatUGX(wholesale)}</p>
                <p className="mt-0.5 text-xs text-green-700">Only visible to verified sellers.</p>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-sm">
              {[
                ["Brand", listing.brand],
                ["Condition", CONDITION_LABEL[listing.condition]],
                ["Area", listing.location ?? "Not given"],
                ["Listed", formatDate(listing.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="bg-white px-3 py-2.5">
                  <dt className="text-xs text-zinc-500">{k}</dt>
                  <dd className="mt-0.5 font-medium text-zinc-900">{v}</dd>
                </div>
              ))}
            </dl>

            <Link
              href={`/seller/${listing.seller_id}`}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm hover:bg-zinc-50"
            >
              <Avatar name={sellerName(listing.seller)} seed={listing.seller_id} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">Sold by</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-bold text-zinc-900">{sellerName(listing.seller)}</span>
                  {verified && <VerifiedPill />}
                </div>
                {listing.seller?.location && <p className="text-xs text-zinc-500">Shop: {listing.seller.location}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold text-blue-600">View shop</span>
            </Link>

            <div>
              <h2 className="text-base font-semibold text-zinc-900">Description</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-600">
                {listing.description || "No description provided by the seller."}
              </p>
            </div>

            {!isMine && !sold && <BuyerChecklist />}

            <ErrorBox message={error} />
            {isMine && <NoticeBox>This is your listing.</NoticeBox>}
            {!isMine && sold && <NoticeBox tone="amber">This phone has been sold.</NoticeBox>}
            {canMessage && (
              <button onClick={handleMessageSeller} disabled={starting} className={`hidden w-full py-3 text-base md:block ${primaryButton}`}>
                {messageLabel}
              </button>
            )}

            {!isMine && (
              <button
                onClick={() => (user ? setReportOpen(true) : router.push(`/login?next=${encodeURIComponent(`/listing/${listing.id}`)}`))}
                className="flex items-center justify-center gap-1.5 self-center py-2 text-sm font-medium text-zinc-500 hover:text-red-600"
              >
                <Icon name="flag" className="h-4 w-4" />
                Report this phone
              </button>
            )}
          </div>
        </div>
      </main>

      {user && (
        <ReportListingSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          listing={{ id: listing.id, seller_id: listing.seller_id, title: listing.title }}
          userId={user.id}
        />
      )}

      {/* On a phone the main action stays at the bottom of the screen, in thumb reach. */}
      {canMessage && (
        <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-zinc-900">{formatUGX(listing.retail_price)}</p>
            <p className="text-[11px] text-zinc-500">Fixed price</p>
          </div>
          <button onClick={handleMessageSeller} disabled={starting} className={`flex-1 py-3 text-base ${primaryButton}`}>
            {messageLabel}
          </button>
        </div>
      )}
    </div>
  );
}
