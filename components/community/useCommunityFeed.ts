"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { CommunityMessage, CommunityPostRow } from "@/lib/types";

export type FeedMessage = CommunityMessage & { pending?: boolean; failed?: boolean };

const POST_SELECT = `
  id, community_id, author_id, listing_id, caption, media_path, media_kind, created_at,
  author:profiles!author_id (id, full_name, shop_name, location, verified, paid_until, suspended),
  listing:listings (id, title, retail_price, condition, status, wholesale:listing_wholesale (wholesale_price))
`;

const time = (iso: string) => new Date(iso).getTime();

function mergeMessage(list: FeedMessage[], incoming: FeedMessage): FeedMessage[] {
  const idx = list.findIndex((m) => m.id === incoming.id || m.client_id === incoming.client_id);
  const next = idx >= 0 ? list.map((m, i) => (i === idx ? incoming : m)) : [...list, incoming];
  return next.sort((a, b) => time(a.created_at) - time(b.created_at));
}

/**
 * Everything that happens in one community: text messages and photo/video posts,
 * kept fresh with live updates. The screen shows them together, like WhatsApp.
 */
export function useCommunityFeed(communityId: string, userId: string) {
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const loadPosts = useCallback(async () => {
    const { data, error: loadError } = await getSupabase()
      .from("community_posts")
      .select(POST_SELECT)
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (loadError) setError("Could not load photos. Check your connection.");
    else setPosts((data ?? []) as unknown as CommunityPostRow[]);
  }, [communityId]);

  const loadMessages = useCallback(async () => {
    const { data, error: loadError } = await getSupabase()
      .from("community_messages")
      .select("*")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (loadError) setError("Could not load messages. Check your connection.");
    else setMessages(((data ?? []) as CommunityMessage[]).reverse());
  }, [communityId]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadPosts(), loadMessages()]).then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPosts, loadMessages]);

  // Live updates: new messages and new posts from other members.
  useEffect(() => {
    const supabase = getSupabase();
    const filter = `community_id=eq.${communityId}`;
    const channel = supabase
      .channel(`community-feed:${communityId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter }, (payload) =>
        setMessages((prev) => mergeMessage(prev, payload.new as CommunityMessage))
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts", filter }, () => void loadPosts())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId, loadPosts]);

  /** Sends a text message. It appears at once and is confirmed (or marked failed) afterwards. */
  const sendText = useCallback(
    async (body: string, clientId: string = crypto.randomUUID()) => {
      const optimistic: FeedMessage = {
        id: clientId,
        client_id: clientId,
        community_id: communityId,
        sender_id: userId,
        body,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => mergeMessage(prev, optimistic));

      const { data, error: sendError } = await getSupabase()
        .from("community_messages")
        .insert({ community_id: communityId, sender_id: userId, body, client_id: clientId })
        .select("*")
        .single();

      if (sendError) {
        // 23505 means the server already has it (a retry), which is fine.
        if (sendError.code !== "23505") {
          setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m)));
        }
        return;
      }
      setMessages((prev) => mergeMessage(prev, data as CommunityMessage));
    },
    [communityId, userId]
  );

  const removePost = useCallback(
    async (post: CommunityPostRow) => {
      const supabase = getSupabase();
      // Best effort: only the author can remove the file itself.
      await supabase.storage.from("listing-media").remove([post.media_path]);
      const { error: deleteError } = await supabase.from("community_posts").delete().eq("id", post.id);
      if (deleteError) setError("Could not delete that post.");
      await loadPosts();
    },
    [loadPosts]
  );

  return { posts, messages, loaded, error, setError, sendText, reloadPosts: loadPosts, removePost };
}
