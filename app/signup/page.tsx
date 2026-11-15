"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, generateId } from "@/mockData";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ role: "customer", name: "", email: "", password: "" });

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    setTimeout(() => {
      const newUser = {
        id: generateId(), // <-- Give them a unique ID
        name: form.name,
        email: form.email,
        role: form.role,
        verified: false,
        feePaid: false
      };

      db.loginUser(newUser);
      
      if (form.role === "seller") {
        db.registerSeller(newUser);
      }

      router.push("/dashboard");
    }, 1000);
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-zinc-900 p-12 text-white">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold">BP</div>
          <span className="text-xl font-bold">BEYI POWA</span>
        </Link>
        <div>
          <h1 className="text-4xl font-bold">The trusted marketplace for genuine phones in Kampala.</h1>
        </div>
        <div className="text-sm text-zinc-500">&copy; 2026 BEYI POWA.</div>
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-zinc-900">Create an account</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Already have an account? <Link href="/login" className="font-semibold text-blue-600">Log in</Link>
          </p>

          <form onSubmit={handleSignup} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex flex-col items-center rounded-xl border p-4 cursor-pointer ${form.role === "customer" ? "border-blue-600 bg-blue-50" : "border-zinc-200"}`}>
                  <input type="radio" name="role" value="customer" checked={form.role === "customer"} onChange={() => setForm({...form, role: "customer"})} className="sr-only" />
                  <span className="font-bold text-zinc-900">Buyer</span>
                  <span className="text-xs text-zinc-500 mt-1">I want to buy</span>
                </label>
                <label className={`flex flex-col items-center rounded-xl border p-4 cursor-pointer ${form.role === "seller" ? "border-blue-600 bg-blue-50" : "border-zinc-200"}`}>
                  <input type="radio" name="role" value="seller" checked={form.role === "seller"} onChange={() => setForm({...form, role: "seller"})} className="sr-only" />
                  <span className="font-bold text-zinc-900">Seller</span>
                  <span className="text-xs text-zinc-500 mt-1">I want to sell</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Full Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="John Doe" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="you@example.com" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Password</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}