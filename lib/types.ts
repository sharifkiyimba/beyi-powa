// Shapes of the data stored in Supabase (see schema.sql).

export type Role = "buyer" | "seller";
export type Condition = "new" | "clean_piece" | "has_issues";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  shop_name: string | null;
  location: string | null;
  verified: boolean;
  verified_at: string | null;
  paid_until: string | null;
  suspended: boolean;
  is_admin: boolean;
  created_at: string;
}

/** The public bits of a seller shown on listings. */
export type SellerSummary = Pick<
  Profile,
  "id" | "full_name" | "shop_name" | "location" | "verified" | "paid_until" | "suspended"
>;

export interface ListingMedia {
  path: string;
  kind: "image" | "video";
  position: number;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  brand: string;
  condition: Condition;
  retail_price: number;
  location: string | null;
  description: string | null;
  status: "available" | "sold";
  created_at: string;
}

export interface ListingWithRelations extends Listing {
  seller: SellerSummary | null;
  listing_media: ListingMedia[];
  /** Only filled in for verified sellers. The database hides it from everyone else. */
  wholesale: { wholesale_price: number } | { wholesale_price: number }[] | null;
  /** Present when the seller has put this phone's IMEI on record. The IMEI itself stays private. */
  imei_flag: { listing_id: string } | { listing_id: string }[] | null;
}

export interface Conversation {
  id: string;
  initiator_id: string;
  recipient_id: string;
  listing_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  client_id: string;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

export interface CommunityOverview extends Community {
  member_count: number;
  is_member: boolean;
}

export interface CommunityMember {
  user_id: string;
  joined_at: string;
  member: Pick<Profile, "id" | "full_name" | "shop_name" | "location" | "verified" | "paid_until" | "suspended"> | null;
}

/** One photo or video in a community, optionally pointing at one of the author's phones. */
export interface CommunityPostRow {
  id: string;
  community_id: string;
  author_id: string;
  listing_id: string | null;
  caption: string | null;
  media_path: string;
  media_kind: "image" | "video";
  created_at: string;
  author: SellerSummary | null;
  listing: {
    id: string;
    title: string;
    retail_price: number;
    condition: Condition;
    status: "available" | "sold";
    wholesale: { wholesale_price: number } | { wholesale_price: number }[] | null;
  } | null;
}

export interface CommunityMessage {
  id: string;
  community_id: string;
  sender_id: string;
  body: string;
  client_id: string;
  created_at: string;
}

export interface Review {
  id: string;
  sale_id: string;
  seller_id: string;
  buyer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
