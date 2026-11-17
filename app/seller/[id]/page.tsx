"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { LISTING_SELECT } from "@/lib/listings";
import { formatDate, isActiveSeller, sellerName } from "@/lib/format";
import type { ListingWithRelations, Profile, Review } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { VerifiedPill } from "@/components/VerifiedBadge";
import { ErrorBox, NoticeBox, PageLoading, inputClass, primaryButton, secondaryButton } from "@/components/ui";

type ReviewRow = Review & { buyer: { full_name: string } | null };
type PendingSale = { id: string; listing: { title: string } | null };

const REPORT_REASONS = [
  "Sold me a fake or counterfeit phone",
  "Took payment and did not deliver",
  "Listing was misleading (price, condition or photos)",
  "Rude or abusive behaviour",
  "Other",
];

export default function SellerProfilePage() {
  // useParams() needs a Suspense boundary in this version of Next.js.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50">
          <Header />
          <PageLoading text="Loading profile..." />
        </div>
      }
    >
      <SellerProfileContent />
    </Suspense>
  );
}

function SellerProfileContent() {
  const params = useParams<{ id: string }>();
  const sellerId = params.id;
  const { user, loading: authLoading } = useAuth();

  const [seller, setSeller] = useState<Profile | null>(null);
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [profileRes, listingsRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", sellerId).maybeSingle(),
      supabase.from("listings").select(LISTING_SELECT).eq("seller_id", sellerId).eq("status", "available").order("created_at", { ascending: false }),
      supabase.from("reviews").select("*, buyer:profiles!buyer_id (full_name)").eq("seller_id", sellerId).order("created_at", { ascending: false }),
    ]);
    if (profileRes.error) setLoadFailed(true);
    setSeller((profileRes.data as Profile | null) ?? null);
    setListings((listingsRes.data ?? []) as unknown as ListingWithRelations[]);
    const reviewRows = (reviewsRes.data ?? []) as unknown as ReviewRow[];
    setReviews(reviewRows);

    // Purchases from this seller that the signed-in buyer has not reviewed yet.
    if (user && user.id !== sellerId) {
      const { data: sales } = await supabase
        .from("sales")
        .select("id, listing:listings (title)")
        .eq("buyer_id", user.id)
        .eq("seller_id", sellerId);
      const reviewed = new Set(reviewRows.filter((r) => r.buyer_id === user.id).map((r) => r.sale_id));
      setPendingSales(((sales ?? []) as unknown as PendingSale[]).filter((s) => !reviewed.has(s.id)));
    } else {
      setPendingSales([]);
    }
    setLoading(false);
  }, [sellerId, user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, load]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading text="Loading profile..." />
      </div>
    );
  }

  if (!seller || seller.role !== "seller") {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <div className="px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{loadFailed ? "Could not load this profile" : "Seller not found"}</h1>
          {loadFailed && <p className="mt-2 text-zinc-500">Check your internet connection and try again.</p>}
          <Link href="/" className={`mt-6 inline-block ${primaryButton}`}>Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  const verified = isActiveSeller(seller);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const isMe = user?.id === seller.id;

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <Header />

      <main className="mx-auto max-w-5xl px-4 pt-8">
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold text-zinc-900">
                {sellerName(seller)}
                {verified && <VerifiedPill />}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                <span className="font-bold text-amber-500">
                  ★ {average > 0 ? average.toFixed(1) : "No reviews yet"}
                </span>
                <span>•</span>
                <span>{listings.length} active {listings.length === 1 ? "listing" : "listings"}</span>
                {seller.location && (
                  <>
                    <span>•</span>
                    <span>Shop: {seller.location}</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-400">Member since {formatDate(seller.created_at)}</p>
            </div>
            {!isMe && user && <ReportSeller sellerId={seller.id} reporterId={user.id} />}
          </div>

          {pendingSales.length > 0 && user && (
            <div className="mt-6 space-y-4 border-t border-zinc-200 pt-6">
              {pendingSales.map((sale) => (
                <ReviewForm key={sale.id} sale={sale} sellerId={seller.id} buyerId={user.id} onDone={load} />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold text-zinc-900">Phones from {sellerName(seller)}</h2>
            {listings.length === 0 ? (
              <p className="text-sm text-zinc-500">No phones listed right now.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-1 text-xl font-bold text-zinc-900">Reviews ({reviews.length})</h2>
            <p className="mb-4 text-xs text-zinc-500">Only buyers whose purchase the seller confirmed can review.</p>
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-sm text-zinc-500">No reviews yet.</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900">{r.buyer?.full_name || "Buyer"}</span>
                      <span className="text-xs text-zinc-400">{formatDate(r.created_at)}</span>
                    </div>
                    <div className="mb-2 flex text-sm text-amber-500" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s}>{s <= r.rating ? "★" : "☆"}</span>
                      ))}
                    </div>
                    {r.comment && <p className="text-sm text-zinc-600">{r.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ReviewForm({
  sale,
  sellerId,
  buyerId,
  onDone,
}: {
  sale: PendingSale;
  sellerId: string;
  buyerId: string;
  onDone: () => void | Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: insertError } = await getSupabase().from("reviews").insert({
      sale_id: sale.id,
      seller_id: sellerId,
      buyer_id: buyerId,
      rating,
      comment: comment.trim() || null,
    });
    if (insertError) {
      setError("Could not save your review. Please try again.");
      setBusy(false);
      return;
    }
    await onDone();
  };

  return (
    <form onSubmit={submit}>
      <h3 className="text-lg font-semibold text-zinc-900">
        Review your purchase{sale.listing ? `: ${sale.listing.title}` : ""}
      </h3>
      <div className="mt-3 flex items-center gap-1">
        <span className="mr-2 text-sm font-medium text-zinc-700">Rating:</span>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => setRating(star)}
            className={`text-2xl ${rating >= star ? "text-amber-500" : "text-zinc-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        maxLength={600}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Was the phone as described? How was the seller?"
        className={`mt-3 ${inputClass}`}
      />
      <div className="mt-3">
        <ErrorBox message={error} />
      </div>
      <button type="submit" disabled={busy} className={`mt-3 ${primaryButton}`}>
        {busy ? "Saving..." : "Submit review"}
      </button>
    </form>
  );
}

function ReportSeller({ sellerId, reporterId }: { sellerId: string; reporterId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: insertError } = await getSupabase().from("reports").insert({
      reporter_id: reporterId,
      seller_id: sellerId,
      reason,
      details: details.trim() || null,
    });
    if (insertError) {
      setError("Could not send the report. Please try again.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  };

  if (done) return <NoticeBox tone="green">Thank you. We will look into this seller.</NoticeBox>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={secondaryButton}>
        Report seller
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Report this seller</h3>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <textarea
        rows={3}
        maxLength={600}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="What happened? (optional)"
        className={inputClass}
      />
      <ErrorBox message={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "Sending..." : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
