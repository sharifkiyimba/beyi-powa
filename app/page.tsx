"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/mockData";

export default function Home() {
  const [allPhones, setAllPhones] = useState<any[]>([]);
  const [filteredPhones, setFilteredPhones] = useState<any[]>([]);
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("All");

  useEffect(() => {
    const user = db.getUser();
    if (user && user.role === "seller") {
      const allSellers = db.getAllSellers();
      const record = allSellers.find((s: any) => s.id === user.id);
      if (record && record.verified) {
        setIsVerifiedSeller(true);
      }
    }

    const phones = db.getPhones();
    const allSellers = db.getAllSellers();

    // 1. Security: Filter out phones from unverified sellers
    const safePhones = phones.filter((phone) => {
      const sellerRecord = allSellers.find((s: any) => s.name === phone.seller);
      // If seller is in DB but unverified, hide it
      if (sellerRecord && !sellerRecord.verified) {
        return false; 
      }
      return true;
    });

    // 2. Sync the verified status for the badge
    const updatedPhones = safePhones.map((phone) => {
      const sellerRecord = allSellers.find((s: any) => s.name === phone.seller);
      return {
        ...phone,
        verified: sellerRecord ? sellerRecord.verified : phone.verified
      };
    });

    setAllPhones(updatedPhones);
    setFilteredPhones(updatedPhones);
  }, []);

  useEffect(() => {
    let result = allPhones;

    if (searchQuery) {
      result = result.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.brand.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedBrand !== "All") {
      result = result.filter(p => p.brand === selectedBrand);
    }

    if (selectedCondition !== "All") {
      result = result.filter(p => p.condition === selectedCondition);
    }

    setFilteredPhones(result);
  }, [searchQuery, selectedBrand, selectedCondition, allPhones]);

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
            <span className="text-lg font-bold text-zinc-900">BEYI POWA</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">Log in</Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Sign up</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Find a genuine phone in Kampala</h1>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-600">
              <input 
                type="text" 
                placeholder="Search iPhone, Samsung..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-black px-3 py-2 text-sm outline-none placeholder:text-zinc-400" 
              />
            </div>
            
            <select 
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Brands</option>
              <option value="Apple">Apple</option>
              <option value="Samsung">Samsung</option>
              <option value="Google">Google</option>
              <option value="Tecno">Tecno</option>
            </select>

            <select 
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">Any Condition</option>
              <option value="New">New</option>
              <option value="Clean piece">Clean piece</option>
              <option value="Has issues">Has issues</option>
            </select>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">
            {filteredPhones.length} {filteredPhones.length === 1 ? 'Listing' : 'Listings'} Found
          </h2>
        </div>
        
        {filteredPhones.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
            <span className="text-4xl">🔍</span>
            <h3 className="mt-4 text-lg font-bold text-zinc-900">No phones found</h3>
            <p className="mt-1 text-sm text-zinc-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPhones.map((phone) => (
              <div key={phone.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  <img src={phone.image} alt={phone.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-zinc-900">{phone.title}</h3>
                    <div className="text-right">
                      <span className="whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 block">
                        UGX {phone.price.toLocaleString()}
                      </span>
                      {isVerifiedSeller && phone.wholesalePrice && (
                        <span className="mt-1 block text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-md">
                          Wholesale: UGX {phone.wholesalePrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">{phone.condition}</span>
                    <span>•</span>
                    <span>{phone.location}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <span className="font-semibold">{phone.seller}</span>
                      {phone.verified && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">✓</span>
                      )}
                    </div>
                    <Link href={`/listing/${phone.id}`} className="text-xs font-semibold text-blue-600 hover:underline">
                      View details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}