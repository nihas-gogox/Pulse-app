/**
 * Pending connection requests created today (local midnight).
 * Kept in a tiny module so screens import a stable binding (avoids Metro named-export edge cases on native).
 */
export function todayPendingInviteCountFromSent(
  requests: ReadonlyArray<{ status?: string | null; created_at: string }>,
): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return requests.filter(
    (r) =>
      String(r.status ?? "").toLowerCase() === "pending" &&
      new Date(r.created_at) >= todayStart,
  ).length;
}
