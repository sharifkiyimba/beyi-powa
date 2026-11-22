"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

// "Unread" is remembered on this phone (which chats you opened, and when). It needs no
// database change. Chats from before this feature was first used count as already read.

const SEEN_KEY = "bp_seen_v1";
const BASE_KEY = "bp_seen_base_v1";
const EVENT = "bp-seen";

function readSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function baseline(): number {
  try {
    let v = localStorage.getItem(BASE_KEY);
    if (!v) {
      v = String(Date.now());
      localStorage.setItem(BASE_KEY, v);
    }
    return Number(v);
  } catch {
    return 0;
  }
}

/** Call when a chat is opened (or a new message arrives in the open chat). */
export function markSeen(conversationId: string): void {
  try {
    const seen = readSeen();
    seen[conversationId] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: unread badges just will not clear */
  }
}

/** True when a message that arrived at `at` (ms) has not been seen yet in this chat. */
export function isUnreadAt(conversationId: string, at: number): boolean {
  const seen = Math.max(readSeen()[conversationId] ?? 0, baseline());
  return at > seen;
}

/** Re-render when something is marked as seen. Returns a counter to use as a dependency. */
export function useSeenTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(EVENT, bump);
    return () => window.removeEventListener(EVENT, bump);
  }, []);
  return tick;
}

/** The number of chats with something new, for the badge on the Chats tab. */
export function useUnreadChats(userId: string | undefined): number {
  const [count, setCount] = useState(0);
  const tick = useSeenTick();

  const compute = useCallback(async () => {
    if (!userId) return;
    const { data } = await getSupabase()
      .from("messages")
      .select("conversation_id, created_at")
      .neq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const newest = new Map<string, number>();
    for (const m of (data ?? []) as { conversation_id: string; created_at: string }[]) {
      if (!newest.has(m.conversation_id)) newest.set(m.conversation_id, new Date(m.created_at).getTime());
    }
    let n = 0;
    for (const [id, at] of newest) if (isUnreadAt(id, at)) n++;
    setCount(n);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void compute();
  }, [compute, tick]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`unread:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void compute())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, compute]);

  return count;
}
