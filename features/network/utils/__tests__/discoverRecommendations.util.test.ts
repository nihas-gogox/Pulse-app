import { pickLoadCenterRecommendations } from "@/features/network/utils/discoverRecommendations.util";
import type { DiscoverOrg } from "@/features/network/services/discover.service";

function org(partial: Partial<DiscoverOrg> & Pick<DiscoverOrg, "id" | "name">): DiscoverOrg {
  return {
    avatar_seed: null,
    connection_status: "none",
    operating_model: "NON_ASSET",
    recommendation_score: 1,
    ...partial,
  };
}

describe("pickLoadCenterRecommendations", () => {
  it("prefers partners in different cities", () => {
    const picked = pickLoadCenterRecommendations(
      [
        org({ id: "a", name: "A", city: "Chennai", trip_count: 20 }),
        org({ id: "b", name: "B", city: "Chennai", trip_count: 18 }),
        org({ id: "c", name: "C", city: "Pune", trip_count: 10 }),
        org({ id: "d", name: "D", city: "Jaipur", trip_count: 8 }),
      ],
      { mode: "get", limit: 3 },
    );
    expect(picked.map((o) => o.city)).toEqual(["Chennai", "Pune", "Jaipur"]);
  });
});
