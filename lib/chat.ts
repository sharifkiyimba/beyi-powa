import { getSupabase } from "@/lib/supabase/client";

/**
 * Finds the conversation between me and a seller about one phone,
 * or starts it. Returns the conversation id.
 */
export async function openConversation(myId: string, sellerId: string, listingId: string): Promise<string> {
  const supabase = getSupabase();

  const find = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("initiator_id", myId)
      .eq("recipient_id", sellerId)
      .eq("listing_id", listingId)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ initiator_id: myId, recipient_id: sellerId, listing_id: listingId })
    .select("id")
    .single();

  if (error) {
    // Two taps at once can race. If it now exists, use it.
    const raced = await find();
    if (raced) return raced;
    throw error;
  }
  return (data as { id: string }).id;
}
