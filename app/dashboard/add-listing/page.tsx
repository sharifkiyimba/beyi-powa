"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { AREAS, BRANDS, MAX_PHOTOS } from "@/lib/config";
import { CONDITION_LABEL, formatUGX, isActiveSeller } from "@/lib/format";
import type { Condition } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Choice } from "@/components/Choice";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { ErrorBox, NoticeBox, PageLoading, inputClass, primaryButton, secondaryButton } from "@/components/ui";

const STEPS = ["Photos", "Phone", "Price", "Review"] as const;

const CONDITION_HELP: Record<Condition, string> = {
  new: "Sealed or never used",
  clean_piece: "Used, in very good shape",
  has_issues: "Has faults. Say which in the description",
};

type Form = {
  title: string;
  brand: string;
  condition: Condition;
  price: string;
  wholesalePrice: string;
  location: string;
  description: string;
};

export default function AddListingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState<Form>({
    title: "",
    brand: "Apple",
    condition: "clean_piece",
    price: "",
    wholesalePrice: "",
    location: "",
    description: "",
  });

  const update = (patch: Partial<Form>) => {
    setError("");
    setForm((f) => ({ ...f, ...patch }));
  };
  const area = form.location || profile?.location || AREAS[0];

  // Preview thumbnails of the chosen photos.
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    setError("");
    setPhotos((prev) => [...prev, ...chosen].slice(0, MAX_PHOTOS));
    e.target.value = "";
  };

  /** Returns a friendly message when the given step is not filled in properly, or "" when it is fine. */
  const problemWith = (n: number): string => {
    if (n === 0 && photos.length === 0) return "Add at least one photo. Buyers trust listings with real photos.";
    if (n === 1 && form.title.trim().length < 3) return "Enter the phone's name, for example iPhone 13 Pro Max 256GB.";
    if (n === 2) {
      const retail = Number(form.price);
      const wholesale = Number(form.wholesalePrice);
      if (!Number.isFinite(retail) || retail < 1000) return "Enter a retail price of at least UGX 1,000.";
      if (!Number.isFinite(wholesale) || wholesale < 1000) return "Enter a wholesale price of at least UGX 1,000.";
      if (wholesale > retail) return "The wholesale price cannot be higher than the retail price.";
    }
    return "";
  };

  const goTo = (n: number) => {
    setError("");
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    const problem = problemWith(step);
    if (problem) return setError(problem);
    goTo(step + 1);
  };

  const back = () => {
    if (step > 0) goTo(step - 1);
    else router.push("/dashboard");
  };

  const publish = async () => {
    if (!user) return;
    for (let n = 0; n < 3; n++) {
      const problem = problemWith(n);
      if (problem) {
        setStep(n);
        return setError(problem);
      }
    }
    setError("");
    const retail = Number(form.price);
    const wholesale = Number(form.wholesalePrice);

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
          location: area,
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
          ? "Your seller account is not active. Please check your verification status on the Me tab."
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
              : "Only seller accounts can post phones. You can upgrade from the Me tab."}
          </p>
          <Link href="/dashboard" className={`mt-6 inline-block ${primaryButton}`}>
            Go to Me
          </Link>
        </main>
      </div>
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <div className="hidden md:block">
        <Header />
      </div>

      {/* Top bar with the step progress */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white md:static md:border-0 md:bg-transparent">
        <div className="mx-auto flex max-w-xl items-center gap-1 px-2 py-2 md:px-4 md:pt-6">
          <button
            onClick={back}
            disabled={busy}
            aria-label={step === 0 ? "Cancel" : "Previous step"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            <Icon name={step === 0 ? "close" : "back"} className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-zinc-900">Sell a phone</p>
            <p className="text-xs text-zinc-500">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </p>
          </div>
        </div>
        <div className="mx-auto flex max-w-xl gap-1.5 px-4 pb-2.5 md:pb-0" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-blue-600" : "bg-zinc-200"}`} />
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        {step === 0 && (
          <section>
            <h1 className="text-xl font-bold text-zinc-900">Add photos</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Show the front, back and the screen on. The first photo is the cover. Up to {MAX_PHOTOS}.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {previews.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Chosen photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Cover</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 text-center hover:border-blue-500">
                  <Icon name="camera" className="h-8 w-8 text-blue-500" />
                  <span className="mt-1 text-xs font-semibold text-blue-700">{photos.length === 0 ? "Add photos" : "Add more"}</span>
                  <input type="file" accept="image/*" multiple onChange={addPhotos} className="sr-only" />
                </label>
              )}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Photos are shrunk automatically to save mobile data.</p>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <h1 className="text-xl font-bold text-zinc-900">About the phone</h1>
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-900">Phone name</label>
              <input id="title" type="text" maxLength={80} value={form.title} onChange={(e) => update({ title: e.target.value })} className={`${inputClass} text-base`} placeholder="iPhone 13 Pro Max 256GB" />
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
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h1 className="text-xl font-bold text-zinc-900">Price and place</h1>
            <div>
              <label htmlFor="price" className="mb-1 block text-sm font-medium text-zinc-900">Retail price (UGX)</label>
              <input id="price" type="number" inputMode="numeric" min={1000} value={form.price} onChange={(e) => update({ price: e.target.value })} className={`${inputClass} text-base`} placeholder="1500000" />
              <p className="mt-1 text-xs text-zinc-500">
                {Number(form.price) >= 1000 ? `${formatUGX(Number(form.price))}. ` : ""}Fixed price shown to everyone.
              </p>
            </div>
            <div>
              <label htmlFor="wholesale" className="mb-1 block text-sm font-medium text-zinc-900">Wholesale price (UGX)</label>
              <input id="wholesale" type="number" inputMode="numeric" min={1000} value={form.wholesalePrice} onChange={(e) => update({ wholesalePrice: e.target.value })} className={`${inputClass} text-base`} placeholder="1300000" />
              <p className="mt-1 text-xs text-zinc-500">
                {Number(form.wholesalePrice) >= 1000 ? `${formatUGX(Number(form.wholesalePrice))}. ` : ""}Only other verified sellers see this.
              </p>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-900">Where can buyers see it?</span>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <Choice key={a} active={area === a} onClick={() => update({ location: a })}>
                    {a}
                  </Choice>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-900">Description (optional)</label>
              <textarea id="description" rows={4} maxLength={1000} value={form.description} onChange={(e) => update({ description: e.target.value })} className={`${inputClass} text-base`} placeholder="Storage size, battery health, what is in the box, any marks or faults..." />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h1 className="text-xl font-bold text-zinc-900">Check and publish</h1>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex gap-2 overflow-x-auto bg-zinc-100 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {previews.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt={`Photo ${i + 1}`} className="h-28 w-28 shrink-0 rounded-lg object-cover" />
                ))}
              </div>
              <div className="space-y-1 p-4">
                <p className="text-2xl font-bold text-blue-600">{formatUGX(Number(form.price))}</p>
                <p className="text-base font-semibold text-zinc-900">{form.title.trim()}</p>
                <p className="text-sm text-zinc-500">
                  {form.brand} • {CONDITION_LABEL[form.condition]} • {area}
                </p>
                <p className="pt-1 text-sm font-medium text-green-700">Wholesale: {formatUGX(Number(form.wholesalePrice))}</p>
                {form.description.trim() && <p className="whitespace-pre-line pt-1 text-sm text-zinc-600">{form.description.trim()}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["Photos", 0],
                ["Phone details", 1],
                ["Price and place", 2],
              ].map(([label, n]) => (
                <button key={label} type="button" onClick={() => goTo(n as number)} disabled={busy} className={`!py-2 text-xs ${secondaryButton}`}>
                  Edit {String(label).toLowerCase()}
                </button>
              ))}
            </div>

            {busy && progress && <NoticeBox>{progress}</NoticeBox>}
          </section>
        )}

        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      </main>

      {/* The main action stays at the bottom, in thumb reach. */}
      <div className="sticky bottom-0 z-30 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl gap-3">
          {step > 0 && (
            <button onClick={back} disabled={busy} className={`py-3 ${secondaryButton}`}>
              Back
            </button>
          )}
          {isLast ? (
            <button onClick={publish} disabled={busy} className={`flex-1 py-3 text-base ${primaryButton}`}>
              {busy ? "Publishing..." : "Publish phone"}
            </button>
          ) : (
            <button onClick={next} className={`flex-1 py-3 text-base ${primaryButton}`}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
