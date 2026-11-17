"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { CONDITION_LABEL, daysUntil, formatDate, formatUGX, sellerStatus } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { VerifiedPill } from "@/components/VerifiedBadge";
import { VerificationCard } from "@/components/VerificationCard";
import { NoticeBox, PageLoading, primaryButton, secondaryButton } from "@/components/ui";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [listingsLoaded, setListingsLoaded] = useState(false);

  const loadListings = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("listings")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    setMyListings((data ?? []) as Listing[]);
    setListingsLoaded(true);
  }, [user]);

  useEffect(() => {
    if (profile?.role === "seller") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadListings();
    }
  }, [profile?.role, loadListings]);

  // The proxy already redirects signed-out visitors; this is a safety net.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/dashboard");
  }, [loading, user, router]);

  const deleteListing = async (listing: Listing) => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    const supabase = getSupabase();
    const { data: media } = await supabase.from("listing_media").select("path").eq("listing_id", listing.id);
    const paths = ((media ?? []) as { path: string }[]).map((m) => m.path);
    if (paths.length) await supabase.storage.from("listing-media").remove(paths);
    await supabase.from("listings").delete().eq("id", listing.id);
    await loadListings();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading />
      </div>
    );
  }

  // Signed in, but no profile row could be read (for example an account made before the database was set up).
  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">We could not load your profile</h1>
          <p className="mt-2 text-zinc-600">Check your connection and refresh. If this keeps happening, log out and sign up again with a new account.</p>
        </main>
      </div>
    );
  }

  const isSeller = profile.role === "seller";
  const status = isSeller ? sellerStatus(profile) : null;
  const daysLeft = profile.paid_until ? daysUntil(profile.paid_until) : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold text-zinc-900">
            Welcome, {profile.full_name || "friend"}!
            {status === "active" && <VerifiedPill label="Verified seller" />}
          </h1>
          <p className="mt-2 text-zinc-600">
            You are logged in as a <span className="font-semibold capitalize text-blue-600">{profile.role}</span>.
          </p>
        </div>

        {status === "suspended" && (
          <div className="mb-6">
            <NoticeBox tone="amber">
              Your seller account is suspended, so your phones are hidden. Contact BEYI POWA support if you think this is a mistake.
            </NoticeBox>
          </div>
        )}

        {status === "active" && daysLeft !== null && daysLeft <= 7 && (
          <div className="mb-6">
            <NoticeBox tone="amber">
              Your blue tick ends on {formatDate(profile.paid_until!)} ({Math.max(daysLeft, 0)} days left). Renew on WhatsApp to keep your phones visible.
            </NoticeBox>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {(status === "unverified" || status === "expired") && (
            <div className="lg:col-span-2">
              <VerificationCard profile={profile} renewal={status === "expired"} />
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Quick actions</h2>
            <div className="mt-4 space-y-3">
              {isSeller ? (
                status === "active" ? (
                  <Link href="/dashboard/add-listing" className={`block w-full text-center ${primaryButton}`}>
                    + Add new phone listing
                  </Link>
                ) : (
                  <p className="text-sm text-zinc-500">Posting phones unlocks once you have the blue tick.</p>
                )
              ) : (
                <Link href="/" className={`block w-full text-center ${primaryButton}`}>
                  Browse phones
                </Link>
              )}
              <Link href="/inbox" className={`block w-full text-center ${secondaryButton}`}>
                Open inbox
              </Link>
              {isSeller && (
                <Link href={`/seller/${profile.id}`} className={`block w-full text-center ${secondaryButton}`}>
                  View my public profile
                </Link>
              )}
            </div>
          </div>

          {status === "active" && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Your blue tick</h2>
              <p className="mt-2 text-sm text-zinc-600">
                {profile.paid_until
                  ? `Active until ${formatDate(profile.paid_until)}.`
                  : "Active. You are a founding seller with no expiry date."}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Verified sellers see wholesale prices and can create and join communities.
              </p>
            </div>
          )}
        </div>

        {isSeller && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold text-zinc-900">My listings</h2>
            {!listingsLoaded ? (
              <PageLoading text="Loading your phones..." />
            ) : myListings.length === 0 ? (
              <p className="text-sm text-zinc-500">You have not listed any phones yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <ul className="divide-y divide-zinc-100">
                  {myListings.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <Link href={`/listing/${l.id}`} className="font-semibold text-zinc-900 hover:text-blue-600 hover:underline">
                          {l.title}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          {formatUGX(l.retail_price)} • {CONDITION_LABEL[l.condition]}
                          {l.status === "sold" && " • Sold"}
                        </p>
                      </div>
                      <button onClick={() => deleteListing(l)} className="text-xs font-semibold text-red-600 hover:underline">
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
