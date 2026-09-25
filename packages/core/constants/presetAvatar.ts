/**
 * Shared preset-avatar types and URI resolution (no catalog data).
 * Keeps DriverLevels ↔ UserAvatars free of circular imports.
 */

import { Asset } from 'expo-asset';
import { Image, Platform, type ImageSourcePropType } from 'react-native';

export type PresetAvatar = { name: string; seed: string; image: ImageSourcePropType };

function absolutizeWebUri(uri: string): string {
  if (
    typeof window !== 'undefined' &&
    uri.startsWith('/') &&
    !uri.startsWith('//')
  ) {
    return `${window.location.origin}${uri}`;
  }
  return uri;
}

/** URI for a preset (from bundled asset). Works on native and react-native-web. */
export function getPresetAvatarUri(av: PresetAvatar): string {
  const source = av.image as ImageSourcePropType;
  if (!source) return '';

  if (typeof source === 'number') {
    try {
      const asset = Asset.fromModule(source);
      const uri = (asset?.uri ?? asset?.localUri ?? '').trim();
      if (uri) return absolutizeWebUri(uri);
    } catch {
      // fall through
    }
  }

  if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
    if ('uri' in source) {
      const uri = typeof source.uri === 'string' ? source.uri.trim() : '';
      if (uri) return absolutizeWebUri(uri);
    }
    const mod = source as { default?: unknown };
    if (typeof mod.default === 'string' && mod.default.trim()) {
      return absolutizeWebUri(mod.default.trim());
    }
    if (typeof mod.default === 'number') {
      try {
        const asset = Asset.fromModule(mod.default);
        const uri = (asset?.uri ?? asset?.localUri ?? '').trim();
        if (uri) return absolutizeWebUri(uri);
      } catch {
        // fall through
      }
    }
  }

  if (
    Platform.OS !== 'web' &&
    typeof Image.resolveAssetSource === 'function'
  ) {
    const resolved = Image.resolveAssetSource(source);
    if (resolved?.uri) {
      return absolutizeWebUri(resolved.uri.trim());
    }
  }

  return '';
}
