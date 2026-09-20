/**
 * Covers the 06e1f2a4 regression: a guard added to the shared useDocumentPreview
 * hook (originally meant to skip opening compliance's place-only .txt PODs)
 * made every .txt/text-* attachment across chat, support tickets, and trip
 * detail's vault preview silently no-op. Compliance itself never routes
 * place-only PODs through this shared hook (it short-circuits earlier via
 * describeStopProofDocument), so the guard only ever broke unrelated
 * consumers. These tests prove text attachments open normally again, while
 * images still take the lightbox path.
 */
import { renderHook, act } from "@testing-library/react-native";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useDocumentPreview } from "../DocumentPreviewModal";

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
  WebBrowserPresentationStyle: { PAGE_SHEET: "PAGE_SHEET" },
}));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("lucide-react-native", () => ({ X: "X" }));

describe("useDocumentPreview — text/plain and .txt attachments", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("opens a .txt attachment via the browser on native, instead of silently no-op'ing", async () => {
    Platform.OS = "ios";
    const { result } = renderHook(() => useDocumentPreview());

    await act(async () => {
      await result.current.open("https://example.com/note.txt", "text/plain", "note.txt");
    });

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://example.com/note.txt",
      expect.objectContaining({ presentationStyle: "PAGE_SHEET" }),
    );
  });

  it("opens a text/* mime attachment via the browser even without a .txt extension", async () => {
    Platform.OS = "ios";
    const { result } = renderHook(() => useDocumentPreview());

    await act(async () => {
      await result.current.open("https://example.com/log", "text/csv", "log");
    });

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
  });

  it("still opens an image in the in-app lightbox, not the browser", async () => {
    Platform.OS = "ios";
    const { result } = renderHook(() => useDocumentPreview());

    await act(async () => {
      await result.current.open("https://example.com/pod.jpg", "image/jpeg", "pod.jpg");
    });

    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});
