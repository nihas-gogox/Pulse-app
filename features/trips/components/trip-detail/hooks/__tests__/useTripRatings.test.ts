import { useTripRatings } from "../useTripRatings";

jest.mock("@/features/ratings/services/ratings.service", () => ({
  getRatingsForTrip: jest.fn(() => {
    throw new Error("getRatingsForTrip must not run from useTripRatings");
  }),
  averageScore: jest.fn(),
}));

describe("useTripRatings", () => {
  it("does not call getRatingsForTrip (TripRatingsBlock owns that fetch)", () => {
    const { getRatingsForTrip } = jest.requireMock(
      "@/features/ratings/services/ratings.service",
    ) as { getRatingsForTrip: jest.Mock };
    expect(useTripRatings("trip-1", true)).toEqual({ driverRatingAvg: null });
    expect(getRatingsForTrip).not.toHaveBeenCalled();
  });
});
