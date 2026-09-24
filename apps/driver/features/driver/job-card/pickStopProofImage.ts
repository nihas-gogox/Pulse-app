import * as ImagePicker from 'expo-image-picker';
import {
  compressLocalImageForUpload,
  PROOF_IMAGE_PICKER_QUALITY,
} from '../../../lib/media/compressLocalImage.util';

export type StopProofImageSource = 'camera' | 'library';

/**
 * Capture or attach a proof photo, then resize + JPEG-compress it so the
 * draft URI is already a small file (longest edge 1024, quality ~0.75).
 */
export async function pickStopProofImage(source: StopProofImageSource): Promise<string | null> {
  const rawUri = source === 'camera' ? await captureCamera() : await attachLibrary();
  if (!rawUri) return null;
  const compressed = await compressLocalImageForUpload(rawUri);
  return compressed.uri;
}

async function captureCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Camera permission is required');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: PROOF_IMAGE_PICKER_QUALITY,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

async function attachLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Photo library permission is required');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: PROOF_IMAGE_PICKER_QUALITY,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}
