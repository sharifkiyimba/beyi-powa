"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/mockData";

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const user = db.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    setName(user.name);
    setRole(user.role);

    // If they are a seller, check the Admin database for their REAL status
    if (user.role === "seller") {
      const allSellers = db.getAllSellers();
      const realRecord = allSellers.find((s: any) => s.email === user.email);
      
      if (realRecord) {
        setIsVerified(realRecord.verified);
        // Keep the local user in sync with the admin database
        db.loginUser({ ...user, verified: realRecord.verified });
      }
    }
  }, [router]);

  const handleLogout = () => {
    db.logoutUser();
    router.push("/");
  };

  if (!name) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
            <span className="text-lg font-bold text-zinc-900">BEYI POWA</span>
          </Link>
          <button onClick={handleLogout} className="text-sm font-medium text-zinc-600 hover:text-red-600">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
            Welcome, {name}!
            {role === "seller" && isVerified && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">✓</span>
                Verified Seller
              </span>
            )}
          </h1>
          <p className="mt-2 text-zinc-600">
            You are logged in as a <span className="font-semibold capitalize text-blue-600">{role}</span>.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Quick Actions</h2>
            <div className="mt-4 space-y-3">
              {role === "seller" ? (
                <Link href="/dashboard/add-listing" className="block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
                  + Add New Phone Listing
                </Link>
              ) : (
                <Link href="/" className="block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
                  Browse Phones
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Messages</h2>
            <p className="mt-2 text-sm text-zinc-500">You have new messages from buyers.</p>
            <Link href="/inbox" className="mt-4 block w-full rounded-lg border border-zinc-300 bg-white py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
              Go to Inbox
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}