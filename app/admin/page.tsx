"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/mockData";

export default function AdminPage() {
  const [sellers, setSellers] = useState<any[]>([]);

  const loadSellers = () => {
    setSellers(db.getAllSellers());
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const handleVerify = (email: string) => {
    db.verifySeller(email);
    loadSellers(); // Refresh the list
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-12">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-sm font-bold">A</div>
            <span className="text-lg font-bold">BEYI POWA ADMIN</span>
          </div>
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white">
            Back to Site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Seller Verification</h1>
          <p className="mt-2 text-zinc-400">
            Manage your sellers. Verify their IDs, collect the UGX 7,000 fee, and give them the blue tick.
          </p>
        </div>

        {sellers.length === 0 ? (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-8 text-center text-zinc-400">
            No sellers have registered yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-700 bg-zinc-900/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Seller Name</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {sellers.map((seller, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 font-medium text-white">{seller.name}</td>
                    <td className="px-6 py-4 text-zinc-400">{seller.email}</td>
                    <td className="px-6 py-4">
                      {seller.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-900/50 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-800">
                          ✓ Verified & Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!seller.verified ? (
                        <button
                          onClick={() => handleVerify(seller.email)}
                          className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                        >
                          Verify & Mark Paid
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}