"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { dayLabel, formatTime, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import { mediaUrl } from "@/lib/listings";
import { isUnreadAt, markSeen, useSeenTick } from "@/lib/unread";
import type { CommunityOverview, Message } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { ChatBubble, CHAT_BACKGROUND, DayPill } from "@/components/chat/ChatBubble";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { Photo } from "@/components/Photo";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { ErrorBox, PageLoading } from "@/components/ui";

type Person = {
  id: string;
  role: "buyer" | "seller";
  full_name: string;
  shop_name: string | null;
  verified: boolean;
  paid_until: string | null;
  suspended: boolean;
};

type ListingBrief = {
  id: string;
  title: string;
  status: "available" | "sold";
  seller_id: string;
  retail_price: number;
  listing_media: { path: string; kind: "image" | "video"; position: number }[];
};

type ConversationRow = {
  id: string;
  initiator_id: string;
  recipient_id: string;
  listing_id: string | null;
  created_at: string;
  initiator: Person | null;
  recipient: Person | null;
  listing: ListingBrief | null;
};

type CommunityLast = { at: number; text: string; mine: boolean; media: "image" | "video" | null };

/** A message on screen. `pending` and `failed` only exist before the server confirms it. */
type ChatMessage = Message & { pending?: boolean; failed?: boolean };

type Filter = "all" | "chats" | "communities";

type ListRow = {
  key: string;
  href: string;
  group: boolean;
  title: string;
  subtitle: string | null;
  preview: string;
  previewMine: boolean;
  previewMedia: "image" | "video" | null;
  at: number;
  unread: number;
  verified: boolean;
  seed: string;
};

const PERSON_FIELDS = "id, role, full_name, shop_name, verified, paid_until, suspended";

