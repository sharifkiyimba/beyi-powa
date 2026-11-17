"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { formatTime, sellerName } from "@/lib/format";
import type { Message } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ErrorBox, PageLoading, primaryButton } from "@/components/ui";

type Person = { id: string; full_name: string; shop_name: string | null };

type ConversationRow = {
  id: string;
  initiator_id: string;
  recipient_id: string;
  listing_id: string | null;
  created_at: string;
  initiator: Person | null;
  recipient: Person | null;
  listing: { id: string; title: string; status: "available" | "sold"; seller_id: string } | null;
};

/** A message on screen. `pending` and `failed` only exist before the server confirms it. */
type ChatMessage = Message & { pending?: boolean; failed?: boolean };

function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = list.findIndex((m) => m.id === incoming.id || m.client_id === incoming.client_id);
  const next = idx >= 0 ? list.map((m, i) => (i === idx ? incoming : m)) : [...list, incoming];
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");
  const { user, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [lastByConv, setLastByConv] = useState<Record<string, Message>>({});
  const [listLoaded, setListLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Refs let the live-update handler see the latest values without resubscribing.
  const activeIdRef = useRef<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from("conversations")
      .select(
        `id, initiator_id, recipient_id, listing_id, created_at,
         initiator:profiles!initiator_id (id, full_name, shop_name),
         recipient:profiles!recipient_id (id, full_name, shop_name),
         listing:listings (id, title, status, seller_id)`
      )
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as ConversationRow[];
    setConversations(rows);
    knownIdsRef.current = new Set(rows.map((r) => r.id));

    if (rows.length) {
      const { data: recent } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", rows.map((r) => r.id))
        .order("created_at", { ascending: false })
        .limit(300);
      const last: Record<string, Message> = {};
      for (const m of (recent ?? []) as Message[]) if (!last[m.conversation_id]) last[m.conversation_id] = m;
      setLastByConv(last);
    }
    setListLoaded(true);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
  }, [loadConversations]);

  // Load the messages of the open conversation.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    getSupabase()
      .from("messages")
      .select("*")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!cancelled) setMessages(((data ?? []) as Message[]).reverse());
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Live updates: new messages appear instantly, for open and other chats.
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        setLastByConv((prev) => ({ ...prev, [m.conversation_id]: m }));
        if (m.conversation_id === activeIdRef.current) setMessages((prev) => mergeMessage(prev, m));
        if (!knownIdsRef.current.has(m.conversation_id)) void loadConversations();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
  const otherOf = useCallback(
    (c: ConversationRow): Person | null => (c.initiator_id === user?.id ? c.recipient : c.initiator),
    [user]
  );

  const sendMessage = async (body: string, clientId: string = crypto.randomUUID()) => {
    if (!user || !activeId) return;
    const supabase = getSupabase();
    const optimistic: ChatMessage = {
      id: clientId,
      client_id: clientId,
      conversation_id: activeId,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => mergeMessage(prev, optimistic));

    const { data, error: sendError } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, body, client_id: clientId })
      .select("*")
      .single();

    if (sendError) {
      // 23505 means the server already has this message (a retry): that is fine.
      if (sendError.code !== "23505") {
        setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m)));
      }
      return;
    }
    const saved = data as Message;
    setMessages((prev) => mergeMessage(prev, saved));
    setLastByConv((prev) => ({ ...prev, [saved.conversation_id]: saved }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body) return;
    setNewMessage("");
    void sendMessage(body);
  };

  const markSold = async () => {
    if (!active?.listing || !user) return;
    const buyer = otherOf(active);
    if (!buyer) return;
    if (!window.confirm(`Mark "${active.listing.title}" as sold to ${buyer.full_name}? They will then be able to review you.`)) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await getSupabase().rpc("mark_sold", {
      p_listing: active.listing.id,
      p_buyer: buyer.id,
    });
    if (rpcError) setError("Could not mark this phone as sold. It may already be sold.");
    await loadConversations();
    setBusy(false);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading text="Loading inbox..." />
      </div>
    );
  }

  const sortedConversations = [...conversations].sort((a, b) =>
    (lastByConv[b.id]?.created_at ?? b.created_at).localeCompare(lastByConv[a.id]?.created_at ?? a.created_at)
  );
  const other = active ? otherOf(active) : null;
  const iAmListingSeller = Boolean(active?.listing && active.listing.seller_id === user.id);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 p-0 sm:p-4">
        <div className="flex h-[calc(100dvh-4rem)] overflow-hidden border-zinc-200 bg-white shadow-sm sm:h-[650px] sm:rounded-2xl sm:border">
          {/* Conversation list */}
          <div className={`${activeId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-zinc-200 bg-white md:w-1/3`}>
            <div className="border-b border-zinc-200 bg-zinc-50 p-4">
              <h2 className="font-bold text-zinc-900">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!listLoaded ? (
                <p className="p-4 text-sm text-zinc-500">Loading...</p>
              ) : sortedConversations.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500">
                  No messages yet. Open a phone and tap &ldquo;Message seller&rdquo; to start a chat.
                </p>
              ) : (
                sortedConversations.map((c) => {
                  const person = otherOf(c);
                  const last = lastByConv[c.id];
                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/inbox?c=${c.id}`)}
                      className={`w-full border-b border-zinc-200 p-4 text-left transition-colors hover:bg-zinc-50 ${activeId === c.id ? "bg-blue-50" : ""}`}
                    >
                      <p className="text-sm font-semibold text-zinc-900">{sellerName(person)}</p>
                      {c.listing && <p className="truncate text-xs text-blue-600">{c.listing.title}</p>}
                      <p className="mt-1 truncate text-xs text-zinc-500">{last ? last.body : "No messages yet"}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Open chat */}
          <div className={`${activeId ? "flex" : "hidden md:flex"} w-full flex-col bg-zinc-50 md:w-2/3`}>
            {active && other ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    <button onClick={() => router.push("/inbox")} className="text-lg text-zinc-500 md:hidden" aria-label="Back to messages">
                      &larr;
                    </button>
                    <div>
                      <h1 className="text-base font-bold text-zinc-900">
                        <Link href={`/seller/${other.id}`} className="hover:text-blue-600 hover:underline">{sellerName(other)}</Link>
                      </h1>
                      {active.listing && (
                        <Link href={`/listing/${active.listing.id}`} className="text-xs text-blue-600 hover:underline">
                          {active.listing.title}
                          {active.listing.status === "sold" && " (sold)"}
                        </Link>
                      )}
                    </div>
                  </div>
                  {iAmListingSeller && active.listing?.status === "available" && (
                    <button onClick={markSold} disabled={busy} className={`text-xs ${primaryButton}`}>
                      Mark as sold to {other.full_name.split(" ")[0] || "buyer"}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="px-4 pt-3">
                    <ErrorBox message={error} />
                  </div>
                )}

                <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
                  {messages.length === 0 && (
                    <p className="text-center text-sm text-zinc-400">Say hello. Ask about the phone&apos;s condition and when you can see it.</p>
                  )}
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                            isMe ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
                          } ${msg.pending ? "opacity-70" : ""}`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <span className={`mt-1 block text-[10px] ${isMe ? "text-blue-200" : "text-zinc-400"}`}>
                            {msg.failed ? (
                              <button onClick={() => sendMessage(msg.body, msg.client_id)} className="font-semibold underline">
                                Not sent. Tap to retry
                              </button>
                            ) : msg.pending ? (
                              "Sending..."
                            ) : (
                              formatTime(msg.created_at)
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-zinc-200 bg-white p-3 sm:p-4">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2000}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      aria-label="Message"
                      className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button type="submit" className={primaryButton}>Send</button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-zinc-400">
                <span className="mb-4 text-6xl">💬</span>
                <p className="text-lg font-medium">{activeId && listLoaded ? "Conversation not found" : "Select a chat to start messaging"}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading inbox...</div>}>
      <InboxContent />
    </Suspense>
  );
}
