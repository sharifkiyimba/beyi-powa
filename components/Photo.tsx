/* eslint-disable @next/next/no-img-element */
import { Icon } from "./Icon";

// Plain <img> on purpose: photos are already compressed before upload and
// come from Supabase Storage, so no extra image server is needed.

export function Photo({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-zinc-100 text-zinc-300 ${className}`} role="img" aria-label={alt}>
        <Icon name="device" className="h-1/2 max-h-12 w-1/2 max-w-12" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
