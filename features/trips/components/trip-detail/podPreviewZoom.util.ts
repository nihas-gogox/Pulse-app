export const POD_PREVIEW_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const POD_PREVIEW_ZOOM_MIN = POD_PREVIEW_ZOOM_STEPS[0];
export const POD_PREVIEW_ZOOM_MAX = POD_PREVIEW_ZOOM_STEPS[POD_PREVIEW_ZOOM_STEPS.length - 1];

export function clampZoom(value: number) {
  return Math.min(POD_PREVIEW_ZOOM_MAX, Math.max(POD_PREVIEW_ZOOM_MIN, Math.round(value * 100) / 100));
}

export function adjacentZoom(current: number, direction: 1 | -1) {
  if (direction > 0) {
    return POD_PREVIEW_ZOOM_STEPS.find((step) => step > current + 0.001) ?? POD_PREVIEW_ZOOM_MAX;
  }
  return [...POD_PREVIEW_ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? POD_PREVIEW_ZOOM_MIN;
}

/** Pan after a scale change. `cursor` is relative to the stage center; omit it to zoom about the center. */
export function panForZoom(
  prevScale: number,
  prevPan: { x: number; y: number },
  nextScale: number,
  cursor?: { x: number; y: number },
) {
  if (nextScale <= 1) return { x: 0, y: 0 };
  const ratio = prevScale > 0 ? nextScale / prevScale : 1;
  if (!cursor) return { x: prevPan.x * ratio, y: prevPan.y * ratio };
  return {
    x: cursor.x - ratio * (cursor.x - prevPan.x),
    y: cursor.y - ratio * (cursor.y - prevPan.y),
  };
}
