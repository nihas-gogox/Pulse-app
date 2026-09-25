import { StyleSheet } from "react-native";

import Theme from "@pulse/core/constants/Theme";
import { layout } from "@pulse/core/design-system/layout";
import { space } from "@pulse/core/design-system/spacing";

export const operationsEntryStyles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.screenBackground,
  },
  scroll: {
    flex: 1,
    // RN Web: without minHeight 0, ScrollView grows with content and
    // pushes the sticky footer below the overflow:hidden root clip.
    minHeight: 0,
  },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[2],
    gap: 10,
  },
  card: {
    gap: 12,
  },
  row2: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  row2Cell: {
    flex: 1,
    minWidth: 0,
  },
  metaHint: {
    fontSize: 10,
    fontWeight: "500",
    color: Theme.textMuted,
    lineHeight: 14,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Theme.text,
    backgroundColor: Theme.whiteMuted,
    fontSize: 13,
    minHeight: 40,
    lineHeight: 18,
  },
  notes: {
    minHeight: 56,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  fieldStack: {
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.borderLight,
    marginVertical: 2,
  },
  hint: {
    color: "#b45309",
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  footerBtn: {
    flex: 1,
    minWidth: 0,
  },
  photoWrap: {
    marginTop: 0,
  },
});
