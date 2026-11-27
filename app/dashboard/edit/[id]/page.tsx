"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { IMEI_HELP, cleanImei, isValidImei } from "@/lib/imei";
import { AREAS, BRANDS, MAX_PHOTOS } from "@/lib/config";
import { CONDITION_LABEL, formatUGX } from "@/lib/format";
import { mediaUrl } from "@/lib/listings";
import type { Condition, Listing, ListingMedia } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Choice } from "@/components/Choice";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { ErrorBox, NoticeBox, PageLoading, inputClass, primaryButton, secondaryButton } from "@/components/ui";

type LoadedListing = Listing & {
  listing_media: ListingMedia[];
  wholesale: { wholesale_price: number } | { wholesale_price: number }[] | null;
  private: { imei: string } | { imei: string }[] | null;
};

const CONDITION_HELP: Record<Condition, string> = {
  new: "Sealed or never used",
  clean_piece: "Used, in very good shape",
  has_issues: "Has faults. Say which in the description",
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default function EditListingPage() {
  // useParams() needs a Suspense boundary in this version of Next.js.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50">
          <Header />
          <PageLoading />
        </div>
      }
    >
      <EditContent />
    </Suspense>
  );
}

function EditContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<"loading" | "missing" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    brand: "Apple" as string,
    condition: "clean_piece" as Condition,
    price: "",
    wholesalePrice: "",
    location: AREAS[0] as string,
    description: "",
    imei: "",
  });
  const [existing, setExisting] = useState<ListingMedia[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<File[]>([]);

  const update = (patch: Partial<typeof form>) => {
    setError("");
    setForm((f) => ({ ...f, ...patch }));
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getSupabase()
      .from("listings")
      .select("*, listing_media (path, kind, position), wholesale:listing_wholesale (wholesale_price), private:listing_private (imei)")
      .eq("id", id)
      .eq("seller_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) {
          setState("missing");
          return;
        }
        const l = data as unknown as LoadedListing;
        setForm({
          title: l.title,
          brand: l.brand,
          condition: l.condition,
          price: String(l.retail_price),
          wholesalePrice: String(one(l.wholesale)?.wholesale_price ?? ""),
          location: l.location ?? AREAS[0],
          description: l.description ?? "",
          imei: one(l.private)?.imei ?? "",
        });
        setExisting([...l.listing_media].filter((m) => m.kind === "image").sort((a, b) => a.position - b.position));
        setState("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const keptPhotos = existing.filter((m) => !removed.includes(m.path));
  const newPreviews = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added]);
  useEffect(() => () => newPreviews.forEach((u) => URL.revokeObjectURL(u)), [newPreviews]);
  const totalPhotos = keptPhotos.length + added.length;

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    const room = Math.max(MAX_PHOTOS - keptPhotos.length, 0);
    setError("");
    setAdded((prev) => [...prev, ...chosen].slice(0, room));
    e.target.value = "";
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");

    const retail = Number(form.price);
    const wholesale = Number(form.wholesalePrice);
    if (form.title.trim().length < 3) return setError("Enter the phone's name.");
    if (!Number.isFinite(retail) || retail < 1000) return setError("Enter a retail price of at least UGX 1,000.");
    if (!Number.isFinite(wholesale) || wholesale < 1000) return setError("Enter a wholesale price of at least UGX 1,000.");
    if (wholesale > retail) return setError("The wholesale price cannot be higher than the retail price.");
    if (totalPhotos === 0) return setError("Keep or add at least one photo.");
    if (form.imei.trim() && !isValidImei(form.imei)) {
      return setError("That IMEI does not look right. It has 15 digits. Dial *#06# on the phone and type it again.");
    }

    setBusy(true);
    const supabase = getSupabase();
    try {
      setProgress("Saving changes...");
      const { error: updateError } = await supabase
        .from("listings")
        .update({
          title: form.title.trim(),
          brand: form.brand,
          condition: form.condition,
          retail_price: retail,
          location: form.location,
          description: form.description.trim() || null,
        })
        .eq("id", id);
      if (updateError) throw updateError;

      const { error: wholesaleError } = await supabase
        .from("listing_wholesale")
        .upsert({ listing_id: id, wholesale_price: wholesale }, { onConflict: "listing_id" });
      if (wholesaleError) throw wholesaleError;

      if (form.imei.trim()) {
        const { error: imeiError } = await supabase
          .from("listing_private")
          .upsert({ listing_id: id, imei: cleanImei(form.imei) }, { onConflict: "listing_id" });
        if (imeiError) throw imeiError;
      } else {
        await supabase.from("listing_private").delete().eq("listing_id", id);
      }

      if (removed.length) {
        const { error: removeError } = await supabase.from("listing_media").delete().eq("listing_id", id).in("path", removed);
        if (removeError) throw removeError;
        await supabase.storage.from("listing-media").remove(removed);
      }

      if (added.length) {
        const start = existing.reduce((max, m) => Math.max(max, m.position), -1) + 1;
        const rows: { listing_id: string; path: string; kind: "image"; position: number }[] = [];
        for (let i = 0; i < added.length; i++) {
          setProgress(`Uploading photo ${i + 1} of ${added.length}...`);
          const blob = await compressImage(added[i]);
          const path = `${user.id}/${id}/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("listing-media")
            .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (uploadError) throw uploadError;
          rows.push({ listing_id: id, path, kind: "image", position: start + i });
        }
        const { error: mediaError } = await supabase.from("listing_media").insert(rows);
        if (mediaError) throw mediaError;
      }

      router.push(`/listing/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
      setError(
        message?.toLowerCase().includes("already listed")
          ? "This IMEI is already on another available phone on BEYI POWA. Check the number, or contact the team if it is your phone."
          : `Could not save your changes. ${message ?? ""}`.trim()
      );
      setBusy(false);
      setProgress("");
    }
  };

  if (authLoading || state === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <PageLoading />
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Phone not found</h1>
          <p className="mt-2 text-zinc-600">You can only edit your own phones.</p>
          <Link href="/dashboard" className={`mt-6 inline-block ${primaryButton}`}>
            Back to Me
          </Link>
        </main>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex min-h-screen flex-col bg-zinc-50">
      <div className="hidden md:block">
        <Header />
      </div>

      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white md:static md:border-0 md:bg-transparent">
        <div className="mx-auto flex max-w-xl items-center gap-1 px-2 py-2 md:px-4 md:pt-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            disabled={busy}
            aria-label="Cancel"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
          <p className="text-base font-bold text-zinc-900">Edit phone</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-5">
        <section>
          <h2 className="text-sm font-semibold text-zinc-900">Photos ({totalPhotos}/{MAX_PHOTOS})</h2>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {keptPhotos.map((m, i) => (
              <div key={m.path} className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(m.path)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setRemoved((r) => [...r, m.path])}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {newPreviews.map((src, i) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-blue-300 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`New photo ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">New</span>
                <button
                  type="button"
                  aria-label={`Remove new photo ${i + 1}`}
                  onClick={() => setAdded((a) => a.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {totalPhotos < MAX_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 text-center hover:border-blue-500">
                <Icon name="camera" className="h-8 w-8 text-blue-500" />
                <span className="mt-1 text-xs font-semibold text-blue-700">Add photo</span>
                <input type="file" accept="image/*" multiple onChange={addPhotos} className="sr-only" />
              </label>
            )}
          </div>
        </section>

        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-900">Phone name</label>
          <input id="title" type="text" maxLength={80} value={form.title} onChange={(e) => update({ title: e.target.value })} className={`${inputClass} text-base`} />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-900">Brand</span>
          <div className="flex flex-wrap gap-2">
            {BRANDS.map((b) => (
              <Choice key={b} active={form.brand === b} onClick={() => update({ brand: b })}>
                {b}
              </Choice>
            ))}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-900">Condition</legend>
          <div className="space-y-2">
            {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ condition: c })}
                aria-pressed={form.condition === c}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${
                  form.condition === c ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    form.condition === c ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300"
                  }`}
                >
                  {form.condition === c && <Icon name="check" className="h-3 w-3" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">{CONDITION_LABEL[c]}</span>
                  <span className="block text-xs text-zinc-500">{CONDITION_HELP[c]}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="imei" className="mb-1 block text-sm font-medium text-zinc-900">IMEI (optional)</label>
          <input id="imei" type="text" inputMode="numeric" autoComplete="off" maxLength={20} value={form.imei} onChange={(e) => update({ imei: e.target.value })} className={`${inputClass} text-base`} placeholder="15 digits" />
          <p className="mt-1 text-xs text-zinc-500">{IMEI_HELP} Private: buyers only see an &quot;IMEI on record&quot; tag.</p>
        </div>

        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-zinc-900">Retail price (UGX)</label>
          <input id="price" type="number" inputMode="numeric" min={1000} value={form.price} onChange={(e) => update({ price: e.target.value })} className={`${inputClass} text-base`} />
          <p className="mt-1 text-xs text-zinc-500">{Number(form.price) >= 1000 ? `${formatUGX(Number(form.price))}. ` : ""}Fixed price shown to everyone.</p>
        </div>

        <div>
          <label htmlFor="wholesale" className="mb-1 block text-sm font-medium text-zinc-900">Wholesale price (UGX)</label>
          <input id="wholesale" type="number" inputMode="numeric" min={1000} value={form.wholesalePrice} onChange={(e) => update({ wholesalePrice: e.target.value })} className={`${inputClass} text-base`} />
          <p className="mt-1 text-xs text-zinc-500">
            {Number(form.wholesalePrice) >= 1000 ? `${formatUGX(Number(form.wholesalePrice))}. ` : ""}Only other verified sellers see this.
          </p>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-900">Where can buyers see it?</span>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <Choice key={a} active={form.location === a} onClick={() => update({ location: a })}>
                {a}
              </Choice>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-900">Description (optional)</label>
          <textarea id="description" rows={4} maxLength={1000} value={form.description} onChange={(e) => update({ description: e.target.value })} className={`${inputClass} text-base`} />
        </div>

        {busy && progress && <NoticeBox>{progress}</NoticeBox>}
        <ErrorBox message={error} />
      </main>

      <div className="sticky bottom-0 z-30 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl gap-3">
          <button type="button" onClick={() => router.push("/dashboard")} disabled={busy} className={`py-3 ${secondaryButton}`}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`flex-1 py-3 text-base ${primaryButton}`}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
