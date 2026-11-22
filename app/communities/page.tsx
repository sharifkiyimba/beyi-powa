"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { isActiveSeller } from "@/lib/format";
import type { CommunityOverview } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ErrorBox, NoticeBox, PageLoading, inputClass, primaryButton, secondaryButton } from "@/components/ui";

export default function CommunitiesPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const active = isActiveSeller(profile);

  const [items, setItems] = useState<CommunityOverview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await getSupabase().rpc("communities_overview");
    if (loadError) {
      setError(
        loadError.code === "PGRST202"
          ? "The communities database update has not been run yet (supabase/003_communities.sql)."
          : "Could not load communities. Check your connection and try again."
      );
    } else {
      setItems(((data ?? []) as CommunityOverview[]).map((c) => ({ ...c, member_count: Number(c.member_count) })));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [active, load]);

  const createCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    const { data, error: insertError } = await getSupabase()
      .from("communities")
      .insert({ name: form.name.trim(), description: form.description.trim() || null, owner_id: user.id })
      .select("id")
      .single();
    if (insertError) {
      setError("Could not create the community. Please try again.");
      setBusy(false);
      return;
    }
    router.push(`/communities/${(data as { id: string }).id}`);
  };

  const join = async (communityId: string) => {
    if (!user) return;
    setError("");
    const { error: joinError } = await getSupabase()
      .from("community_members")
      .insert({ community_id: communityId, user_id: user.id });
    if (joinError && joinError.code !== "23505") {
      setError("Could not join. Please try again.");
      return;
    }
    router.push(`/communities/${communityId}`);
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
          <p className="mt-2 text-zinc-600">
            Get your blue tick to join seller groups, share new stock and find lower prices from fellow sellers.
          </p>
          <Link href="/dashboard" className={`mt-6 inline-block ${primaryButton}`}>
            Go to dashboard
          </Link>
        </main>
      </div>
    );
  }

  const mine = items.filter((c) => c.is_member);
  const others = items.filter((c) => !c.is_member);

  const CommunityRow = ({ c }: { c: CommunityOverview }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <Link href={`/communities/${c.id}`} className="block truncate font-bold text-zinc-900 hover:text-blue-600">
          {c.name}
        </Link>
        {c.description && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600">{c.description}</p>}
        <p className="mt-1 text-xs text-zinc-400">
          {c.member_count} {c.member_count === 1 ? "member" : "members"}
        </p>
      </div>
      {c.is_member ? (
        <Link href={`/communities/${c.id}`} className={`shrink-0 ${secondaryButton}`}>
          Open
        </Link>
      ) : (
        <button onClick={() => join(c.id)} className={`shrink-0 ${primaryButton}`}>
          Join
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Seller communities</h1>
            <p className="mt-1 text-sm text-zinc-500">Groups of verified sellers sharing stock and prices.</p>
          </div>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className={primaryButton}>
              + Create community
            </button>
          )}
        </div>

        <div className="mb-4">
          <ErrorBox message={error} />
        </div>

        {showCreate && (
          <form onSubmit={createCommunity} className="mb-8 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-zinc-900">New community</h2>
            <input
              type="text"
              required
              minLength={3}
              maxLength={60}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Kikuubo iPhone Dealers"
              aria-label="Community name"
              className={inputClass}
            />
            <textarea
              rows={2}
              maxLength={300}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What is this group for? (optional)"
              aria-label="Description"
              className={inputClass}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className={secondaryButton}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {!loaded ? (
          <PageLoading text="Loading communities..." />
        ) : items.length === 0 && !error ? (
          <NoticeBox>No communities yet. Create the first one and invite other sellers.</NoticeBox>
        ) : (
          <div className="space-y-8">
            {mine.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-zinc-900">Your communities</h2>
                <div className="space-y-3">{mine.map((c) => <CommunityRow key={c.id} c={c} />)}</div>
              </section>
            )}
            {others.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-zinc-900">Discover</h2>
                <div className="space-y-3">{others.map((c) => <CommunityRow key={c.id} c={c} />)}</div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
