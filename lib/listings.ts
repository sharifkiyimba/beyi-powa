import { getSupabase } from "@/lib/supabase/client";
import type { ListingWithRelations } from "@/lib/types";

/**
 * What we fetch for every listing: the listing, its seller's public details,
 * its photos, and (only if the viewer is a verified seller) its wholesale price.
 */
export const LISTING_SELECT = `
  *,
  seller:profiles!seller_id (id, full_name, shop_name, location, verified, paid_until, suspended),
  listing_media (path, kind, position),
  wholesale:listing_wholesale (wholesale_price)
`;

export function mediaUrl(path: string): string {
  return getSupabase().storage.from("listing-media").getPublicUrl(path).data.publicUrl;
}

export function sortedMedia(l: ListingWithRelations) {
  return [...(l.listing_media ?? [])].sort((a, b) => a.position - b.position);
}

export function firstPhotoUrl(l: ListingWithRelations): string | null {
  const first = sortedMedia(l).find((m) => m.kind === "image");
  return first ? mediaUrl(first.path) : null;
}

export function wholesalePriceOf(l: { wholesale: ListingWithRelations["wholesale"] }): number | null {
  const w = l.wholesale;
  if (!w) return null;
  const row = Array.isArray(w) ? w[0] : w;
  return row ? row.wholesale_price : null;
}
