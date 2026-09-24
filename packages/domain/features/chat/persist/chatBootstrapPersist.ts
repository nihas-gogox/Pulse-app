/**
 * Lightweight chat bootstrap cache (conversation summaries only, no message bodies).
 * Survives cold start; network bootstrap remains authoritative when online.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TripConversation } from "../types/chat.types";

const STORAGE_KEY = "pulse-chat-bootstrap-summaries-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ChatBootstrapPersistPayload {
  orgId: string;
  savedAt: number;
  conversations: TripConversation[];
}

function stripBodies(conversations: TripConversation[]): TripConversation[] {
  return conversations.map((c) => ({ ...c, messages: [] }));
}

export async function persistChatBootstrapSummaries(
  orgId: string,
  conversations: TripConversation[],
): Promise<void> {
  if (!orgId.trim()) return;
  try {
    const payload: ChatBootstrapPersistPayload = {
      orgId: orgId.trim(),
      savedAt: Date.now(),
      conversations: stripBodies(conversations),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

export async function loadChatBootstrapSummaries(
  orgId: string,
): Promise<TripConversation[] | null> {
  if (!orgId.trim()) return null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatBootstrapPersistPayload;
    if (parsed.orgId !== orgId.trim()) return null;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      return null;
    }
    if (!Array.isArray(parsed.conversations)) return null;
    return stripBodies(parsed.conversations as TripConversation[]);
  } catch {
    return null;
  }
}

export async function clearChatBootstrapSummaries(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
