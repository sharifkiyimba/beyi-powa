"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { LISTING_SELECT } from "@/lib/listings";
import { AREAS, BRANDS } from "@/lib/config";
import { CONDITION_LABEL } from "@/lib/format";
import type { Condition, ListingWithRelations } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { BottomNav } from "@/components/BottomNav";
import { BottomSheet } from "@/components/BottomSheet";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { ErrorBox } from "@/components/ui";

type Sort = "newest" | "price_low" | "price_high";

const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest first",
  price_low: "Price: low to high",
  price_high: "Price: high to low",
};

/** A pill button used for single-choice options. */
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium ${
        active ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function SheetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-sm font-semibold text-zinc-900">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [brand, setBrand] = useState("All");
  const [condition, setCondition] = useState<"All" | Condition>("All");
  const [area, setArea] = useState("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("listings")
      .select(LISTING_SELECT)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError("Could not load phones. Check your connection and try again.");
        else setListings((data ?? []) as unknown as ListingWithRelations[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = listings.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q) && !l.brand.toLowerCase().includes(q)) return false;
      if (brand !== "All" && l.brand !== brand) return false;
      if (condition !== "All" && l.condition !== condition) return false;
      if (area !== "All" && l.location !== area) return false;
      return true;
    });
    if (sort === "price_low") list.sort((a, b) => a.retail_price - b.retail_price);
    if (sort === "price_high") list.sort((a, b) => b.retail_price - a.retail_price);
    return list;
  }, [listings, searchQuery, brand, condition, area, sort]);

  const activeFilters = (brand !== "All" ? 1 : 0) + (condition !== "All" ? 1 : 0) + (area !== "All" ? 1 : 0) + (sort !== "newest" ? 1 : 0);
  const anyFilter = activeFilters > 0 || searchQuery.trim() !== "";

  const reset = () => {
    setBrand("All");
    setCondition("All");
    setArea("All");
    setSort("newest");
  };

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-zinc-50">
      <Header sticky />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 pt-4">
        {/* Search + filters */}
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 shadow-sm focus-within:ring-2 focus-within:ring-blue-600">
            <Icon name="search" className="h-5 w-5 shrink-0 text-zinc-400" />
            <input
              type="search"
              aria-label="Search phones"
              placeholder="Search iPhone, Samsung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </label>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Filters"
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <Icon name="filter" className="h-5 w-5" />
            {activeFilters > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Quick brand chips */}
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["All", ...BRANDS.filter((b) => b !== "Other")].map((b) => (
            <Choice key={b} active={brand === b} onClick={() => setBrand(b)}>
              {b}
            </Choice>
          ))}
        </div>

        {!authLoading && !user && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-900">Genuine phones from verified Kampala sellers. Chat inside the app.</p>
            <Link href="/signup" className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Sign up
            </Link>
          </div>
        )}

        <div className="mt-4">
          <ErrorBox message={error} />
        </div>

        {loading ? (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading phones">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="aspect-square bg-zinc-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-2/3 rounded bg-zinc-200" />
                  <div className="h-3 w-full rounded bg-zinc-100" />
                  <div className="h-3 w-1/2 rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-3 mt-2 flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {filtered.length} {filtered.length === 1 ? "phone" : "phones"}
              </p>
              {anyFilter && (
                <button
                  onClick={() => {
                    reset();
                    setSearchQuery("");
                  }}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                  <Icon name="search" className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-zinc-900">
                  {listings.length === 0 ? "No phones listed yet" : "No phones found"}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {listings.length === 0
                    ? "Verified sellers are getting set up. Check back soon."
                    : "Try a different search or clear the filters."}
                </p>
                {listings.length === 0 && (
                  <Link href="/signup" className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                    Become a seller
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {filtered.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Reset
            </button>
            <button
              onClick={() => setSheetOpen(false)}
              className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Show {filtered.length} {filtered.length === 1 ? "phone" : "phones"}
            </button>
          </div>
        }
      >
        <SheetGroup title="Condition">
          <Choice active={condition === "All"} onClick={() => setCondition("All")}>
            Any
          </Choice>
          {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
            <Choice key={c} active={condition === c} onClick={() => setCondition(c)}>
              {CONDITION_LABEL[c]}
            </Choice>
          ))}
        </SheetGroup>

        <SheetGroup title="Brand">
          {["All", ...BRANDS].map((b) => (
            <Choice key={b} active={brand === b} onClick={() => setBrand(b)}>
              {b}
            </Choice>
          ))}
        </SheetGroup>

        <SheetGroup title="Area">
          {["All", ...AREAS].map((a) => (
            <Choice key={a} active={area === a} onClick={() => setArea(a)}>
              {a}
            </Choice>
          ))}
        </SheetGroup>

        <SheetGroup title="Sort by">
          {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
            <Choice key={s} active={sort === s} onClick={() => setSort(s)}>
              {SORT_LABEL[s]}
            </Choice>
          ))}
        </SheetGroup>
      </BottomSheet>

      <BottomNav active="shop" />
    </main>
  );
}
