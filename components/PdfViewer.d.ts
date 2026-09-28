declare module "@/components/PdfViewer" {
  import { FunctionComponent } from "react";
    import type { StyleProp, ViewStyle } from "react-native";

  interface PdfViewerProps {
    pdfUri: string | null;
    style?: StyleProp<ViewStyle>;
  }

  export const PdfViewer: FunctionComponent<PdfViewerProps>;
}
