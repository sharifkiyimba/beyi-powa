"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/mockData";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    
    setTimeout(() => {
      // 1. Get all registered users (sellers/buyers)
      const allSellers = db.getAllSellers();
      const existingUser = allSellers.find((s: any) => s.email === email);

      if (existingUser) {
        // They are a real registered user! Log them in.
        db.loginUser(existingUser);
        router.push("/dashboard");
        return;
      }

      // 2. If they aren't found, reject them.
      setErrorMsg("Account not found. Please sign up first.");
      setLoading(false);
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
          <h1 className="text-4xl font-bold">Welcome back to the trusted phone marketplace.</h1>
        </div>
        <div className="text-sm text-zinc-500">&copy; 2026 BEYI POWA.</div>
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-zinc-900">Log in to your account</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Don&apos;t have an account? <Link href="/signup" className="font-semibold text-blue-600">Sign up</Link>
          </p>

          {errorMsg && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="you@example.com" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-2.5 outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-zinc-400" placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500">
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}