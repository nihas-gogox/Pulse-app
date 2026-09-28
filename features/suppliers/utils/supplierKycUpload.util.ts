import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

import {
  uploadSupplierKycFile,
  getSupplierKycSignedUrl,
} from "@/features/suppliers/services/supplierKycDocuments.service";
import type { SupplierKycDocType } from "@/features/suppliers/types/supplierManagement.types";

export type PickSupplierKycFileResult =
  | {
      status: "ok";
      file: {
        uri: string;
        mimeType: string;
        fileName: string;
        sizeBytes?: number;
      };
    }
  | { status: "cancelled" }
  | { status: "error"; error: Error };

export type UploadSupplierKycResult =
  | { status: "ok" }
  | { status: "cancelled" }
  | { status: "error"; error: Error };

function fail(message: string): PickSupplierKycFileResult {
  return { status: "error", error: new Error(message) };
}

export function notifySupplierKycUser(title: string, message: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error("Could not read the selected file.");
  }
  return res.arrayBuffer();
}

async function pickDocument(): Promise<PickSupplierKycFileResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return { status: "cancelled" };
    const a = res.assets[0];
    return {
      status: "ok",
      file: {
        uri: a.uri,
        mimeType: a.mimeType ?? "application/pdf",
        fileName: a.name || `vendor-kyc-${Date.now()}.pdf`,
        sizeBytes: a.size,
      },
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "File error.");
  }
}

export function pickSupplierKycFile(): Promise<PickSupplierKycFileResult> {
  if (Platform.OS === "web") {
    return pickDocument();
  }
  return new Promise((resolve) => {
    Alert.alert("Upload document", "Choose a source", [
      {
        text: "Camera",
        onPress: () => {
          void (async () => {
            try {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                resolve(fail("Camera access is needed."));
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                quality: 0.85,
              });
              if (res.canceled || !res.assets[0]) {
                resolve({ status: "cancelled" });
                return;
              }
              const a = res.assets[0];
              resolve({
                status: "ok",
                file: {
                  uri: a.uri,
                  mimeType: a.mimeType ?? "image/jpeg",
                  fileName: a.fileName ?? `vendor-kyc-${Date.now()}.jpg`,
                  sizeBytes: a.fileSize ?? undefined,
                },
              });
            } catch (err) {
              resolve(fail(err instanceof Error ? err.message : "Camera error."));
            }
          })();
        },
      },
      {
        text: "Gallery",
        onPress: () => {
          void (async () => {
            try {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                resolve(fail("Photo library access is needed."));
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.85,
              });
              if (res.canceled || !res.assets[0]) {
                resolve({ status: "cancelled" });
                return;
              }
              const a = res.assets[0];
              resolve({
                status: "ok",
                file: {
                  uri: a.uri,
                  mimeType: a.mimeType ?? "image/jpeg",
                  fileName: a.fileName ?? `vendor-kyc-${Date.now()}.jpg`,
                  sizeBytes: a.fileSize ?? undefined,
                },
              });
            } catch (err) {
              resolve(fail(err instanceof Error ? err.message : "Gallery error."));
            }
          })();
        },
      },
      {
        text: "PDF / File",
        onPress: () => {
          void pickDocument().then(resolve);
        },
      },
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => resolve({ status: "cancelled" }),
      },
    ], { cancelable: true, onDismiss: () => resolve({ status: "cancelled" }) });
  });
}

export async function pickAndUploadSupplierKycDocument(input: {
  orgId: string;
  supplierId: string;
  docType: SupplierKycDocType;
  docLabel?: string;
  docNumber?: string;
  isMandatory?: boolean;
  mode?: "replace" | "append";
}): Promise<UploadSupplierKycResult> {
  const picked = await pickSupplierKycFile();
  if (picked.status !== "ok") return picked;
  try {
    const arrayBuffer = await readBytes(picked.file.uri);
    const { error } = await uploadSupplierKycFile({
      orgId: input.orgId,
      supplierId: input.supplierId,
      docType: input.docType,
      docLabel: input.docLabel,
      docNumber: input.docNumber,
      isMandatory: input.isMandatory,
      mode: input.mode,
      file: {
        arrayBuffer,
        mimeType: picked.file.mimeType,
        fileName: picked.file.fileName,
      },
    });
    if (error) return { status: "error", error };
    return { status: "ok" };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err : new Error("Could not upload document."),
    };
  }
}

export async function openSupplierKycDocument(storagePath: string): Promise<void> {
  const { url, error } = await getSupplierKycSignedUrl(storagePath);
  if (error || !url) {
    notifySupplierKycUser("Cannot open file", error?.message ?? "Could not open document.");
    return;
  }
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await Linking.openURL(url);
}
