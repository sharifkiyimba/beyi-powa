"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/format";
import { AREAS } from "@/lib/config";
import type { Role } from "@/lib/types";
import { AuthShell } from "@/components/AuthShell";
import { ErrorBox, NoticeBox, inputClass, primaryButton } from "@/components/ui";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const [form, setForm] = useState({
    role: "buyer" as Role,
    name: "",
    email: "",
    password: "",
    shopName: "",
    location: "Kikuubo",
    phone: "",
  });

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const isSeller = form.role === "seller";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (form.password.length < 8) {
      setErrorMsg("Your password must be at least 8 characters.");
      return;
    }
    if (isSeller && !/^\+?[0-9\s-]{9,15}$/.test(form.phone.trim())) {
      setErrorMsg("Enter a valid phone number, for example 0772 123 456.");
      return;
    }

    setLoading(true);

    const { data, error } = await getSupabase().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        // The database trigger turns this into the user's profile.
        data: {
          role: form.role,
          full_name: form.name.trim(),
          shop_name: isSeller ? form.shopName.trim() : null,
          location: isSeller ? form.location : null,
          phone: isSeller ? form.phone.trim() : null,
        },
      },
    });

    if (error) {
      setErrorMsg(
        error.message.toLowerCase().includes("already registered")
          ? "That email already has an account. Try logging in."
          : error.message
      );
      setLoading(false);
      return;
    }

    // With email confirmation switched off, we are signed in straight away.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }
    setCheckEmail(true);
    setLoading(false);
  };

  if (checkEmail) {
    return (
      <AuthShell tagline="The trusted marketplace for genuine phones in Kampala.">
        <h2 className="text-3xl font-bold text-zinc-900">Check your email</h2>
        <div className="mt-4">
          <NoticeBox tone="green">
            We sent a confirmation link to <strong>{form.email}</strong>. Open it, then come back and log in.
          </NoticeBox>
        </div>
        <Link href="/login" className={`mt-6 block text-center ${primaryButton}`}>
          Go to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell tagline="The trusted marketplace for genuine phones in Kampala.">
      <h2 className="text-3xl font-bold text-zinc-900">Create an account</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          href={next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-blue-600"
        >
          Log in
        </Link>
      </p>

      <div className="mt-4">
        <ErrorBox message={errorMsg} />
      </div>

      <form onSubmit={handleSignup} className="mt-6 space-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-900">Account type</span>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "buyer", title: "Buyer", hint: "I want to buy" },
                { value: "seller", title: "Seller", hint: "I want to sell" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col items-center rounded-xl border p-4 ${
                  form.role === opt.value ? "border-blue-600 bg-blue-50" : "border-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={form.role === opt.value}
                  onChange={() => update({ role: opt.value })}
                  className="sr-only"
                />
                <span className="font-bold text-zinc-900">{opt.title}</span>
                <span className="mt-1 text-xs text-zinc-500">{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-900">Full name</label>
          <input id="name" type="text" required autoComplete="name" value={form.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} placeholder="John Doe" />
        </div>

        {isSeller && (
          <>
            <div>
              <label htmlFor="shop" className="mb-1 block text-sm font-medium text-zinc-900">Shop name</label>
              <input id="shop" type="text" required value={form.shopName} onChange={(e) => update({ shopName: e.target.value })} className={inputClass} placeholder="e.g. Sharif Phones" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="area" className="mb-1 block text-sm font-medium text-zinc-900">Where is your shop?</label>
                <select id="area" value={form.location} onChange={(e) => update({ location: e.target.value })} className={inputClass}>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-zinc-900">Phone / WhatsApp</label>
                <input id="phone" type="tel" required autoComplete="tel" value={form.phone} onChange={(e) => update({ phone: e.target.value })} className={inputClass} placeholder="0772 123 456" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-zinc-500">
              Your phone number is private. Only you and the BEYI POWA team can see it.
            </p>
          </>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-900">Email</label>
          <input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update({ email: e.target.value })} className={inputClass} placeholder="you@example.com" />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-900">Password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => update({ password: e.target.value })} className={inputClass} placeholder="At least 8 characters" />
        </div>

        <button type="submit" disabled={loading} className={`w-full py-3 ${primaryButton}`}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
