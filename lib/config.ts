// Business settings in one place. Change these here, not across the app.

export const APP_NAME = "BEYI POWA";

/** Shown to sellers asking for the blue tick. Collected by hand, outside the app. */
export const ACTIVATION_FEE_UGX = 7000;
export const MONTHLY_FEE_UGX = 5000;
export const FREE_FOUNDING_SELLERS = 20;

/** Where sellers send their ID and payment. Digits only, with country code, e.g. 2567XXXXXXXX. */
export const ADMIN_WHATSAPP = (process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "").replace(/\D/g, "");

export const BRANDS = ["Apple", "Samsung", "Tecno", "Infinix", "Google", "Xiaomi", "Huawei", "Nokia", "Itel", "Other"] as const;

export const AREAS = [
  "Kikuubo",
  "Kampala Central",
  "Ntinda",
  "Wandegeya",
  "Nakawa",
  "Kawempe",
  "Makindye",
  "Entebbe Road",
  "Other",
] as const;

export const MAX_PHOTOS = 5;

/** Community videos are uploaded as they are, so keep them short and small. */
export const MAX_VIDEO_MB = 25;
export const MAX_VIDEO_SECONDS = 60;
