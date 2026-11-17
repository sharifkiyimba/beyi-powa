"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthState {
  /** The signed-in user, or null. */
  user: User | null;
  /** Their BEYI POWA profile (role, verification, etc.), or null. */
  profile: Profile | null;
  /** True until we know whether someone is signed in. */
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);

  // 1. Know who is signed in, and stay in sync when they sign in or out.
  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setSessionChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionChecked(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;

  const loadProfile = useCallback(async (id: string) => {
    const { data } = await getSupabase().from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setProfileLoadedFor(id);
  }, []);

  // 2. Load their profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSupabase()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as Profile | null) ?? null);
        setProfileLoadedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setProfile(null);
    setProfileLoadedFor(null);
  }, []);

  const loading = !sessionChecked || (userId !== null && profileLoadedFor !== userId);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile: userId && profileLoadedFor === userId ? profile : null,
      loading,
      refreshProfile,
      signOut,
    }),
    [user, userId, profile, profileLoadedFor, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
