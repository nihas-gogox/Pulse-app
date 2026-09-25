import Constants from "expo-constants";

/** Resolve Gemini key from Expo public env, Vite legacy env, or app.config extra. */
export function resolveGeminiApiKey(): string {
  const fromProcess =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ||
    process.env.VITE_GEMINI_API_KEY?.trim() ||
    "";

  if (fromProcess) return fromProcess;

  const extra = Constants.expoConfig?.extra as { geminiApiKey?: string } | undefined;
  const fromExtra = extra?.geminiApiKey?.trim();
  return fromExtra ?? "";
}

export function requireGeminiApiKey(): string {
  const key = resolveGeminiApiKey();
  if (!key) {
    throw new Error(
      "Missing Gemini API key. Set EXPO_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env and restart Expo.",
    );
  }
  return key;
}
