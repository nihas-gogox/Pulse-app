import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 0.75;
/** Smaller payload for Gemini OCR — balance readability in low light vs upload size. */
const OCR_MAX_DIMENSION = 1280;
const OCR_QUALITY = 0.76;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/\s/g, "");
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  throw new Error("Could not decode image for upload.");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  throw new Error("Could not encode image for OCR.");
}

async function readManipulatedBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("Could not read bill photo.");
    }
    return arrayBufferToBase64(await response.arrayBuffer());
  }

  const buffer = await new File(uri).arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("Could not read bill photo.");
  }
  return arrayBufferToBase64(buffer);
}

async function compressToBase64(
  uri: string,
  maxDimension = IMAGE_MAX_DIMENSION,
  quality = IMAGE_QUALITY,
): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDimension } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  const base64 = manipulated.base64?.trim();
  if (base64) return base64;

  return readManipulatedBase64(manipulated.uri);
}

export async function compressOperationsPhoto(uri: string): Promise<ArrayBuffer> {
  const base64 = await compressToBase64(uri);
  return base64ToArrayBuffer(base64);
}

/** Compressed JPEG suitable for Gemini vision OCR. */
export async function compressOperationsPhotoToBase64(
  uri: string,
): Promise<{ base64: string; mimeType: string }> {
  const base64 = await compressToBase64(uri, OCR_MAX_DIMENSION, OCR_QUALITY);
  if (!base64.trim()) {
    throw new Error("Could not read bill photo for OCR.");
  }
  return {
    base64,
    mimeType: "image/jpeg",
  };
}
