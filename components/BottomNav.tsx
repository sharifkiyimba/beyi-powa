"use client";

import Link from "next/link";
import { isActiveSeller } from "@/lib/format";
import { useUnreadChats } from "@/lib/unread";
import { useAuth } from "./AuthProvider";
import { Icon, type IconName } from "./Icon";

export type TabKey = "shop" | "chats" | "sell" | "me";

/**
 * The thumb-reach navigation bar for phones. Each page that is a main screen puts this at
 * the end of its page and says which tab it belongs to. It is hidden on laptops, where the
 * top bar has the links, and for visitors who are not signed in.
 */
export function BottomNav({ active }: { active: TabKey }) {
  const { user, profile } = useAuth();
  const unread = useUnreadChats(user?.id);
  if (!user) return null;

  const isSeller = profile?.role === "seller";
  const canPost = isActiveSeller(profile);

  const tabs: { key: TabKey; label: string; href: string; icon: IconName }[] = [
    { key: "shop", label: "Shop", href: "/", icon: "shop" },
    { key: "chats", label: "Chats", href: "/inbox", icon: "chat" },
    ...(isSeller
      ? [{ key: "sell" as const, label: "Sell", href: canPost ? "/dashboard/add-listing" : "/dashboard", icon: "plus" as const }]
      : []),
    { key: "me", label: "Me", href: "/dashboard", icon: "user" },
  ];

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-30 mt-auto border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-end justify-around">
        {tabs.map((t) => {
          const on = t.key === active;
          if (t.key === "sell") {
            return (
              <li key={t.key} className="flex-1">
                <Link href={t.href} className="flex flex-col items-center pb-1.5 text-[11px] font-semibold text-blue-600">
                  <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-white">
                    <Icon name="plus" className="h-6 w-6" />
                  </span>
                  <span className="mt-0.5">Sell</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={t.key} className="flex-1">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? "text-blue-600" : "text-zinc-500"}`}
              >
                <span className="relative">
                  <Icon name={t.icon} className="h-6 w-6" />
                  {t.key === "chats" && unread > 0 && (
                    <span
                      aria-label={`${unread} chats with new messages`}
                      className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
