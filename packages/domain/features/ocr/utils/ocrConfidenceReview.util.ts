/** Confidence tiers for Pulse Scan review UX. */
export const OCR_CONFIDENCE_AUTO_ACCEPT = 0.9;
export const OCR_CONFIDENCE_SUGGEST_MIN = 0.75;

export type OcrReviewAction = "auto_accept" | "suggest" | "manual_confirm";

export type OcrReviewDecision = {
  action: OcrReviewAction;
  confidence: number | null;
  label: string;
};

export function ocrReviewActionForConfidence(
  confidence: number | null | undefined,
): OcrReviewAction {
  if (confidence == null || !Number.isFinite(confidence) || confidence < OCR_CONFIDENCE_SUGGEST_MIN) {
    return "manual_confirm";
  }
  if (confidence >= OCR_CONFIDENCE_AUTO_ACCEPT) {
    return "auto_accept";
  }
  return "suggest";
}

export function ocrReviewDecision(confidence: number | null | undefined): OcrReviewDecision {
  const action = ocrReviewActionForConfidence(confidence);
  const labels: Record<OcrReviewAction, string> = {
    auto_accept: "High confidence — applied automatically",
    suggest: "Review suggested values before applying",
    manual_confirm: "Low confidence — enter details manually",
  };
  return {
    action,
    confidence: confidence ?? null,
    label: labels[action],
  };
}

/** Field-level gate for amount, GSTIN, invoice no, odometer KM, etc. */
export function shouldAutoApplyField(confidence: number | null | undefined): boolean {
  return ocrReviewActionForConfidence(confidence) === "auto_accept";
}

export function shouldSuggestField(confidence: number | null | undefined): boolean {
  return ocrReviewActionForConfidence(confidence) === "suggest";
}
