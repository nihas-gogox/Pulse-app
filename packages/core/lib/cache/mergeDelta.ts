type RowLike = { id: string };

interface MergeDeltaOptions<T extends RowLike> {
  existing: T[];
  changed: T[];
  deletedIds: string[];
  compare?: (a: T, b: T) => number;
}

export function mergeDeltaRows<T extends RowLike>(opts: MergeDeltaOptions<T>): T[] {
  const map = new Map<string, T>();
  for (const row of opts.existing) map.set(row.id, row);
  for (const row of opts.changed) map.set(row.id, row);
  for (const id of opts.deletedIds) map.delete(id);
  const rows = Array.from(map.values());
  if (opts.compare) rows.sort(opts.compare);
  return rows;
}
