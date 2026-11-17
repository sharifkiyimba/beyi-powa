/**
 * Shrinks a photo in the browser before upload so it uses little mobile data
 * and little storage. Typical result: 100 to 250 KB instead of 3 to 8 MB.
 */
export async function compressImage(
  file: File,
  { maxDim = 1280, targetBytes = 250_000 }: { maxDim?: number; targetBytes?: number } = {}
): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not a photo.");
  if (file.size > 20 * 1024 * 1024) throw new Error("That photo is too large (over 20 MB).");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process the photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not compress the photo."))),
        "image/jpeg",
        quality
      )
    );

  let quality = 0.8;
  let blob = await toBlob(quality);
  while (blob.size > targetBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(quality);
  }
  return blob;
}
