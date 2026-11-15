"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/mockData";

function ListingContent() {
  const params = useParams();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);

  useEffect(() => {
    const allPhones = db.getPhones();
    const foundPhone = allPhones.find((p: any) => p.id === params.id);

    if (foundPhone) {
      setListing(foundPhone);
    }
    setLoading(false);

    const user = db.getUser();
    if (user && user.role === "seller") {
      const allSellers = db.getAllSellers();
      const record = allSellers.find((s: any) => s.email === user.email);
      if (record && record.verified) {
        setIsVerifiedSeller(true);
      }
    }
  }, [params.id]);

  const handleMessageSeller = () => {
    const user = db.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Create a unique chat ID: e.g., "BuyerName-SellerName-Listing123"
    // Sort the names so the ID is always the same regardless of who clicks first
    const names = [user.name, listing.seller].sort();
    const chatId = `${names[0]}-${names[1]}-${listing.id}`;
    
    // Redirect to the inbox with this chat open
    window.location.href = `/inbox?chat=${chatId}&receiver=${listing.seller}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50">
        <h1 className="text-2xl font-bold text-zinc-900">Phone not found</h1>
        <p className="mt-2 text-zinc-500">This listing may have been removed or sold.</p>
        <Link href="/" className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
            <span className="text-lg font-bold text-zinc-900">BEYI POWA</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            &larr; Back to search
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="aspect-square w-full bg-zinc-100">
              <img 
                src={listing.image} 
                alt={listing.title} 
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                {listing.condition}
              </span>
              <span className="text-xs font-medium text-zinc-500">{listing.brand}</span>
            </div>

            <h1 className="text-3xl font-bold text-zinc-900">{listing.title}</h1>
            <p className="mt-2 text-2xl font-bold text-blue-600">UGX {listing.price.toLocaleString()}</p>
            
            {isVerifiedSeller && listing.wholesalePrice && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-800">
                  Wholesale Price: UGX {listing.wholesalePrice.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">Only visible to verified sellers.</p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm text-zinc-600">
              <span className="font-medium text-zinc-900">Location:</span>
              <span>{listing.location}</span>
            </div>

            <div className="mt-6 border-t border-zinc-200 pt-6">
              <h2 className="text-lg font-semibold text-zinc-900">Description</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {listing.description || "No description provided by the seller."}
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-500">Sold by</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Link href={`/seller/${encodeURIComponent(listing.seller)}`} className="text-base font-bold text-zinc-900 hover:text-blue-600 hover:underline">
                      {listing.seller}
                    </Link>
                    {listing.verified && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">✓</span>
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/seller/${encodeURIComponent(listing.seller)}`} className="text-sm font-semibold text-blue-600 hover:underline">
                  View Profile
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button 
                onClick={handleMessageSeller}
                className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Message Seller
              </button>
              <button className="flex-1 rounded-lg border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50">
                Call Seller
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ListingDetailsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">Loading details...</p>
      </div>
    }>
      <ListingContent />
    </Suspense>
  );
}