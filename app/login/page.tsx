"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/format";
import { AuthShell } from "@/components/AuthShell";
import { ErrorBox, inputClass, primaryButton } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMsg(
        error.message.toLowerCase().includes("invalid login")
          ? "Wrong email or password."
          : error.message.toLowerCase().includes("not confirmed")
            ? "Please confirm your email first. Check your inbox."
            : "Could not log in. Please try again."
      );
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <AuthShell tagline="Welcome back to the trusted phone marketplace.">
      <h2 className="text-3xl font-bold text-zinc-900">Log in to your account</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link
          href={next === "/dashboard" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-blue-600"
        >
          Sign up
        </Link>
      </p>

      <div className="mt-4">
        <ErrorBox message={errorMsg} />
      </div>

      <form onSubmit={handleLogin} className="mt-6 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-900">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-900">Password</label>
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
        </div>

        <button type="submit" disabled={loading} className={`w-full py-3 ${primaryButton}`}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
