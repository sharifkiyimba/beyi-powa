import { getSupabase } from "@/lib/supabase/client";

/**
 * Finds the conversation between me and a seller, or starts it. Returns its id.
 *  - With a listingId, it is the chat about that one phone.
 *  - With null, it is a general chat between the two of us (for example from a
 *    community photo that is not tied to a listing).
 */
export async function openConversation(myId: string, sellerId: string, listingId: string | null): Promise<string> {
  const supabase = getSupabase();

  const find = async () => {
    if (listingId) {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("initiator_id", myId)
        .eq("recipient_id", sellerId)
        .eq("listing_id", listingId)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    }
    // General chat: either of us may have started it.
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .is("listing_id", null)
      .or(
        `and(initiator_id.eq.${myId},recipient_id.eq.${sellerId}),and(initiator_id.eq.${sellerId},recipient_id.eq.${myId})`
      )
      .limit(1);
    return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null;
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
