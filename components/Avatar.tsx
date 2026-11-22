import { Icon } from "./Icon";

const COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-700",
  "bg-fuchsia-600",
  "bg-slate-600",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** A round picture stand-in: initials for a person, a group symbol for a community. */
export function Avatar({
  name,
  seed,
  group = false,
  size = "md",
}: {
  name: string;
  seed: string;
  group?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-10 w-10 text-sm" : "h-12 w-12 text-base";
  return (
    <span
      aria-hidden="true"
      className={`flex ${box} shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(seed)}`}
    >
      {group ? <Icon name="users" className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} /> : initials(name)}
    </span>
  );
}
