"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { CONDITION_LABEL, daysUntil, formatDate, formatUGX, sellerStatus } from "@/lib/format";
import { mediaUrl } from "@/lib/listings";
import type { Listing, ListingMedia } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { BecomeSellerCard } from "@/components/BecomeSellerCard";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Photo } from "@/components/Photo";
import { VerifiedPill } from "@/components/VerifiedBadge";
import { VerificationCard } from "@/components/VerificationCard";
import { NoticeBox, PageLoading, primaryButton, secondaryButton } from "@/components/ui";

type MyListing = Listing & {
  listing_media: ListingMedia[];
  stats?: { views: number } | { views: number }[] | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({});
  const [listingsLoaded, setListingsLoaded] = useState(false);

  const loadListings = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabase();
    let res = await supabase
      .from("listings")
      .select("*, listing_media (path, kind, position), stats:listing_stats (views)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (res.error) {
      // The views table may not exist yet: still show the phones.
      res = await supabase
        .from("listings")
        .select("*, listing_media (path, kind, position)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
    }
    const rows = (res.data ?? []) as unknown as MyListing[];
    setMyListings(rows);

    if (rows.length) {
      const { data: convs } = await supabase
        .from("conversations")
        .select("listing_id")
        .in("listing_id", rows.map((r) => r.id));
      const counts: Record<string, number> = {};
      for (const c of (convs ?? []) as { listing_id: string }[]) counts[c.listing_id] = (counts[c.listing_id] ?? 0) + 1;
      setChatCounts(counts);
    }
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

  const setSold = async (listing: Listing, sold: boolean) => {
    const message = sold
      ? `Mark "${listing.title}" as sold? Use this when it was sold outside the app. If a buyer from a chat bought it, tap Mark as sold inside that chat so they can review you.`
      : `Put "${listing.title}" back on sale?`;
    if (!window.confirm(message)) return;
    await getSupabase().from("listings").update({ status: sold ? "sold" : "available" }).eq("id", listing.id);
    await loadListings();
  };

  const deleteListing = async (listing: Listing) => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    const supabase = getSupabase();
    const { data: media } = await supabase.from("listing_media").select("path").eq("listing_id", listing.id);
    const paths = ((media ?? []) as { path: string }[]).map((m) => m.path);
    if (paths.length) await supabase.storage.from("listing-media").remove(paths);
    await supabase.from("listings").delete().eq("id", listing.id);
    await loadListings();
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
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
          {!isSeller && (
            <div className="lg:col-span-2">
              <BecomeSellerCard />
            </div>
          )}

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
                    Sell a phone
                  </Link>
                ) : (
                  <p className="text-sm text-zinc-500">Posting phones unlocks once you have the blue tick. Follow the steps above to get verified.</p>
                )
              ) : (
                <Link href="/" className={`block w-full text-center ${primaryButton}`}>
                  Browse phones
                </Link>
              )}
              <Link href="/inbox" className={`block w-full text-center ${secondaryButton}`}>
                Open chats
              </Link>
              {status === "active" && (
                <Link href="/communities" className={`block w-full text-center ${secondaryButton}`}>
                  Seller communities
                </Link>
              )}
              {isSeller && (
                <Link href={`/seller/${profile.id}`} className={`block w-full text-center ${secondaryButton}`}>
                  View my public profile
                </Link>
              )}
              {profile.is_admin && (
                <Link href="/admin" className={`block w-full text-center ${secondaryButton} !text-red-600`}>
                  Admin
                </Link>
              )}
              <button onClick={handleSignOut} className={`block w-full text-center ${secondaryButton}`}>
                Log out
              </button>
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-zinc-900">My phones</h2>
              {status === "active" && (
                <Link href="/dashboard/add-listing" className="text-sm font-semibold text-blue-600 hover:underline">
                  Sell a phone
                </Link>
              )}
            </div>
            {!listingsLoaded ? (
              <PageLoading text="Loading your phones..." />
            ) : myListings.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">You have not listed any phones yet.</p>
            ) : (
              <ul className="space-y-3">
                {myListings.map((l) => {
                  const photo = [...l.listing_media].sort((a, b) => a.position - b.position).find((m) => m.kind === "image");
                  const stats = Array.isArray(l.stats) ? l.stats[0] : l.stats;
                  const sold = l.status === "sold";
                  return (
                    <li key={l.id} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
                      <div className="flex gap-3">
                        <Link href={`/listing/${l.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                          <Photo src={photo ? mediaUrl(photo.path) : null} alt={l.title} className="h-full w-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/listing/${l.id}`} className="truncate font-semibold text-zinc-900 hover:text-blue-600">
                              {l.title}
                            </Link>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${sold ? "bg-zinc-200 text-zinc-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {sold ? "Sold" : "Available"}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-600">
                            {formatUGX(l.retail_price)} • {CONDITION_LABEL[l.condition]}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {stats?.views ?? 0} {(stats?.views ?? 0) === 1 ? "view" : "views"} • {chatCounts[l.id] ?? 0}{" "}
                            {(chatCounts[l.id] ?? 0) === 1 ? "chat" : "chats"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                        <Link href={`/dashboard/edit/${l.id}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50">
                          Edit
                        </Link>
                        <button onClick={() => setSold(l, !sold)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50">
                          {sold ? "Put back on sale" : "Mark as sold"}
                        </button>
                        <button onClick={() => deleteListing(l)} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
      <BottomNav active="me" />
    </div>
  );
}
