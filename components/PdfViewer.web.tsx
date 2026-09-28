import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Theme from "@/constants/Theme";

interface PdfViewerProps {
  pdfUri: string | null;
  style?: StyleProp<ViewStyle>;
  /** Browser PDF chrome. Off keeps the page itself in the frame. */
  showToolbar?: boolean;
  /** 1 = 100% of the file. The viewer does not fit-to-width on open. */
  zoom?: number;
  /**
   * `original` opens the PDF at that zoom (100% of the page).
   * `fit` scales the page to the frame, which is what the browser does by default.
   */
  sizing?: "original" | "fit";
  /** 1-based page. Omitted leaves the viewer on its default first page. */
  page?: number;
}

function isLocalPreviewUri(uri: string): boolean {
  return /^(blob:|data:|file:)/i.test(uri);
}

function withPdfViewerHash(
  uri: string,
  showToolbar: boolean,
  zoom: number,
  sizing: "original" | "fit",
  page?: number,
): string {
  if (uri.startsWith("data:")) return uri;
  const base = uri.split("#")[0];
  const toolbar = showToolbar ? "1" : "0";
  const percent = Math.max(10, Math.round(zoom * 100));
  // Numeric zoom with a page origin. Fit-to-width is what was opening notes at ~119%.
  const view = sizing === "original" ? `zoom=${percent},0,0` : "view=FitH";
  const pagePart = page && page > 0 ? `&page=${Math.round(page)}` : "";
  return `${base}#toolbar=${toolbar}&navpanes=0&scrollbar=1&${view}${pagePart}`;
}

export function PdfViewer({
  pdfUri,
  style,
  showToolbar = true,
  zoom = 1,
  sizing = "fit",
  page,
}: PdfViewerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfUri) {
      setSrc(null);
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    if (isLocalPreviewUri(pdfUri) || sizing === "original" || page != null) {
      // Keep the real https URL. Chrome drops #zoom and #page on blob: copies.
      setSrc(pdfUri);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSrc(null);

    void (async () => {
      try {
        const res = await fetch(pdfUri);
        if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setSrc(objectUrl);
        setLoading(false);
      } catch {
        if (cancelled) return;
        // CORS / network: still try the original URL in the iframe.
        setSrc(pdfUri);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUri, sizing, page]);

  if (!pdfUri) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <Text style={styles.message}>No PDF available for preview.</Text>
      </View>
    );
  }

  if (loading || !src) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator size="large" color={Theme.primary} />
        <Text style={styles.message}>Loading preview…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <iframe
        src={withPdfViewerHash(src, showToolbar, zoom, sizing, page)}
        key={`${page ?? 0}-${Math.round(zoom * 100)}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "none",
          background: Theme.surface,
          pointerEvents: "auto",
        }}
        title="PDF Preview"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 140,
    maxHeight: "100%",
    position: "relative",
    backgroundColor: Theme.surface,
    overflow: "hidden",
    zIndex: 0,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: 10,
    color: Theme.textSecondary,
    fontSize: 16,
    textAlign: "center",
  },
});
