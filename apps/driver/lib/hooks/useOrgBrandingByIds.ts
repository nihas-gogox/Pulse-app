/**
 * Org branding for driver surfaces (logo → owner seed → owner photo).
 * Uses SECURITY DEFINER RPC — drivers cannot read other orgs/profiles under RLS.
 */
import {
  fetchOrgBrandingByIds,
  type OrgBrandingRow,
} from "../orgBrandingFetch";
import { useEffect, useMemo, useState } from "react";

export type { OrgBrandingRow };

export function useOrgBrandingByIds(
  orgIds: readonly (string | null | undefined)[],
): Record<string, OrgBrandingRow> {
  const key = useMemo(() => {
    const ids = Array.from(
      new Set(
        orgIds
          .map((id) => String(id ?? "").trim())
          .filter((id) => id.length > 0),
      ),
    ).sort();
    return ids.join("|");
  }, [orgIds]);

  const [byId, setById] = useState<Record<string, OrgBrandingRow>>({});

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split("|") : [];
    if (ids.length === 0) {
      setById({});
      return;
    }
    void fetchOrgBrandingByIds(ids).then((map) => {
      if (!cancelled) setById(map);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return byId;
}
