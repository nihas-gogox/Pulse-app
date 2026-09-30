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
}

function isLocalPreviewUri(uri: string): boolean {
  return /^(blob:|data:|file:)/i.test(uri);
}

function withPdfViewerHash(uri: string): string {
  if (uri.includes("#") || uri.startsWith("data:")) return uri;
  return `${uri}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
}

export function PdfViewer({ pdfUri, style }: PdfViewerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfUri) {
      setSrc(null);
      setLoading(false);
      return;
    }

    if (isLocalPreviewUri(pdfUri)) {
      setSrc(pdfUri);
      setLoading(false);
      return;
    }

    // Signed storage URLs render directly. Downloading the file into a blob
    // first held the preview on a spinner for the whole transfer.
    setSrc(withPdfViewerHash(pdfUri));
    setLoading(false);
  }, [pdfUri]);

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
        src={withPdfViewerHash(src)}
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
