"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { AREAS, BRANDS, MAX_PHOTOS } from "@/lib/config";
import { CONDITION_LABEL, isActiveSeller } from "@/lib/format";
import type { Condition } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ErrorBox, NoticeBox, PageLoading, inputClass, primaryButton } from "@/components/ui";

export default function AddListingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "",
    brand: "Apple" as string,
    condition: "clean_piece" as Condition,
    price: "",
    wholesalePrice: "",
    location: "",
    description: "",
  });

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Preview thumbnails of the chosen photos.
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => [...prev, ...chosen].slice(0, MAX_PHOTOS));
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");

    const retail = Number(form.price);
    const wholesale = Number(form.wholesalePrice);
    if (!Number.isFinite(retail) || retail < 1000) return setError("Enter a retail price of at least UGX 1,000.");
    if (!Number.isFinite(wholesale) || wholesale < 1000) return setError("Enter a wholesale price of at least UGX 1,000.");
    if (wholesale > retail) return setError("The wholesale price cannot be higher than the retail price.");
    if (photos.length === 0) return setError("Add at least one photo. Buyers trust listings with real photos.");

    setBusy(true);
    const supabase = getSupabase();
    let listingId: string | null = null;
    const uploaded: string[] = [];

    try {
      setProgress("Saving listing...");
      const { data: created, error: insertError } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          title: form.title.trim(),
          brand: form.brand,
          condition: form.condition,
          retail_price: retail,
          location: form.location.trim() || profile?.location || null,
          description: form.description.trim() || null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      listingId = (created as { id: string }).id;

      const { error: wholesaleError } = await supabase
        .from("listing_wholesale")
        .insert({ listing_id: listingId, wholesale_price: wholesale });
      if (wholesaleError) throw wholesaleError;

      const mediaRows: { listing_id: string; path: string; kind: "image"; position: number }[] = [];
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}...`);
        const blob = await compressImage(photos[i]);
        const path = `${user.id}/${listingId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("listing-media")
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        mediaRows.push({ listing_id: listingId, path, kind: "image", position: i });
      }

      const { error: mediaError } = await supabase.from("listing_media").insert(mediaRows);
      if (mediaError) throw mediaError;

      router.push(`/listing/${listingId}`);
    } catch (err) {
      // Do not leave a half-finished listing behind.
      if (uploaded.length) await supabase.storage.from("listing-media").remove(uploaded);
      if (listingId) await supabase.from("listings").delete().eq("id", listingId);
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
      setError(
        message?.toLowerCase().includes("row-level security")
          ? "Your seller account is not active. Please check your verification status on the dashboard."
          : `Could not publish the listing. ${message ?? ""}`.trim()
      );
      setBusy(false);
      setProgress("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading />
      </div>
    );
  }

  // Only active (verified, paid, not suspended) sellers may post.
  if (!profile || profile.role !== "seller" || !isActiveSeller(profile)) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Verified sellers only</h1>
          <p className="mt-2 text-zinc-600">
            {profile?.role === "seller"
              ? "You need the blue tick before you can post phones. Verification builds buyer trust."
              : "Only seller accounts can post phones."}
          </p>
          <Link href="/dashboard" className={`mt-6 inline-block ${primaryButton}`}>
            Go to dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <Header />

      <main className="mx-auto max-w-2xl px-4 pt-8">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          &larr; Back to dashboard
        </Link>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900">Add a new phone</h1>
          <p className="mt-1 text-sm text-zinc-500">List a phone for buyers and sellers in Kampala.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-900">Phone title</label>
              <input id="title" type="text" required maxLength={80} value={form.title} onChange={(e) => update({ title: e.target.value })} className={inputClass} placeholder="iPhone 13 Pro Max 256GB" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="brand" className="mb-1 block text-sm font-medium text-zinc-900">Brand</label>
                <select id="brand" value={form.brand} onChange={(e) => update({ brand: e.target.value })} className={inputClass}>
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="condition" className="mb-1 block text-sm font-medium text-zinc-900">Condition</label>
                <select id="condition" value={form.condition} onChange={(e) => update({ condition: e.target.value as Condition })} className={inputClass}>
                  {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
                    <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className="mb-1 block text-sm font-medium text-zinc-900">Retail price (UGX)</label>
                <input id="price" type="number" inputMode="numeric" required min={1000} value={form.price} onChange={(e) => update({ price: e.target.value })} className={inputClass} placeholder="1500000" />
                <p className="mt-1 text-xs text-zinc-500">Fixed price shown to everyone.</p>
              </div>
              <div>
                <label htmlFor="wholesale" className="mb-1 block text-sm font-medium text-zinc-900">Wholesale price (UGX)</label>
                <input id="wholesale" type="number" inputMode="numeric" required min={1000} value={form.wholesalePrice} onChange={(e) => update({ wholesalePrice: e.target.value })} className={inputClass} placeholder="1300000" />
                <p className="mt-1 text-xs text-zinc-500">Only other verified sellers see this.</p>
              </div>
            </div>

            <div>
              <label htmlFor="location" className="mb-1 block text-sm font-medium text-zinc-900">Where can buyers see it?</label>
              <select id="location" value={form.location || profile.location || AREAS[0]} onChange={(e) => update({ location: e.target.value })} className={inputClass}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-900">Description (optional)</label>
              <textarea id="description" rows={3} maxLength={1000} value={form.description} onChange={(e) => update({ description: e.target.value })} className={inputClass} placeholder="Storage size, battery health, what is in the box, any marks or faults..." />
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-zinc-900">Photos (up to {MAX_PHOTOS})</span>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {previews.map((src, i) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Chosen photo ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 text-center hover:border-blue-400">
                    <span className="text-2xl">📸</span>
                    <span className="mt-1 text-[11px] font-medium text-zinc-600">Add photo</span>
                    <input type="file" accept="image/*" multiple onChange={addPhotos} className="sr-only" />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-zinc-500">Photos are shrunk automatically to save mobile data. Show the front, back and screen on.</p>
            </div>

            <ErrorBox message={error} />
            {busy && progress && <NoticeBox>{progress}</NoticeBox>}

            <button type="submit" disabled={busy} className={`w-full py-3 ${primaryButton}`}>
              {busy ? "Publishing..." : "Publish listing"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
