"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/mockData";

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [user, setUser] = useState<any>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userChats, setUserChats] = useState<any[]>([]);

  useEffect(() => {
    const currentUser = db.getUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    setUserChats(db.getUserChats(currentUser.id));

    const chatParam = searchParams.get("chat");
    const receiverParam = searchParams.get("receiver");
    if (chatParam && receiverParam) {
      setActiveChatId(chatParam);
      setReceiverName(receiverParam);
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (activeChatId) {
      setMessages(db.getMessages(activeChatId));
    }
  }, [activeChatId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    const msg = {
      id: Date.now().toString(),
      sender: user.name,
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    db.sendMessage(activeChatId, msg);
    setMessages(db.getMessages(activeChatId));
    setNewMessage("");
    setUserChats(db.getUserChats(user.id));
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
            <span className="text-lg font-bold text-zinc-900">BEYI POWA</span>
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4">
        <div className="flex h-[650px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          
          {/* Sidebar */}
          <div className="w-1/3 border-r border-zinc-200 bg-white flex flex-col">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50">
              <h2 className="font-bold text-zinc-900">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userChats.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500">No messages yet.</p>
              ) : (
                userChats.map((chat) => {
                  // Look up the real name by ID
                  const otherPerson = db.getSellerById(chat.receiverId || "");
                  const displayName = otherPerson ? otherPerson.name : "User";
                  
                  return (
                    <button
                      key={chat.id}
                      onClick={() => { setActiveChatId(chat.id); setReceiverName(displayName); }}
                      className={`w-full text-left p-4 border-b border-zinc-200 hover:bg-zinc-50 transition-colors ${activeChatId === chat.id ? "bg-blue-50" : ""}`}
                    >
                      <p className="font-semibold text-zinc-900 text-sm">{displayName}</p>
                      <p className="text-xs text-zinc-500 truncate mt-1">{chat.lastMessage.text}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="w-2/3 flex flex-col bg-zinc-50">
            {activeChatId ? (
              <>
                <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between">
                  <h1 className="text-lg font-bold text-zinc-900">{receiverName}</h1>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg) => {
                    const isMe = msg.sender === user.name;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white text-zinc-900 border border-zinc-200 rounded-bl-sm"
                        }`}>
                          <p>{msg.text}</p>
                          <span className={`mt-1 block text-[10px] ${isMe ? "text-blue-200" : "text-zinc-400"}`}>{msg.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-zinc-200 bg-white p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-lg border border-zinc-300 bg-white text-zinc-900 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-zinc-400">
                <span className="text-6xl mb-4">💬</span>
                <p className="text-lg font-medium">Select a chat to start messaging</p>
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
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading Inbox...</div>}>
      <InboxContent />
    </Suspense>
  );
}