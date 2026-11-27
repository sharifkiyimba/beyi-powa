/**
 * A private, anonymous id used only to count each visitor once per day on a phone's page.
 * Signed-in people use their account id. Nothing here is shown to anyone.
 */
export function viewerKey(userId?: string | null): string {
  if (userId) return userId;
  try {
    let key = localStorage.getItem("bp_viewer");
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem("bp_viewer", key);
    }
    return key;
  } catch {
    return crypto.randomUUID();
  }
}
