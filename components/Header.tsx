"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { APP_NAME } from "@/lib/config";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
      <span className="text-lg font-bold text-zinc-900">{APP_NAME}</span>
    </Link>
  );
}

export function Header({ sticky = false }: { sticky?: boolean }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className={`border-b border-zinc-200 bg-white ${sticky ? "sticky top-0 z-10" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-3 text-sm font-medium sm:gap-4">
          {loading ? null : user ? (
            <>
              {profile?.role === "seller" && (
                <Link href="/communities" className="text-zinc-600 hover:text-zinc-900">Communities</Link>
              )}
              <Link href="/inbox" className="text-zinc-600 hover:text-zinc-900">Inbox</Link>
              <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">Dashboard</Link>
              {profile?.is_admin && (
                <Link href="/admin" className="text-red-600 hover:text-red-700">Admin</Link>
              )}
              <button onClick={handleSignOut} className="text-zinc-500 hover:text-red-600">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-600 hover:text-zinc-900">Log in</Link>
              <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
