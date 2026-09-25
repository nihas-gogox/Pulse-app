import Theme from "@pulse/core/constants/Theme";
import React, { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type WebViewProps = ComponentProps<
  typeof import("react-native-webview").WebView
>;

type NativeHtmlWebViewProps = {
  html?: string;
  uri?: string;
  style?: StyleProp<ViewStyle>;
  startInLoadingState?: WebViewProps["startInLoadingState"];
  /**
   * Document-preview mode: fit content to width and allow pinch zoom
   * (payment request / PDF-style HTML viewers).
   */
  docPreview?: boolean;
  /** A8.7: bridge for a page that calls window.ReactNativeWebView.postMessage(...). */
  onMessage?: WebViewProps["onMessage"];
};

let WebViewComponent: React.ComponentType<WebViewProps> | null = null;
let webViewLoadPromise: Promise<void> | null = null;

function loadWebView(): Promise<void> {
  if (WebViewComponent) return Promise.resolve();
  if (!webViewLoadPromise) {
    webViewLoadPromise = import("react-native-webview").then((mod) => {
      WebViewComponent = mod.WebView;
    });
  }
  return webViewLoadPromise;
}

/** Ensure HTML can fit screen width and accept pinch zoom. */
function withDocPreviewViewport(html: string): string {
  const viewport =
    '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=0.5, maximum-scale=4, user-scalable=yes" />';
  const fitCss = `<style id="pulse-doc-preview-fit">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; background: #ffffff !important; }
    body { -webkit-text-size-adjust: 100%; }
    .page { padding: 10px 8px 14px !important; max-width: 100% !important; box-sizing: border-box !important; }
    .doc { max-width: 100% !important; }
    img, table { max-width: 100% !important; }
  </style>`;

  if (/<meta[^>]+name=["']viewport["']/i.test(html)) {
    return html
      .replace(
        /<meta[^>]+name=["']viewport["'][^>]*>/i,
        viewport,
      )
      .replace(/<\/head>/i, `${fitCss}</head>`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${viewport}${fitCss}`);
  }
  return `<!doctype html><html><head>${viewport}${fitCss}</head><body>${html}</body></html>`;
}

/** Native-only WebView wrapper (lazy, single import site). */
export function NativeHtmlWebView({
  html,
  uri,
  style,
  startInLoadingState,
  docPreview = false,
  onMessage,
}: NativeHtmlWebViewProps) {
  const [ready, setReady] = useState(() => WebViewComponent != null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void loadWebView().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedHtml = useMemo(() => {
    if (html == null) return undefined;
    return docPreview ? withDocPreviewViewport(html) : html;
  }, [html, docPreview]);

  if (Platform.OS === "web") return null;

  if (!ready || !WebViewComponent) {
    return (
      <View style={[styles.loading, style]}>
        <ActivityIndicator color={Theme.primary} />
      </View>
    );
  }

  const WebView = WebViewComponent;
  const source =
    resolvedHtml != null
      ? { html: resolvedHtml }
      : uri != null
        ? { uri }
        : { html: "" };

  return (
    <WebView
      originWhitelist={["*"]}
      source={source}
      style={style}
      showsVerticalScrollIndicator
      showsHorizontalScrollIndicator={docPreview}
      nestedScrollEnabled
      startInLoadingState={startInLoadingState}
      // Document preview: pinch-zoom + fit-to-width
      scalesPageToFit={docPreview || undefined}
      setBuiltInZoomControls={docPreview || undefined}
      setDisplayZoomControls={false}
      javaScriptEnabled
      onMessage={onMessage}
      bounces={docPreview}
      {...(docPreview
        ? {
            // iOS WebKit: allow user scaling beyond default
            allowsInlineMediaPlayback: true,
            automaticallyAdjustContentInsets: false,
            contentInsetAdjustmentBehavior: "never" as const,
          }
        : null)}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.surface,
  },
});
