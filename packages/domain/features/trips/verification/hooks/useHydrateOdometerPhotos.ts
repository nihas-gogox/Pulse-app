import { useEffect } from "react";

import { loadPersistedOcrJob } from "../../../ocr";
import * as tripDocumentsService from "../../services/tripDocuments.service";

import { useTripVerificationPhotos } from "../queries/useTripVerification";

type Side = "start" | "end";

type Options = {
  tripId: string;
  setStartPhotoUri: (uri: string | null) => void;
  setEndPhotoUri: (uri: string | null) => void;
  /** Load persisted OCR from DB only — never runs Gemini. */
  onPersistedOcrLoaded?: (side: Side, tripDocumentId: string) => void;
  startHasLocalPhoto?: boolean;
  endHasLocalPhoto?: boolean;
};

/** Load saved odometer photos + link to persisted OCR jobs (read-only). */
export function useHydrateOdometerPhotos({
  tripId,
  setStartPhotoUri,
  setEndPhotoUri,
  onPersistedOcrLoaded,
  startHasLocalPhoto = false,
  endHasLocalPhoto = false,
}: Options) {
  const photosQuery = useTripVerificationPhotos(tripId);

  useEffect(() => {
    const docs = photosQuery.data;
    if (!docs?.length) return;

    const hydrateSide = async (side: Side, hasLocal: boolean, setUri: (uri: string | null) => void) => {
      if (hasLocal) return;
      const type = side === "start" ? "odometer_start_photo" : "odometer_end_photo";
      const doc = docs.find((d) => d.document_type === type);
      if (!doc?.storage_path) return;
      const url = await tripDocumentsService.getDocumentViewUrl(doc.storage_path);
      if (url) setUri(url);

      const jobId = (doc as { ocr_job_id?: string | null }).ocr_job_id;
      if (jobId) {
        onPersistedOcrLoaded?.(side, doc.id);
        return;
      }
      const job = await loadPersistedOcrJob(doc.id);
      if (job?.status === "completed") {
        onPersistedOcrLoaded?.(side, doc.id);
      }
    };

    void Promise.all([
      hydrateSide("start", startHasLocalPhoto, setStartPhotoUri),
      hydrateSide("end", endHasLocalPhoto, setEndPhotoUri),
    ]);
  }, [
    endHasLocalPhoto,
    onPersistedOcrLoaded,
    photosQuery.data,
    setEndPhotoUri,
    setStartPhotoUri,
    startHasLocalPhoto,
  ]);
}
