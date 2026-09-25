import { PixelRatio } from "react-native";

/** Cap DPR so we do not over-fetch on 3× devices while staying sharp on 2×. */
const DPR_CAP = 2.25;
const MAX_EDGE = 960;
const MIN_EDGE = 160;

export type ChatPreviewFetch = {
  width: number;
  height: number;
  quality: number;
};

function cappedDpr(): number {
  return Math.min(DPR_CAP, PixelRatio.get());
}

function clampEdge(n: number): number {
  return Math.round(Math.min(MAX_EDGE, Math.max(MIN_EDGE, n)));
}

/** JPEG quality tuned for readable text screenshots at modest byte size. */
export function chatPreviewQuality(maxEdge: number): number {
  if (maxEdge >= 720) return 82;
  if (maxEdge >= 480) return 80;
  if (maxEdge >= 320) return 78;
  return 76;
}

/**
 * CDN/imgproxy fetch box for a known on-screen size.
 * Uses device pixel ratio so retina previews are not upscaled from tiny thumbs.
 */
export function chatPreviewFetchForDisplay(
  displayWidth: number,
  displayHeight: number,
  resize: "cover" | "contain" = "cover",
): ChatPreviewFetch {
  const dpr = cappedDpr();
  const w = clampEdge(displayWidth * dpr);
  const h = clampEdge(displayHeight * dpr);
  const maxEdge = Math.max(w, h);

  if (resize === "contain") {
    // Tall screenshots: allow a taller fetch box so text stays legible in-thread.
    const tallH = clampEdge(Math.max(displayHeight * dpr, displayWidth * dpr * 1.35));
    return {
      width: w,
      height: tallH,
      quality: chatPreviewQuality(Math.max(w, tallH)),
    };
  }

  return {
    width: w,
    height: h,
    quality: chatPreviewQuality(maxEdge),
  };
}

/** List-row / sidebar strip thumb (width-led transform). */
export function chatListThumbFetch(displayWidth: number): ChatPreviewFetch {
  const dpr = cappedDpr();
  const width = clampEdge(displayWidth * dpr);
  return {
    width,
    height: width,
    quality: chatPreviewQuality(width),
  };
}
