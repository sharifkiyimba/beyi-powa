"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { ACTIVATION_FEE_UGX, ADMIN_WHATSAPP, FREE_FOUNDING_SELLERS, MONTHLY_FEE_UGX } from "@/lib/config";
import { formatUGX, sellerName } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { ErrorBox, NoticeBox, inputClass, primaryButton } from "./ui";

type RequestRow = { id: string; status: "pending" | "approved" | "rejected"; created_at: string };

export function whatsappLink(message: string): string | null {
  return ADMIN_WHATSAPP ? `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}` : null;
}

/** Shown to sellers who do not have a valid blue tick: send an ID, then pay on WhatsApp. */
export function VerificationCard({ profile, renewal = false }: { profile: Profile; renewal?: boolean }) {
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [checked, setChecked] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRequest = useCallback(async () => {
    const { data } = await getSupabase()
      .from("verification_requests")
      .select("id, status, created_at")
      .eq("seller_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1);
    setRequest(((data ?? [])[0] as RequestRow | undefined) ?? null);
    setChecked(true);
  }, [profile.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequest();
  }, [loadRequest]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Add a clear photo of your national ID or driving permit.");
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabase();
      const blob = await compressImage(file, { maxDim: 1600, targetBytes: 450_000 });
      const path = `${profile.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("id-documents")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("verification_requests").insert({
        seller_id: profile.id,
        id_document_path: path,
        note: note.trim() || null,
      });
      if (insertError) throw insertError;

      setFile(null);
      setNote("");
      await loadRequest();
    } catch (err) {
      setError(err instanceof Error ? `Could not send your ID. ${err.message}` : "Could not send your ID. Please try again.");
    }
    setBusy(false);
  };

  const wa = whatsappLink(
    `Hello, I want to ${renewal ? "renew" : "activate"} my BEYI POWA seller account.\nName: ${profile.full_name}\nShop: ${sellerName(profile)}`
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">
        {renewal ? "Renew your blue tick" : "Get your blue tick"}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        {renewal
          ? "Your verification has expired, so your phones are hidden from buyers. Renew to bring them back."
          : "Verified sellers can post phones, see wholesale prices and join communities. Buyers trust the blue tick."}
      </p>

      <ol className="mt-4 space-y-2 text-sm text-zinc-700">
        {!renewal && <li><strong>1.</strong> Upload a clear photo of your national ID or driving permit below.</li>}
        <li>
          <strong>{renewal ? "1" : "2"}.</strong> Pay by Mobile Money on WhatsApp:{" "}
          {renewal
            ? `${formatUGX(MONTHLY_FEE_UGX)} per month.`
            : `${formatUGX(ACTIVATION_FEE_UGX)} to activate, then ${formatUGX(MONTHLY_FEE_UGX)} per month. Free for the first ${FREE_FOUNDING_SELLERS} sellers.`}
        </li>
        <li><strong>{renewal ? "2" : "3"}.</strong> We check and switch on your blue tick, usually within a day.</li>
      </ol>

      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-block bg-green-600 hover:bg-green-700 ${primaryButton}`}>
          Message us on WhatsApp
        </a>
      ) : (
        <p className="mt-4 text-xs text-zinc-400">(WhatsApp link not set up yet.)</p>
      )}

      {!renewal && checked && (
        <div className="mt-6 border-t border-zinc-200 pt-6">
          {request?.status === "pending" ? (
            <NoticeBox tone="amber">
              Your ID was received and is waiting for review. Send your payment on WhatsApp to finish.
            </NoticeBox>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {request?.status === "rejected" && (
                <NoticeBox tone="amber">Your last ID could not be accepted. Please upload a clearer photo.</NoticeBox>
              )}
              <div>
                <label htmlFor="id-photo" className="mb-1 block text-sm font-medium text-zinc-900">ID photo</label>
                <input
                  id="id-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
                />
                <p className="mt-1 text-xs text-zinc-500">Private. Only the BEYI POWA team can see it.</p>
              </div>
              <input
                type="text"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Shop address or landmark (optional)"
                className={inputClass}
                aria-label="Shop address or landmark"
              />
              <ErrorBox message={error} />
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? "Sending..." : "Send my ID"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
