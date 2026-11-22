"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { LISTING_SELECT } from "@/lib/listings";
import { BRANDS } from "@/lib/config";
import { CONDITION_LABEL } from "@/lib/format";
import type { Condition, ListingWithRelations } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { ErrorBox, PageLoading } from "@/components/ui";

export default function Home() {
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState<"All" | Condition>("All");

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("listings")
      .select(LISTING_SELECT)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError("Could not load phones. Check your connection and try again.");
        else setListings((data ?? []) as unknown as ListingWithRelations[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q) && !l.brand.toLowerCase().includes(q)) return false;
      if (selectedBrand !== "All" && l.brand !== selectedBrand) return false;
      if (selectedCondition !== "All" && l.condition !== selectedCondition) return false;
      return true;
    });
  }, [listings, searchQuery, selectedBrand, selectedCondition]);

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-zinc-50">
      <Header sticky />

      <section className="border-b border-zinc-200 bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Find a genuine phone in Kampala</h1>
          <p className="mt-2 text-sm text-zinc-500">Verified sellers. Honest conditions. Chat directly.</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-600">
              <input
                type="search"
                aria-label="Search phones"
                placeholder="Search iPhone, Samsung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-zinc-400"
              />
            </div>

            <select
              aria-label="Brand"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Brands</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              aria-label="Condition"
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value as "All" | Condition)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">Any Condition</option>
              {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
                <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <ErrorBox message={error} />

        {loading ? (
          <PageLoading text="Loading phones..." />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">
                {filtered.length} {filtered.length === 1 ? "Listing" : "Listings"} Found
              </h2>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                  <Icon name="search" className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-zinc-900">
                  {listings.length === 0 ? "No phones listed yet" : "No phones found"}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {listings.length === 0
                    ? "Verified sellers are getting set up. Check back soon."
                    : "Try adjusting your search or filters."}
                </p>
                {listings.length === 0 && (
                  <Link href="/signup" className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                    Become a seller
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <BottomNav active="shop" />
    </main>
  );
}
