declare module "@/components/PdfViewer" {
  import { FunctionComponent } from "react";
    import type { StyleProp, ViewStyle } from "react-native";

  interface PdfViewerProps {
    pdfUri: string | null;
    style?: StyleProp<ViewStyle>;
    showToolbar?: boolean;
    /** 1 = 100% of the file. */
    zoom?: number;
    sizing?: "original" | "fit";
    page?: number;
  }

  export const PdfViewer: FunctionComponent<PdfViewerProps>;
}
