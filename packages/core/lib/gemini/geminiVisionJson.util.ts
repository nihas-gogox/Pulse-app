import { requireGeminiApiKey } from "./resolveGeminiApiKey.util";

const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

type GenerateVisionJsonOptions = {
  prompt: string;
  base64: string;
  mimeType: string;
  models?: readonly string[];
  timeoutMs?: number;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function extractResponseText(payload: GeminiGenerateResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("").trim();
}

async function generateWithModel(
  apiKey: string,
  model: string,
  options: GenerateVisionJsonOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: options.prompt },
              {
                inline_data: {
                  mime_type: options.mimeType,
                  data: options.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          topK: 10,
        },
      }),
    });

    const payload = (await response.json()) as GeminiGenerateResponse;

    if (!response.ok) {
      const message =
        payload.error?.message ||
        `Gemini request failed (${response.status} ${response.statusText})`;
      throw new Error(message);
    }

    const text = extractResponseText(payload);
    if (!text) throw new Error("Empty response from Gemini vision model");
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OCR timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key not valid|invalid.*api.*key|403|PERMISSION_DENIED/i.test(msg)) {
    return "Invalid or missing Gemini API key.";
  }
  if (/quota|rate limit|429|resource exhausted/i.test(msg)) {
    return "OCR rate limit exceeded. Try again in a few minutes.";
  }
  if (/timeout|deadline|AbortError/i.test(msg)) {
    return "OCR request timed out. Try again or enter details manually.";
  }
  if (/blocked|safety|content/i.test(msg)) {
    return "Bill image could not be processed.";
  }
  return msg;
}

/** Call Gemini vision REST API and return raw JSON text from the model. */
export async function generateGeminiVisionJson(
  options: GenerateVisionJsonOptions,
): Promise<{ text: string; model: string }> {
  const apiKey = requireGeminiApiKey();
  const models = options.models ?? DEFAULT_MODELS;

  let lastError: unknown;
  for (const model of models) {
    try {
      const text = await generateWithModel(apiKey, model, options);
      return { text, model };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(normalizeGeminiError(lastError));
}
