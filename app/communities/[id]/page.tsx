"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { isActiveSeller, sellerName } from "@/lib/format";
import type { Community, CommunityMember } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ChatTab } from "@/components/community/ChatTab";
import { MembersTab } from "@/components/community/MembersTab";
import { ProductsTab } from "@/components/community/ProductsTab";
import { ErrorBox, PageLoading, primaryButton } from "@/components/ui";

type Tab = "products" | "chat" | "members";

const TABS: { id: Tab; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "chat", label: "Group chat" },
  { id: "members", label: "Members" },
];

export default function CommunityPage() {
  // useParams() needs a Suspense boundary in this version of Next.js.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50">
          <Header />
          <PageLoading text="Loading community..." />
        </div>
      }
    >
      <CommunityContent />
    </Suspense>
  );
}

function CommunityContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const active = isActiveSeller(profile);

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [communityRes, membersRes] = await Promise.all([
      supabase.from("communities").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("community_members")
        .select("user_id, joined_at, member:profiles!user_id (id, full_name, shop_name, location, verified, paid_until, suspended)")
        .eq("community_id", id)
        .order("joined_at", { ascending: true }),
    ]);
    if (communityRes.error) setLoadFailed(true);
    setCommunity((communityRes.data as Community | null) ?? null);
    setMembers((membersRes.data ?? []) as unknown as CommunityMember[]);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [active, load]);

  const join = async () => {
    if (!user) return;
    setJoining(true);
    setError("");
    const { error: joinError } = await getSupabase()
      .from("community_members")
      .insert({ community_id: id, user_id: user.id });
    if (joinError && joinError.code !== "23505") {
      setError("Could not join. Please try again.");
      setJoining(false);
      return;
    }
    await load();
    setJoining(false);
  };

  const nameOf = (userId: string) => {
    const m = members.find((x) => x.user_id === userId);
    return m ? sellerName(m.member) : "Seller";
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Communities are for verified sellers</h1>
          <p className="mt-2 text-zinc-600">Your blue tick must be active to see this community.</p>
          <Link href="/dashboard" className={`mt-6 inline-block ${primaryButton}`}>Go to dashboard</Link>
        </main>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading text="Loading community..." />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{loadFailed ? "Could not load this community" : "Community not found"}</h1>
          <p className="mt-2 text-zinc-600">
            {loadFailed ? "Check your internet connection and try again." : "It may have been deleted."}
          </p>
          <Link href="/communities" className={`mt-6 inline-block ${primaryButton}`}>Back to communities</Link>
        </main>
      </div>
    );
  }

  const isMember = members.some((m) => m.user_id === user.id);

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <Header />

      <main className="mx-auto max-w-3xl px-4 pt-6">
        <Link href="/communities" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          &larr; All communities
        </Link>

        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">{community.name}</h1>
          {community.description && <p className="mt-1 text-sm text-zinc-600">{community.description}</p>}
          {isMember && (
            <p className="mt-2 text-xs text-zinc-400">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          )}
        </div>

        <div className="mt-4">
          <ErrorBox message={error} />
        </div>

        {!isMember ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900">Join to see the posts and chat</h2>
            <p className="mt-1 text-sm text-zinc-500">Members are verified sellers. Photos, prices and chat are only visible inside.</p>
            <button onClick={join} disabled={joining} className={`mt-5 ${primaryButton}`}>
              {joining ? "Joining..." : "Join community"}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-1 rounded-xl bg-zinc-200/60 p-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                    tab === t.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === "products" && (
                <ProductsTab communityId={community.id} userId={user.id} communityOwnerId={community.owner_id} />
              )}
              {tab === "chat" && <ChatTab communityId={community.id} userId={user.id} nameOf={nameOf} />}
              {tab === "members" && (
                <MembersTab community={community} members={members} userId={user.id} onLeft={() => router.push("/communities")} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
