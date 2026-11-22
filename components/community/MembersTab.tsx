"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { formatDate, isActiveSeller, sellerName } from "@/lib/format";
import type { Community, CommunityMember } from "@/lib/types";
import { VerifiedTick } from "../VerifiedBadge";
import { ErrorBox, secondaryButton } from "../ui";

export function MembersTab({
  community,
  members,
  userId,
  onLeft,
}: {
  community: Community;
  members: CommunityMember[];
  userId: string;
  /** Called after leaving or deleting, so the page can return to the list. */
  onLeft: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = community.owner_id === userId;

  const leave = async () => {
    if (!window.confirm("Leave this community?")) return;
    setBusy(true);
    const { error: leaveError } = await getSupabase()
      .from("community_members")
      .delete()
      .eq("community_id", community.id)
      .eq("user_id", userId);
    if (leaveError) {
      setError("Could not leave. Please try again.");
      setBusy(false);
      return;
    }
    onLeft();
  };

  const deleteCommunity = async () => {
    if (!window.confirm(`Delete "${community.name}" for everyone? All its posts and chat will be lost.`)) return;
    setBusy(true);
    const { error: deleteError } = await getSupabase().from("communities").delete().eq("id", community.id);
    if (deleteError) {
      setError("Could not delete the community.");
      setBusy(false);
      return;
    }
    onLeft();
  };

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />

      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-900">
                <Link href={`/seller/${m.user_id}`} className="truncate hover:text-blue-600 hover:underline">
                  {sellerName(m.member)}
                </Link>
                {isActiveSeller(m.member) && <VerifiedTick />}
                {m.user_id === community.owner_id && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">Owner</span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                {m.member?.location ? `${m.member.location} • ` : ""}Joined {formatDate(m.joined_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {isOwner ? (
          <button onClick={deleteCommunity} disabled={busy} className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            Delete community
          </button>
        ) : (
          <button onClick={leave} disabled={busy} className={secondaryButton}>
            Leave community
          </button>
        )}
      </div>
    </div>
  );
}
