/* eslint-disable @next/next/no-img-element */
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
      <div className={`flex items-center justify-center bg-zinc-100 text-3xl text-zinc-300 ${className}`} aria-label={alt}>
        📱
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
