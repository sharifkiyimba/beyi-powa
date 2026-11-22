"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";
import type { CommunityMessage } from "@/lib/types";
import { primaryButton } from "../ui";

type ChatMessage = CommunityMessage & { pending?: boolean; failed?: boolean };

function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = list.findIndex((m) => m.id === incoming.id || m.client_id === incoming.client_id);
  const next = idx >= 0 ? list.map((m, i) => (i === idx ? incoming : m)) : [...list, incoming];
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Group chat for everyone in the community. */
export function ChatTab({
  communityId,
  userId,
  nameOf,
}: {
  communityId: string;
  userId: string;
  nameOf: (userId: string) => string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("community_messages")
      .select("*")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages(((data ?? []) as CommunityMessage[]).reverse());
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  // Live updates from other members.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`community-chat:${communityId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${communityId}` },
        (payload) => setMessages((prev) => mergeMessage(prev, payload.new as CommunityMessage))
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (body: string, clientId: string = crypto.randomUUID()) => {
      const optimistic: ChatMessage = {
        id: clientId,
        client_id: clientId,
        community_id: communityId,
        sender_id: userId,
        body,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => mergeMessage(prev, optimistic));

      const { data, error } = await getSupabase()
        .from("community_messages")
        .insert({ community_id: communityId, sender_id: userId, body, client_id: clientId })
        .select("*")
        .single();

      if (error) {
        // 23505 means the server already has it (a retry), which is fine.
        if (error.code !== "23505") {
          setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m)));
        }
        return;
      }
      setMessages((prev) => mergeMessage(prev, data as CommunityMessage));
    },
    [communityId, userId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    void send(body);
  };

  return (
    <div className="flex h-[60vh] min-h-[360px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4">
        {loaded && messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400">No messages yet. Say hello to the group.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  mine ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
                } ${m.pending ? "opacity-70" : ""}`}
              >
                {!mine && <p className="mb-0.5 text-xs font-semibold text-blue-700">{nameOf(m.sender_id)}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <span className={`mt-1 block text-[10px] ${mine ? "text-blue-200" : "text-zinc-400"}`}>
                  {m.failed ? (
                    <button onClick={() => send(m.body, m.client_id)} className="font-semibold underline">
                      Not sent. Tap to retry
                    </button>
                  ) : m.pending ? (
                    "Sending..."
                  ) : (
                    formatTime(m.created_at)
                  )}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 bg-white p-3">
        <input
          type="text"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the group..."
          aria-label="Message"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button type="submit" className={primaryButton}>Send</button>
      </form>
    </div>
  );
}
