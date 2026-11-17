export function VerifiedTick({ size = "sm" }: { size?: "sm" | "md" }) {
  const box = size === "md" ? "h-4 w-4 text-[10px]" : "h-3.5 w-3.5 text-[9px]";
  return (
    <span
      title="Verified seller"
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white`}
    >
      ✓
    </span>
  );
}

export function VerifiedPill({ label = "Verified" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
      <VerifiedTick />
      {label}
    </span>
  );
}
