export function VerifiedTick({ size = "sm" }: { size?: "sm" | "md" }) {
  const box = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Verified seller" className={`${box} shrink-0`}>
      <title>Verified seller</title>
      <circle cx="12" cy="12" r="12" fill="#2563eb" />
      <path d="M7 12.5l3.5 3.5L17 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
