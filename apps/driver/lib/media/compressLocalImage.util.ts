/**
 * Shrink camera / gallery photos before upload — same idea as avatar resize
 * (lower peak memory, keep text/POD readable).
 *
 * Caps the longest edge, re-encodes JPEG. Native uses ImageManipulator;
 * web uses canvas (lib/pod/imageCompression).
 */
import { compressImage } from "@pulse/core/lib/pod/imageCompression";
import * as ImageManipulator from "expo-image-manipulator";
import { Image, Platform } from "react-native";

/** Longest edge for POD / LR / trip proof (avatars use 512; proofs need more detail). */
export const PROOF_IMAGE_MAX_EDGE = 1024;
/** JPEG quality — readable for documents, far smaller than camera originals. */
export const PROOF_IMAGE_JPEG_QUALITY = 0.75;
/** Prefer lower picker quality so the asset is smaller before we resize again. */
export const PROOF_IMAGE_PICKER_QUALITY = 0.65;

export type CompressedLocalImage = {
  uri: string;
  arrayBuffer: ArrayBuffer;
  mimeType: "image/jpeg";
  byteLength: number;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) =>
        reject(
          error instanceof Error ? error : new Error("Could not read image size"),
        ),
    );
  });
}

async function readArrayBufferFromUri(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    const b64 = comma >= 0 ? uri.slice(comma + 1) : uri;
    const binary = globalThis.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  if (
    Platform.OS === "web" ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("blob:")
  ) {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  const FileSystem = await import("expo-file-system/legacy");
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64" as const,
  });
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Resize + JPEG-compress a local image URI for trip proof / POD / LR uploads.
 */
export async function compressLocalImageForUpload(
  uri: string,
  options?: { maxEdge?: number; quality?: number },
): Promise<CompressedLocalImage> {
  const maxEdge = Math.max(64, options?.maxEdge ?? PROOF_IMAGE_MAX_EDGE);
  const quality = Math.min(
    1,
    Math.max(0.4, options?.quality ?? PROOF_IMAGE_JPEG_QUALITY),
  );

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    const compressed = await compressImage(blob, maxEdge, quality);
    const arrayBuffer = await compressed.arrayBuffer();
    return {
      uri,
      arrayBuffer,
      mimeType: "image/jpeg",
      byteLength: arrayBuffer.byteLength,
    };
  }

  let actions: ImageManipulator.Action[] = [];
  try {
    const { width, height } = await getImageSize(uri);
    const longEdge = Math.max(width, height);
    if (longEdge > maxEdge) {
      if (width >= height) {
        actions = [{ resize: { width: maxEdge } }];
      } else {
        actions = [{ resize: { height: maxEdge } }];
      }
    }
  } catch {
    // Unknown size — still force a width cap (maintains aspect ratio).
    actions = [{ resize: { width: maxEdge } }];
  }

  const manipulated = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const arrayBuffer = await readArrayBufferFromUri(manipulated.uri);
  return {
    uri: manipulated.uri,
    arrayBuffer,
    mimeType: "image/jpeg",
    byteLength: arrayBuffer.byteLength,
  };
}
