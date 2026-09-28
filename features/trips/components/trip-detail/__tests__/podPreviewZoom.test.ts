import { adjacentZoom, clampZoom, panForZoom } from "../podPreviewZoom.util";

describe("POD preview zoom", () => {
  it("steps through the labeled zoom percentages", () => {
    expect(adjacentZoom(1, 1)).toBe(1.25);
    expect(adjacentZoom(1, -1)).toBe(0.75);
    expect(adjacentZoom(0.5, -1)).toBe(0.5);
    expect(adjacentZoom(2, 1)).toBe(2);
    expect(clampZoom(4)).toBe(2);
    expect(clampZoom(0.1)).toBe(0.5);
    expect(Math.round(clampZoom(1) * 100)).toBe(100);
    expect(Math.round(adjacentZoom(1.5, 1) * 100)).toBe(175);
    expect(Math.round(adjacentZoom(1.75, 1) * 100)).toBe(200);
  });

  it("keeps the point under the cursor fixed when zooming", () => {
    const cursor = { x: 80, y: -40 };
    const nextPan = panForZoom(1, { x: 0, y: 0 }, 2, cursor);
    const content = {
      x: (cursor.x - 0) / 1,
      y: (cursor.y - 0) / 1,
    };
    expect(content.x * 2 + nextPan.x).toBeCloseTo(cursor.x);
    expect(content.y * 2 + nextPan.y).toBeCloseTo(cursor.y);
  });

  it("returns to the default size from reset", () => {
    expect(panForZoom(2, { x: 40, y: 12 }, 1)).toEqual({ x: 0, y: 0 });
  });
});
