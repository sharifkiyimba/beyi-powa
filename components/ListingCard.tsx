import Link from "next/link";
import type { ListingWithRelations } from "@/lib/types";
import { CONDITION_LABEL, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import { firstPhotoUrl, wholesalePriceOf } from "@/lib/listings";
import { Photo } from "./Photo";
import { VerifiedTick } from "./VerifiedBadge";

const CONDITION_STYLE = {
  new: "bg-emerald-50 text-emerald-700",
  clean_piece: "bg-blue-50 text-blue-700",
  has_issues: "bg-amber-50 text-amber-800",
} as const;

/** A compact phone card made for a two-column grid on a phone: photo, price, name, condition, seller. */
export function ListingCard({ listing }: { listing: ListingWithRelations }) {
  const wholesale = wholesalePriceOf(listing);
  const verified = isActiveSeller(listing.seller);

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-zinc-100">
        <Photo src={firstPhotoUrl(listing)} alt={listing.title} className="h-full w-full object-contain" />
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-base font-bold text-zinc-900">{formatUGX(listing.retail_price)}</p>
        {wholesale !== null && (
          <p className="text-[11px] font-semibold text-green-700">Wholesale {formatUGX(wholesale)}</p>
        )}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-zinc-800">{listing.title}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${CONDITION_STYLE[listing.condition]}`}>
            {CONDITION_LABEL[listing.condition]}
          </span>
          {listing.location && <span className="truncate text-[11px] text-zinc-500">{listing.location}</span>}
        </div>

        <div className="mt-auto flex items-center gap-1 pt-2 text-xs text-zinc-500">
          <span className="truncate">{sellerName(listing.seller)}</span>
          {verified && <VerifiedTick />}
        </div>
      </div>
    </Link>
  );
}
