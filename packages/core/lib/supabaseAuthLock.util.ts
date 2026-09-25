/** Supabase GoTrue navigator-lock races (dev reload / parallel refetch). */
function authLockErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message ?? "";
  if (typeof error === "string") return error;
  if (error != null && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message ?? "");
  }
  return String(error ?? "");
}

export function isIgnorableSupabaseAuthLockError(error: unknown): boolean {
  const msg = authLockErrorMessage(error).toLowerCase();
  return (
    msg.includes("lock was stolen by another request") ||
    msg.includes("another request stole") ||
    msg.includes("was released because another request stole") ||
    msg.includes('lock "lock:sb-') ||
    msg.includes("lock:sb-") ||
    msg.includes("was not released within") ||
    msg.includes("navigatorlock")
  );
}
