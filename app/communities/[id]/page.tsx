"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { isActiveSeller, sellerName } from "@/lib/format";
import type { Community, CommunityMember } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { CommunityRoom } from "@/components/community/CommunityRoom";
import { ErrorBox, PageLoading, primaryButton } from "@/components/ui";

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
  const { user, profile, loading } = useAuth();
  const active = isActiveSeller(profile);

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
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

  // Not a member yet: show the community and a Join button.
  if (!isMember) {
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
          </div>

          <div className="mt-4">
            <ErrorBox message={error} />
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900">Join to see the chat and photos</h2>
            <p className="mt-1 text-sm text-zinc-500">Members are verified sellers. Photos, prices and chat are only visible inside.</p>
            <button onClick={join} disabled={joining} className={`mt-5 ${primaryButton}`}>
              {joining ? "Joining..." : "Join community"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // A member: the community opens like a WhatsApp group, filling the screen.
  return (
    <div className="flex h-dvh flex-col bg-zinc-50">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col sm:py-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-sm">
          <CommunityRoom community={community} members={members} userId={user.id} nameOf={nameOf} />
        </div>
      </main>
    </div>
  );
}
