export const BILL_SCAN_PIPELINE_STEPS = [
  { id: "prepare", label: "Photo" },
  { id: "read", label: "Read" },
  { id: "extract", label: "Extract" },
  { id: "apply", label: "Apply" },
] as const;

export const BILL_SCAN_ANALYZING_MESSAGES = [
  "Reading receipt layout…",
  "Extracting amount & totals…",
  "Detecting city & vendor…",
  "Matching category & payment…",
  "Validating extracted fields…",
] as const;
