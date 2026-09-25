import { Alert, Platform } from "react-native";

import type { OcrJobRow } from "../types/ocr.types";
import { ocrReviewDecision } from "./ocrConfidenceReview.util";

function scanLabel(job: OcrJobRow): string {
  switch (job.source_kind) {
    case "odometer":
      return "Odometer scan";
    case "expense_receipt":
      return "Receipt scan";
    case "pod_document":
      return "Document scan";
    default:
      return "Pulse Scan";
  }
}

/** Lightweight in-app notification when background OCR completes. */
export async function notifyOcrJobComplete(job: OcrJobRow): Promise<void> {
  const title = scanLabel(job);
  if (job.status === "failed") {
    Alert.alert(title, job.error_message ?? "Scan failed. Enter details manually.");
    return;
  }
  if (job.status !== "completed") return;

  const review = ocrReviewDecision(job.confidence_score);
  const body =
    review.action === "auto_accept"
      ? "Scan complete — values ready to review."
      : review.label;

  if (Platform.OS === "web") {
    return;
  }

  try {
    const Notifications = await import("expo-notifications");
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    Alert.alert(title, body);
  }
}
