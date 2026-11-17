"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { formatDate, sellerName, sellerStatus, type SellerStatus } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { ErrorBox, PageLoading } from "@/components/ui";

type RequestRow = {
  id: string;
  seller_id: string;
  id_document_path: string;
  note: string | null;
  created_at: string;
  seller: { full_name: string; shop_name: string | null; location: string | null } | null;
};

type ReportRow = {
  id: string;
  seller_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  reporter: { full_name: string } | null;
  seller: { full_name: string; shop_name: string | null } | null;
};

const STATUS_STYLE: Record<SellerStatus, { label: string; cls: string }> = {
  active: { label: "✓ Verified", cls: "bg-blue-900/50 text-blue-400 border-blue-800" },
  unverified: { label: "Not verified", cls: "bg-zinc-700/50 text-zinc-300 border-zinc-600" },
  expired: { label: "Expired", cls: "bg-amber-900/50 text-amber-400 border-amber-800" },
  suspended: { label: "Suspended", cls: "bg-red-900/50 text-red-400 border-red-800" },
};

const DURATIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "free", label: "Free founding seller (no expiry)" },
];

export default function AdminPage() {
  const { profile, loading } = useAuth();
  const isAdmin = Boolean(profile?.is_admin);

  const [sellers, setSellers] = useState<Profile[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [duration, setDuration] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [sellersRes, phonesRes, requestsRes, reportsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "seller").order("created_at", { ascending: false }),
      supabase.from("seller_private").select("user_id, phone"),
      supabase
        .from("verification_requests")
        .select("id, seller_id, id_document_path, note, created_at, seller:profiles!seller_id (full_name, shop_name, location)")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("reports")
        .select("id, seller_id, reason, details, created_at, reporter:profiles!reporter_id (full_name), seller:profiles!seller_id (full_name, shop_name)")
        .eq("status", "open")
        .order("created_at", { ascending: true }),
    ]);

    setSellers((sellersRes.data ?? []) as Profile[]);
    setPhones(
      Object.fromEntries(((phonesRes.data ?? []) as { user_id: string; phone: string }[]).map((p) => [p.user_id, p.phone]))
    );
    setRequests((requestsRes.data ?? []) as unknown as RequestRow[]);
    setReports((reportsRes.data ?? []) as unknown as ReportRow[]);
    setDataLoaded(true);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [isAdmin, load]);

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    setError("");
    const { error: actionError } = await action();
    if (actionError) setError(actionError.message);
    await load();
  };

  const approve = (sellerId: string) => {
    const choice = duration[sellerId] ?? "1";
    return run(() =>
      getSupabase().rpc("approve_seller", {
        p_seller: sellerId,
        p_months: choice === "free" ? null : Number(choice),
      })
    );
  };

  const setSuspended = (sellerId: string, suspended: boolean) =>
    run(() => getSupabase().from("profiles").update({ suspended }).eq("id", sellerId));

  const rejectRequest = (requestId: string) =>
    run(() => getSupabase().from("verification_requests").update({ status: "rejected" }).eq("id", requestId));

  const resolveReport = (reportId: string, status: "reviewed" | "dismissed") =>
    run(() => getSupabase().from("reports").update({ status }).eq("id", reportId));

  const viewId = async (path: string) => {
    // Open the tab first so phone browsers do not block the pop-up.
    const tab = window.open("", "_blank");
    const { data, error: signError } = await getSupabase().storage.from("id-documents").createSignedUrl(path, 300);
    if (signError || !data) {
      tab?.close();
      setError("Could not open that ID photo.");
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white">
        <PageLoading />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4 text-center text-white">
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="mt-2 text-zinc-400">This page is only for the BEYI POWA team.</p>
        <Link href="/" className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold">Back to site</Link>
      </div>
    );
  }

  const selectCls = "rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-white";
  const btn = "rounded px-3 py-1.5 text-xs font-semibold text-white";

  return (
    <div className="min-h-screen bg-zinc-900 pb-16 text-white">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-sm font-bold">A</div>
            <span className="text-lg font-bold">BEYI POWA ADMIN</span>
          </div>
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white">Back to site</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <ErrorBox message={error} />
        {!dataLoaded && <PageLoading text="Loading admin data..." />}

        {/* 1. ID checks waiting for you */}
        <section>
          <h2 className="text-2xl font-bold">Verification requests ({requests.length})</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Check the ID, confirm the Mobile Money payment on WhatsApp, then approve with the period they paid for.
          </p>
          {requests.length === 0 ? (
            <p className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800 p-6 text-sm text-zinc-400">No requests waiting.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                  <div>
                    <p className="font-semibold">{sellerName(r.seller)} <span className="font-normal text-zinc-400">({r.seller?.full_name})</span></p>
                    <p className="text-xs text-zinc-400">
                      {r.seller?.location ?? "No area"} • {phones[r.seller_id] ?? "No phone"} • sent {formatDate(r.created_at)}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-zinc-300">Note: {r.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => viewId(r.id_document_path)} className={`${btn} bg-zinc-600 hover:bg-zinc-500`}>View ID</button>
                    <select aria-label="Period paid" value={duration[r.seller_id] ?? "1"} onChange={(e) => setDuration((d) => ({ ...d, [r.seller_id]: e.target.value }))} className={selectCls}>
                      {DURATIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <button onClick={() => approve(r.seller_id)} className={`${btn} bg-blue-600 hover:bg-blue-500`}>Approve</button>
                    <button onClick={() => rejectRequest(r.id)} className={`${btn} bg-red-700 hover:bg-red-600`}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Reports against sellers */}
        <section>
          <h2 className="text-2xl font-bold">Reports ({reports.length})</h2>
          {reports.length === 0 ? (
            <p className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800 p-6 text-sm text-zinc-400">No open reports.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                  <div className="max-w-xl">
                    <p className="font-semibold">
                      <Link href={`/seller/${r.seller_id}`} className="hover:underline" target="_blank">{sellerName(r.seller)}</Link>
                      <span className="font-normal text-zinc-400"> reported by {r.reporter?.full_name || "a user"} on {formatDate(r.created_at)}</span>
                    </p>
                    <p className="mt-1 text-sm text-amber-300">{r.reason}</p>
                    {r.details && <p className="mt-1 text-xs text-zinc-300">{r.details}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSuspended(r.seller_id, true).then(() => resolveReport(r.id, "reviewed"))} className={`${btn} bg-red-700 hover:bg-red-600`}>Suspend seller</button>
                    <button onClick={() => resolveReport(r.id, "reviewed")} className={`${btn} bg-zinc-600 hover:bg-zinc-500`}>Mark reviewed</button>
                    <button onClick={() => resolveReport(r.id, "dismissed")} className={`${btn} bg-zinc-700 hover:bg-zinc-600`}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Everyone */}
        <section>
          <h2 className="text-2xl font-bold">All sellers ({sellers.length})</h2>
          {sellers.length === 0 ? (
            <p className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800 p-6 text-sm text-zinc-400">No sellers have registered yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-800">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-700 bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Seller</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Paid until</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {sellers.map((s) => {
                    const st = sellerStatus(s);
                    const style = STATUS_STYLE[st];
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-3">
                          <Link href={`/seller/${s.id}`} target="_blank" className="font-medium hover:underline">{sellerName(s)}</Link>
                          <p className="text-xs text-zinc-400">{s.full_name}{s.location ? ` • ${s.location}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{phones[s.id] ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>{style.label}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {s.verified ? (s.paid_until ? formatDate(s.paid_until) : "No expiry") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <select aria-label="Period" value={duration[s.id] ?? "1"} onChange={(e) => setDuration((d) => ({ ...d, [s.id]: e.target.value }))} className={selectCls}>
                              {DURATIONS.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>
                            <button onClick={() => approve(s.id)} className={`${btn} bg-blue-600 hover:bg-blue-500`}>
                              {s.verified ? "Renew" : "Verify"}
                            </button>
                            <button onClick={() => setSuspended(s.id, !s.suspended)} className={`${btn} ${s.suspended ? "bg-green-700 hover:bg-green-600" : "bg-red-700 hover:bg-red-600"}`}>
                              {s.suspended ? "Unsuspend" : "Suspend"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
