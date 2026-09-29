import {
  hasInAppPrevious,
  noteInAppPath,
  peekInAppPrevious,
  resetInAppHistory,
} from "@/lib/inAppHistory";

describe("inAppHistory", () => {
  beforeEach(() => {
    resetInAppHistory();
  });

  it("does not treat the index boot replace as a page to return to", () => {
    noteInAppPath("/", 1);
    noteInAppPath("/trips", 1);
    expect(hasInAppPrevious()).toBe(false);
    expect(peekInAppPrevious()).toBeNull();
  });

  it("remembers the screen that pushed the current one", () => {
    noteInAppPath("/trips", 1);
    noteInAppPath("/add-trip", 2);
    expect(peekInAppPrevious()).toBe("/trips");
  });

  it("pops back to the earlier screen instead of keeping the one we left", () => {
    noteInAppPath("/supplier/abc", 2);
    noteInAppPath("/add-trip", 3);
    noteInAppPath("/supplier/abc", 3);
    expect(hasInAppPrevious()).toBe(false);
    expect(peekInAppPrevious()).toBeNull();
  });

  it("collapses a pushed index boot so trips is not 'under' the splash", () => {
    noteInAppPath("/", 1);
    noteInAppPath("/trips", 2);
    noteInAppPath("/trip/abc", 3);
    expect(peekInAppPrevious()).toBe("/trips");
  });
});
