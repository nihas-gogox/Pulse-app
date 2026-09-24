/**
 * Deep link handling for roster driver invites: pulse://driver-invite?token={uuid}
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { consumeDriverInvite } from '../features/drivers/services/drivers.service';

export const PENDING_DRIVER_INVITE_STORAGE_KEY = 'pulse.pending_driver_invite_id';

const INVITE_PATH = 'driver-invite';

export function parseDriverInviteTokenFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? '').replace(/^\/+/, '');
    if (path !== INVITE_PATH && !path.endsWith(`/${INVITE_PATH}`)) {
      return null;
    }
    const token =
      typeof parsed.queryParams?.token === 'string'
        ? parsed.queryParams.token.trim()
        : Array.isArray(parsed.queryParams?.token)
          ? String(parsed.queryParams.token[0] ?? '').trim()
          : '';
    return token || null;
  } catch {
    return null;
  }
}

export async function storePendingDriverInvite(inviteId: string): Promise<void> {
  const trimmed = inviteId.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(PENDING_DRIVER_INVITE_STORAGE_KEY, trimmed);
}

export async function getPendingDriverInvite(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_DRIVER_INVITE_STORAGE_KEY);
  const trimmed = raw?.trim();
  return trimmed || null;
}

export async function clearPendingDriverInvite(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_DRIVER_INVITE_STORAGE_KEY);
}

export type ConsumePendingInviteResult =
  | { status: 'none' }
  | { status: 'success' }
  | { status: 'failed'; error: string };

/** Consume stored invite after auth; clears storage on success or hard failure. */
export async function consumePendingDriverInviteAfterAuth(): Promise<ConsumePendingInviteResult> {
  const inviteId = await getPendingDriverInvite();
  if (!inviteId) return { status: 'none' };

  const { success, error } = await consumeDriverInvite(inviteId);
  if (success) {
    await clearPendingDriverInvite();
    return { status: 'success' };
  }

  const message = error?.message ?? 'Invite expired or already used';
  if (/expired|already|not found|invalid/i.test(message)) {
    await clearPendingDriverInvite();
  }
  return { status: 'failed', error: message };
}

export function buildDriverInviteDeepLink(inviteId: string): string {
  return Linking.createURL('driver-invite', { queryParams: { token: inviteId } });
}

/** Register listener + handle cold-start URL. Returns cleanup. */
export function installDriverInviteDeepLinkListener(
  onStored?: (inviteId: string) => void,
): () => void {
  const handleUrl = (url: string | null | undefined) => {
    const token = url ? parseDriverInviteTokenFromUrl(url) : null;
    if (!token) return;
    void storePendingDriverInvite(token).then(() => onStored?.(token));
  };

  void Linking.getInitialURL().then(handleUrl);
  const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
  return () => sub.remove();
}
