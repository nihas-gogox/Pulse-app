export function identitiesKey(userIds: string[]): string {
  return [...new Set(userIds.map((id) => String(id).trim()).filter(Boolean))]
    .sort()
    .join(",");
}