function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = list.findIndex((m) => m.id === incoming.id || m.client_id === incoming.client_id);
  const next = idx >= 0 ? list.map((m, i) => (i === idx ? incoming : m)) : [...list, incoming];
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The time shown at the right of a chat row: the time today, otherwise "Yesterday" or the date. */
function rowTime(at: number): string {
  const iso = new Date(at).toISOString();
  const label = dayLabel(iso);
  return label === "Today" ? formatTime(iso) : label;
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");
  const { user, profile, loading: authLoading } = useAuth();
  const canUseCommunities = isActiveSeller(profile);
  const seenTick = useSeenTick();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [recent, setRecent] = useState<Message[]>([]); // newest first
  const [communities, setCommunities] = useState<CommunityOverview[]>([]);
  const [communityLast, setCommunityLast] = useState<Record<string, CommunityLast>>({});
  const [listLoaded, setListLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
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
         initiator:profiles!initiator_id (${PERSON_FIELDS}),
         recipient:profiles!recipient_id (${PERSON_FIELDS}),
         listing:listings (id, title, status, seller_id, retail_price, listing_media (path, kind, position))`
      )
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as ConversationRow[];
    setConversations(rows);
    knownIdsRef.current = new Set(rows.map((r) => r.id));

    if (rows.length) {
      const { data: latest } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", rows.map((r) => r.id))
        .order("created_at", { ascending: false })
        .limit(300);
      setRecent((latest ?? []) as Message[]);
    }
    setListLoaded(true);
  }, [user]);

  const loadCommunities = useCallback(async () => {
    if (!user || !canUseCommunities) return;
    const supabase = getSupabase();
    const { data } = await supabase.rpc("communities_overview");
    const mine = ((data ?? []) as CommunityOverview[]).filter((c) => c.is_member);
    setCommunities(mine);
    if (mine.length === 0) return;

    const ids = mine.map((c) => c.id);
    const [msgRes, postRes] = await Promise.all([
      supabase
        .from("community_messages")
        .select("community_id, sender_id, body, created_at")
        .in("community_id", ids)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("community_posts")
        .select("community_id, author_id, caption, media_kind, created_at")
        .in("community_id", ids)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const last: Record<string, CommunityLast> = {};
    const consider = (id: string, entry: CommunityLast) => {
      if (!last[id] || entry.at > last[id].at) last[id] = entry;
    };
    for (const m of (msgRes.data ?? []) as { community_id: string; sender_id: string; body: string; created_at: string }[]) {
      consider(m.community_id, { at: new Date(m.created_at).getTime(), text: m.body, mine: m.sender_id === user.id, media: null });
    }
    for (const p of (postRes.data ?? []) as { community_id: string; author_id: string; caption: string | null; media_kind: "image" | "video"; created_at: string }[]) {
      consider(p.community_id, {
        at: new Date(p.created_at).getTime(),
        text: p.caption || (p.media_kind === "video" ? "Video" : "Photo"),
        mine: p.author_id === user.id,
        media: p.media_kind,
      });
    }
    setCommunityLast(last);
  }, [user, canUseCommunities]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCommunities();
  }, [loadCommunities]);

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
        if (cancelled) return;
        setMessages(((data ?? []) as Message[]).reverse());
        setLoadedFor(activeId);
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
        setRecent((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
        if (m.conversation_id === activeIdRef.current) setMessages((prev) => mergeMessage(prev, m));
        if (!knownIdsRef.current.has(m.conversation_id)) void loadConversations();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  const shown = useMemo(() => (loadedFor === activeId ? messages : []), [loadedFor, activeId, messages]);

  // Opening a chat (or getting a message in it while it is open) marks it as read.
  useEffect(() => {
    if (activeId && loadedFor === activeId) markSeen(activeId);
  }, [activeId, loadedFor, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown.length]);

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
    setRecent((prev) => (prev.some((x) => x.id === saved.id) ? prev : [saved, ...prev]));
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

  // The rows of the chat list: buyer/seller chats and communities, newest first.
  const rows = useMemo<ListRow[]>(() => {
    if (!user) return [];
    void seenTick; // re-run when a chat is marked as read
    const lastByConv: Record<string, Message> = {};
    const unreadByConv: Record<string, number> = {};
    for (const m of recent) {
      if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
      if (m.sender_id !== user.id && isUnreadAt(m.conversation_id, new Date(m.created_at).getTime())) {
        unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] ?? 0) + 1;
      }
    }

    const chatRows: ListRow[] = conversations.map((c) => {
      const person = c.initiator_id === user.id ? c.recipient : c.initiator;
      const last = lastByConv[c.id];
      return {
        key: `c-${c.id}`,
        href: `/inbox?c=${c.id}`,
        group: false,
        title: sellerName(person),
        subtitle: c.listing?.title ?? null,
        preview: last ? last.body : "No messages yet",
        previewMine: last ? last.sender_id === user.id : false,
        previewMedia: null,
        at: last ? new Date(last.created_at).getTime() : new Date(c.created_at).getTime(),
        unread: c.id === activeId ? 0 : (unreadByConv[c.id] ?? 0),
        verified: isActiveSeller(person),
        seed: person?.id ?? c.id,
      };
    });

    const groupRows: ListRow[] = communities.map((g) => {
      const last = communityLast[g.id];
      return {
        key: `g-${g.id}`,
        href: `/communities/${g.id}`,
        group: true,
        title: g.name,
        subtitle: null,
        preview: last ? last.text : `${g.member_count} ${g.member_count === 1 ? "member" : "members"}`,
        previewMine: last?.mine ?? false,
        previewMedia: last?.media ?? null,
        at: last ? last.at : new Date(g.created_at).getTime(),
        unread: 0,
        verified: false,
        seed: g.id,
      };
    });

    const all = filter === "chats" ? chatRows : filter === "communities" ? groupRows : [...chatRows, ...groupRows];
    return all.sort((a, b) => b.at - a.at);
  }, [user, conversations, communities, communityLast, recent, filter, activeId, seenTick]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading text="Loading chats..." />
      </div>
    );
  }

  const other = active ? otherOf(active) : null;
  const iAmListingSeller = Boolean(active?.listing && active.listing.seller_id === user.id);
  const thumb = active?.listing
    ? [...active.listing.listing_media].sort((a, b) => a.position - b.position).find((m) => m.kind === "image")
    : null;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "chats", label: "Chats" },
    { key: "communities", label: "Communities" },
  ];

  return (
    <div className="flex h-dvh flex-col bg-zinc-50">
      {/* On a phone an open chat fills the whole screen, like WhatsApp. */}
      <div className={activeId ? "hidden md:block" : ""}>
        <Header />
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 md:p-4">
        <div className="flex min-h-0 flex-1 overflow-hidden bg-white md:rounded-2xl md:border md:border-zinc-200 md:shadow-sm">
          {/* The chat list */}
          <section
            aria-label="Chats"
            className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col border-zinc-200 bg-white md:w-[360px] md:shrink-0 md:border-r`}
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h1 className="text-2xl font-bold text-zinc-900">Chats</h1>
              {canUseCommunities && (
                <Link
                  href="/communities"
                  aria-label="Find or create communities"
                  title="Find or create communities"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
                >
                  <Icon name="users" className="h-6 w-6" />
                </Link>
              )}
            </div>

            {canUseCommunities && (
              <div className="flex gap-2 px-4 pb-2">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                      filter === f.key ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {!listLoaded ? (
                <p className="p-4 text-sm text-zinc-500">Loading...</p>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center px-8 py-16 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                    <Icon name="chat" className="h-8 w-8" />
                  </span>
                  <p className="mt-4 font-semibold text-zinc-900">No chats yet</p>
                  <p className="mt-1 text-sm text-zinc-500">Open a phone and tap Message seller to start a chat.</p>
                  <Link href="/" className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                    Browse phones
                  </Link>
                </div>
              ) : (
                <ul>
                  {rows.map((r) => {
                    const selected = r.href === `/inbox?c=${activeId}`;
                    return (
                      <li key={r.key}>
                        <button
                          onClick={() => router.push(r.href)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 ${selected ? "bg-blue-50" : ""}`}
                        >
                          <Avatar name={r.title} seed={r.seed} group={r.group} />
                          <div className="min-w-0 flex-1 border-b border-zinc-100 pb-3">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="flex min-w-0 items-center gap-1 text-[15px] font-semibold text-zinc-900">
                                <span className="truncate">{r.title}</span>
                                {r.verified && <VerifiedTick />}
                              </p>
                              <span className={`shrink-0 text-xs ${r.unread > 0 ? "font-semibold text-blue-600" : "text-zinc-400"}`}>
                                {rowTime(r.at)}
                              </span>
                            </div>
                            {r.subtitle && <p className="truncate text-xs font-medium text-blue-600">{r.subtitle}</p>}
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className={`flex min-w-0 items-center gap-1 text-sm ${r.unread > 0 ? "font-medium text-zinc-800" : "text-zinc-500"}`}>
                                {r.previewMine && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                                {r.previewMedia && <Icon name={r.previewMedia === "video" ? "play" : "image"} className="h-3.5 w-3.5 shrink-0" />}
                                <span className="truncate">{r.preview}</span>
                              </p>
                              {r.unread > 0 && (
                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                                  {r.unread > 99 ? "99+" : r.unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* The open chat */}
          <section
            aria-label="Conversation"
            className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col ${CHAT_BACKGROUND}`}
          >
            {active && other ? (
              <>
                <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-2 py-2">
                  <button
                    onClick={() => router.push("/inbox")}
                    aria-label="Back to chats"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 md:hidden"
                  >
                    <Icon name="back" className="h-6 w-6" />
                  </button>
                  {(() => {
                    const inner = (
                      <>
                        <Avatar name={sellerName(other)} seed={other.id} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 text-base font-semibold text-zinc-900">
                            <span className="truncate">{sellerName(other)}</span>
                            {isActiveSeller(other) && <VerifiedTick size="md" />}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {active.listing ? `About ${active.listing.title}` : other.role === "seller" ? "Tap to view shop" : "Direct chat"}
                          </p>
                        </div>
                      </>
                    );
                    return other.role === "seller" ? (
                      <Link href={`/seller/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-zinc-50">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3 px-1 py-0.5">{inner}</div>
                    );
                  })()}
                </div>

                {active.listing && (
                  <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-3 py-2">
                    <Link href={`/listing/${active.listing.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Photo
                        src={thumb ? mediaUrl(thumb.path) : null}
                        alt={active.listing.title}
                        className="h-11 w-11 shrink-0 rounded-lg bg-zinc-100 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">{active.listing.title}</p>
                        <p className="text-xs">
                          <span className="font-semibold text-blue-600">{formatUGX(active.listing.retail_price)}</span>
                          {active.listing.status === "sold" && <span className="ml-2 font-semibold text-red-600">Sold</span>}
                        </p>
                      </div>
                    </Link>
                    {iAmListingSeller && active.listing.status === "available" && (
                      <button
                        onClick={markSold}
                        disabled={busy}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {busy ? "Saving..." : "Mark as sold"}
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="bg-white px-3 py-2">
                    <ErrorBox message={error} />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {loadedFor === activeId && shown.length === 0 && (
                    <p className="mx-auto mt-6 max-w-xs rounded-lg bg-white/90 px-3 py-2 text-center text-xs text-zinc-500 shadow-sm">
                      Say hello. Ask about the phone&apos;s condition and when you can see it.
                    </p>
                  )}
                  {shown.map((msg, i) => {
                    const prev = shown[i - 1];
                    const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                    const first = newDay || prev.sender_id !== msg.sender_id;
                    return (
                      <Fragment key={msg.client_id}>
                        {newDay && <DayPill label={dayLabel(msg.created_at)} />}
                        <ChatBubble
                          body={msg.body}
                          at={msg.created_at}
                          mine={msg.sender_id === user.id}
                          first={first}
                          pending={msg.pending}
                          failed={msg.failed}
                          onRetry={() => void sendMessage(msg.body, msg.client_id)}
                        />
                      </Fragment>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={handleSubmit} className="flex items-center gap-2 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <input
                    type="text"
                    maxLength={2000}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message"
                    aria-label="Message"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    aria-label="Send"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-zinc-300"
                  >
                    <Icon name="send" className="h-5 w-5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-zinc-400">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/80">
                  <Icon name="chat" className="h-10 w-10" />
                </span>
                <p className="mt-4 text-lg font-medium text-zinc-500">
                  {activeId && listLoaded ? "Chat not found" : activeId ? "Loading..." : "Select a chat to start messaging"}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* The tab bar only shows on the chat list, never inside a chat. */}
      <div className={activeId ? "hidden" : ""}>
        <BottomNav active="chats" />
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading chats...</div>}>
      <InboxContent />
    </Suspense>
  );
}
