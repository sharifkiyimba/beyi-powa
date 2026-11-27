"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { BottomSheet } from "./BottomSheet";
import { ErrorBox, NoticeBox, inputClass, primaryButton } from "./ui";

const REASONS = [
  "Fake or not a genuine phone",
  "Suspected stolen phone",
  "Price or details are wrong",
  "Already sold",
  "Seller is asking for advance payment",
  "Something else",
];

/** A panel for reporting one phone to the BEYI POWA team. */
export function ReportListingSheet({
  open,
  onClose,
  listing,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  listing: { id: string; seller_id: string; title: string };
  userId: string;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: insertError } = await getSupabase().from("reports").insert({
      reporter_id: userId,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (insertError) {
      setError("Could not send your report. Check your connection and try again.");
      return;
    }
    setDone(true);
  };

  const close = () => {
    onClose();
    // Reset for next time, after the panel has closed.
    setTimeout(() => {
      setDone(false);
      setDetails("");
      setError("");
    }, 200);
  };

  return (
    <BottomSheet open={open} onClose={close} title="Report this phone">
      {done ? (
        <div className="space-y-4 pb-2">
          <NoticeBox tone="green">Thank you. The BEYI POWA team will look at this phone.</NoticeBox>
          <button onClick={close} className={`w-full py-3 ${primaryButton}`}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 pb-2">
          <p className="text-sm text-zinc-500">{listing.title}</p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Reason</legend>
            {REASONS.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                  reason === r ? "border-blue-600 bg-blue-50" : "border-zinc-200 bg-white"
                }`}
              >
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-blue-600" />
                {r}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="report-details" className="mb-1 block text-sm font-medium text-zinc-900">More details (optional)</label>
            <textarea id="report-details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} className={`${inputClass} text-base`} />
          </div>
          <ErrorBox message={error} />
          <button type="submit" disabled={busy} className={`w-full py-3 ${primaryButton}`}>
            {busy ? "Sending..." : "Send report"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
