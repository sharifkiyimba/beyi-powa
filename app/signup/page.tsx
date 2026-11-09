"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    location: "",
    role: "customer" as "customer" | "seller",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: form.fullName,
          phone: form.phone,
          location: form.location,
          role: form.role,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // If signup successful, redirect to dashboard
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-zinc-900 p-12 text-white">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold">
            BP
          </div>
          <span className="text-xl font-bold tracking-tight">BEYI POWA</span>
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            The trusted marketplace for genuine phones in Kampala.
          </h1>
          <p className="mt-6 text-lg text-zinc-400">
            Join thousands of buyers and verified sellers. No fakes. No stolen devices. Just real business.
          </p>
        </div>
        <div className="text-sm text-zinc-500">
          &copy; 2026 BEYI POWA. All rights reserved.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                BP
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900">BEYI POWA</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Create an account</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Log in
              </Link>
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="radio"
                    id="role-customer"
                    name="role"
                    value="customer"
                    checked={form.role === "customer"}
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="role-customer"
                    className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-4 text-zinc-600 shadow-sm cursor-pointer transition-all hover:bg-zinc-50 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-checked:ring-1 peer-checked:ring-blue-600"
                  >
                    <span className="text-base font-bold flex items-center gap-2">
                      Buyer
                      <span className="hidden peer-checked:inline">✓</span>
                    </span>
                    <span className="mt-1 text-xs font-normal text-center opacity-80">
                      I want to buy phones
                    </span>
                  </label>
                </div>

                <div>
                  <input
                    type="radio"
                    id="role-seller"
                    name="role"
                    value="seller"
                    checked={form.role === "seller"}
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="role-seller"
                    className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-4 text-zinc-600 shadow-sm cursor-pointer transition-all hover:bg-zinc-50 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-checked:ring-1 peer-checked:ring-blue-600"
                  >
                    <span className="text-base font-bold flex items-center gap-2">
                      Seller
                      <span className="hidden peer-checked:inline">✓</span>
                    </span>
                    <span className="mt-1 text-xs font-normal text-center opacity-80">
                      I want to sell phones
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                required
                value={form.fullName}
                onChange={handleChange}
                className="block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  className="block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="+256 770 000 000"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  required
                  value={form.location}
                  onChange={handleChange}
                  className="block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="e.g., Ntinda"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900">
                Email address
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                className="block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={form.password}
                onChange={handleChange}
                className="block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full justify-center rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70 transition-all"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}