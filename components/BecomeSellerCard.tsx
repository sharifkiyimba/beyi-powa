"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { AREAS } from "@/lib/config";
import { useAuth } from "./AuthProvider";
import { Choice } from "./Choice";
import { Icon } from "./Icon";
import { ErrorBox, inputClass, primaryButton, secondaryButton } from "./ui";

/** Lets a buyer turn their account into a seller account. They still need the blue tick before posting. */
export function BecomeSellerCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [shopName, setShopName] = useState("");
  const [location, setLocation] = useState<string>(profile?.location ?? AREAS[0]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (shopName.trim().length < 2) return setError("Enter your shop or business name.");
    if (digits.length < 9 || digits.length > 15) return setError("Enter a phone number we can reach you on.");

    setBusy(true);
    const supabase = getSupabase();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "seller", shop_name: shopName.trim(), location })
      .eq("id", user.id);
    if (profileError) {
      setError("Could not upgrade your account. Please check your connection and try again.");
      setBusy(false);
      return;
    }
    // The number is private: only you and the admin can see it. It is used when you get verified.
    await supabase.from("seller_private").upsert({ user_id: user.id, phone: phone.trim() }, { onConflict: "user_id" });
    await refreshProfile();
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <Icon name="shop" className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Sell your phones</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            Reach buyers across Kampala and trade with other sellers. Post phones once you have the blue tick.
          </p>
        </div>
      </div>

      {!open ? (
        <button onClick={() => setOpen(true)} className={`mt-4 w-full py-3 ${primaryButton}`}>
          Become a seller
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="bs-shop" className="mb-1 block text-sm font-medium text-zinc-900">Shop or business name</label>
            <input id="bs-shop" type="text" required maxLength={60} value={shopName} onChange={(e) => setShopName(e.target.value)} className={inputClass} placeholder="Aisha Phones" />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-900">Where is your shop?</span>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <Choice key={a} active={location === a} onClick={() => setLocation(a)}>
                  {a}
                </Choice>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="bs-phone" className="mb-1 block text-sm font-medium text-zinc-900">Phone number</label>
            <input id="bs-phone" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="0771 234 567" />
            <p className="mt-1 text-xs text-zinc-500">Private. Only the BEYI POWA admin sees it, to verify you.</p>
          </div>

          <ErrorBox message={error} />

          <div className="flex gap-3">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className={`py-3 ${secondaryButton}`}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`flex-1 py-3 ${primaryButton}`}>
              {busy ? "Upgrading..." : "Create seller account"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
