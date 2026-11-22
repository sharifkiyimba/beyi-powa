"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openConversation } from "@/lib/chat";
import type { Community, CommunityMember, CommunityPostRow } from "@/lib/types";
import { ErrorBox } from "../ui";
import { CommunityChat } from "./CommunityChat";
import { MediaGallery } from "./MediaGallery";
import { MembersTab } from "./MembersTab";
import { useCommunityFeed } from "./useCommunityFeed";

type View = "chat" | "gallery" | "info";

/**
 * One screen for a community, like a WhatsApp group: a single stream of messages and
 * photos, with a gallery of all media and a group-info page one tap away.
 */
export function CommunityRoom({
  community,
  members,
  userId,
  nameOf,
}: {
  community: Community;
  members: CommunityMember[];
  userId: string;
  nameOf: (userId: string) => string;
}) {
  const router = useRouter();
  const feed = useCommunityFeed(community.id, userId);
  const [view, setView] = useState<View>("chat");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  const confirmDelete = (post: CommunityPostRow) => {
    if (window.confirm("Delete this post?")) void feed.removePost(post);
  };

  const title = view === "gallery" ? "Photos & videos" : view === "info" ? "Community info" : community.name;
  const subtitle =
    view === "chat"
      ? `${members.length} ${members.length === 1 ? "member" : "members"} • tap ⓘ for info`
      : community.name;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-2 py-2.5 sm:px-3">
        <button
          onClick={() => (view === "chat" ? router.push("/communities") : setView("chat"))}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-zinc-600 hover:bg-zinc-100"
        >
          &larr;
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-zinc-900">{title}</h1>
          <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        </div>
        {view === "chat" && (
          <>
            <button
              onClick={() => setView("gallery")}
              aria-label="Photos and videos"
              title="Photos and videos"
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-zinc-100"
            >
              🖼
            </button>
            <button
              onClick={() => setView("info")}
              aria-label="Community info and members"
              title="Info and members"
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-zinc-100"
            >
              ⓘ
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-white px-3 pt-2">
          <ErrorBox message={error} />
        </div>
      )}

      {view === "chat" && (
        <CommunityChat
          communityId={community.id}
          userId={userId}
          communityOwnerId={community.owner_id}
          feed={feed}
          nameOf={nameOf}
          startingId={startingId}
          onMessageSeller={messageSeller}
        />
      )}

      {view === "gallery" && (
        <MediaGallery
          posts={feed.posts}
          userId={userId}
          communityOwnerId={community.owner_id}
          startingId={startingId}
          onMessageSeller={messageSeller}
          onDelete={confirmDelete}
        />
      )}

      {view === "info" && (
        <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
          {community.description && <p className="mb-4 text-sm text-zinc-600">{community.description}</p>}
          <MembersTab community={community} members={members} userId={userId} onLeft={() => router.push("/communities")} />
        </div>
      )}
    </div>
  );
}
