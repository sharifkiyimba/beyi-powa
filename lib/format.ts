import type { Condition, Profile, SellerSummary } from "./types";

export const CONDITION_LABEL: Record<Condition, string> = {
  new: "New",
  clean_piece: "Clean piece",
  has_issues: "Has issues",
};

export function formatUGX(amount: number): string {
  return "UGX " + amount.toLocaleString("en-UG");
}

export function sellerName(p: Pick<SellerSummary, "shop_name" | "full_name"> | null | undefined): string {
  if (!p) return "Seller";
  return p.shop_name?.trim() || p.full_name?.trim() || "Seller";
}

type StatusFields = Pick<Profile, "verified" | "paid_until" | "suspended">;

/** True when the blue tick is currently valid: verified, not suspended, fee not lapsed. */
export function isActiveSeller(p: StatusFields | null | undefined): boolean {
  if (!p) return false;
  if (!p.verified || p.suspended) return false;
  if (p.paid_until && new Date(p.paid_until).getTime() <= Date.now()) return false;
  return true;
}

export type SellerStatus = "active" | "unverified" | "expired" | "suspended";

export function sellerStatus(p: StatusFields): SellerStatus {
  if (p.suspended) return "suspended";
  if (!p.verified) return "unverified";
  if (p.paid_until && new Date(p.paid_until).getTime() <= Date.now()) return "expired";
  return "active";
}

/** Whole days from now until the given date (negative when it has passed). */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "Today", "Yesterday", or the date. Used for the dividers in chats. */
export function dayLabel(iso: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(iso);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Only allow same-site paths after login, so a crafted link cannot send people elsewhere. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
