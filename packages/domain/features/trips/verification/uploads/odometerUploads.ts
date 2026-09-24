import * as tripDocumentsService from "../../services/tripDocuments.service";
import { compressOperationsPhoto } from "../../operations/uploads/photoUploads";

import type { VerificationSide } from "../types";

export function verificationPhotoType(
  side: VerificationSide,
): tripDocumentsService.TripDocumentType {
  return side === "start" ? "odometer_start_photo" : "odometer_end_photo";
}

export async function uploadVerificationPhoto(params: {
  tripId: string;
  userId: string;
  side: VerificationSide;
  localUri: string;
}) {
  const arrayBuffer = await compressOperationsPhoto(params.localUri);
  return tripDocumentsService.uploadTripDocument(
    params.tripId,
    params.userId,
    {
      arrayBuffer,
      fileName: `odometer-${params.side}-${Date.now()}.jpg`,
      mimeType: "image/jpeg",
    },
    verificationPhotoType(params.side),
  );
}
