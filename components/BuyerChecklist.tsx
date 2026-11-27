import { Icon } from "./Icon";

const STEPS = [
  "Meet at the seller's shop or another busy public place. Do not go alone to a quiet place.",
  "Dial *#06# on the phone. The IMEI shown must match the box or sticker.",
  "Check that the phone is not reported stolen or counterfeit with UCC (Simu Klear) before you pay.",
  "Test the screen, calls, camera, charging and battery.",
  "Pay only after you have checked the phone. Never pay in advance.",
];

/** Short safety steps for buyers, shown on every phone page. */
export function BuyerChecklist() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <Icon name="info" className="h-4 w-4" />
        Before you pay
      </h2>
      <ol className="mt-2 space-y-1.5 text-sm text-amber-900">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
