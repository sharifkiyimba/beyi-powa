import Link from "next/link";
import type { ListingWithRelations } from "@/lib/types";
import { CONDITION_LABEL, formatUGX, isActiveSeller, sellerName } from "@/lib/format";
import { firstPhotoUrl, wholesalePriceOf } from "@/lib/listings";
import { Photo } from "./Photo";
import { VerifiedTick } from "./VerifiedBadge";

export function ListingCard({ listing }: { listing: ListingWithRelations }) {
  const wholesale = wholesalePriceOf(listing);
  const verified = isActiveSeller(listing.seller);

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
        <Photo
          src={firstPhotoUrl(listing)}
          alt={listing.title}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-zinc-900">{listing.title}</h3>
          <div className="text-right">
            <span className="block whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
              {formatUGX(listing.retail_price)}
            </span>
            {wholesale !== null && (
              <span className="mt-1 block rounded-md bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                Wholesale: {formatUGX(wholesale)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{CONDITION_LABEL[listing.condition]}</span>
          {listing.location && (
            <>
              <span>•</span>
              <span>{listing.location}</span>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="font-semibold">{sellerName(listing.seller)}</span>
            {verified && <VerifiedTick />}
          </div>
          <span className="text-xs font-semibold text-blue-600 group-hover:underline">View details</span>
        </div>
      </div>
    </Link>
  );
}
