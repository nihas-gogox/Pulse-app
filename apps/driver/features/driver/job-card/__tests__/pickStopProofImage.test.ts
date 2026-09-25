import { pickStopProofImage } from '../pickStopProofImage';

const mockRequestCamera = jest.fn();
const mockLaunchCamera = jest.fn();
const mockRequestLibrary = jest.fn();
const mockLaunchLibrary = jest.fn();
const mockCompress = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCamera(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCamera(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestLibrary(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
}));

jest.mock('../../../../lib/media/compressLocalImage.util', () => ({
  PROOF_IMAGE_PICKER_QUALITY: 0.65,
  compressLocalImageForUpload: (...args: unknown[]) => mockCompress(...args),
}));

describe('pickStopProofImage', () => {
  beforeEach(() => {
    mockRequestCamera.mockReset();
    mockLaunchCamera.mockReset();
    mockRequestLibrary.mockReset();
    mockLaunchLibrary.mockReset();
    mockCompress.mockReset();
    mockCompress.mockResolvedValue({ uri: 'file://compressed.jpg', mimeType: 'image/jpeg' });
  });

  it('captures with the camera and returns a compressed URI', async () => {
    mockRequestCamera.mockResolvedValue({ status: 'granted' });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://camera-original.jpg' }],
    });
    await expect(pickStopProofImage('camera')).resolves.toBe('file://compressed.jpg');
    expect(mockLaunchCamera).toHaveBeenCalled();
    expect(mockCompress).toHaveBeenCalledWith('file://camera-original.jpg');
    expect(mockLaunchLibrary).not.toHaveBeenCalled();
  });

  it('attaches from the library and returns a compressed URI', async () => {
    mockRequestLibrary.mockResolvedValue({ status: 'granted' });
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://library-original.jpg' }],
    });
    await expect(pickStopProofImage('library')).resolves.toBe('file://compressed.jpg');
    expect(mockLaunchLibrary).toHaveBeenCalled();
    expect(mockCompress).toHaveBeenCalledWith('file://library-original.jpg');
  });
});
