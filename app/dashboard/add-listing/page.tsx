"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/mockData";

export default function AddListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    brand: "Apple",
    condition: "Clean piece",
    price: "",
    wholesalePrice: "",
    location: "",
    description: "",
  });

  useEffect(() => {
    const user = db.getUser();
    if (!user || user.role !== "seller") {
      router.push("/dashboard");
    } else {
      setRole(user.role);
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const user = db.getUser();
      
      const allSellers = db.getAllSellers();
      const mySellerRecord = allSellers.find((s: any) => s.email === user?.email);
      const isActuallyVerified = mySellerRecord?.verified || false;

      db.addPhone({
        id: Date.now().toString(),
        title: form.title,
        brand: form.brand,
        condition: form.condition,
        price: Number(form.price),
        wholesalePrice: Number(form.wholesalePrice),
        location: form.location,
        seller: user?.name || "My Shop",
        verified: isActuallyVerified,
        image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=400",
        description: form.description
      });

      router.push("/dashboard");
    }, 1000);
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            &larr; Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">BP</div>
            <span className="font-bold text-zinc-900">BEYI POWA</span>
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900">Add a New Phone</h1>
          <p className="mt-1 text-sm text-zinc-500">List a phone for buyers in Kampala to see.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Phone Title (e.g., iPhone 13 Pro)</label>
              <input type="text" name="title" required value={form.title} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="iPhone 13 Pro Max" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">Brand</label>
                <select name="brand" value={form.brand} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600">
                  <option value="Apple">Apple</option>
                  <option value="Samsung">Samsung</option>
                  <option value="Tecno">Tecno</option>
                  <option value="Infinix">Infinix</option>
                  <option value="Google">Google</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">Condition</label>
                <select name="condition" value={form.condition} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600">
                  <option value="New">New</option>
                  <option value="Clean piece">Clean piece</option>
                  <option value="Has issues">Has issues</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">Retail Price (UGX)</label>
                <input type="number" name="price" required min="1000" value={form.price} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="1500000" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">Wholesale Price (UGX)</label>
                <input type="number" name="wholesalePrice" required min="1000" value={form.wholesalePrice} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="1300000" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Location</label>
              <input type="text" name="location" required value={form.location} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="e.g., Ntinda" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Description (Optional)</label>
              <textarea name="description" rows={3} value={form.description} onChange={handleChange} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="Any extra details, storage size, battery health..."></textarea>
            </div>

            <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
              <span className="text-3xl">📸</span>
              <p className="mt-2 text-sm font-medium text-zinc-900">Upload Photos</p>
              <p className="text-xs text-zinc-500">Tap to select images (Coming soon)</p>
            </div>

            <button type="submit" disabled={loading} className="mt-4 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-70 transition-all">
              {loading ? "Publishing..." : "Publish Listing"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}