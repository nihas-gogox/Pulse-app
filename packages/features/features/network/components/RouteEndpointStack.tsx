import {
  routeEndpointLines,
} from "@pulse/domain/features/network/utils/storyDisplay";
import type { ReactNode } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

function titleCaseLocationLine(value: string): string {
  const t = value.trim();
  if (!t) return t;
  return t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function RouteEndpointStack({
  value,
  align = "start",
  primaryStyle,
  secondaryStyle,
  maxLinesPerItem = 3,
}: {
  value: string | null | undefined;
  align?: "start" | "end";
  primaryStyle: StyleProp<TextStyle>;
  secondaryStyle: StyleProp<TextStyle>;
  maxLinesPerItem?: number;
}): ReactNode {
  const lines = routeEndpointLines(value);
  const alignStyle =
    align === "end" ? ({ textAlign: "right", width: "100%" } as const) : undefined;
  return (
    <>
      {lines.map((line, index) => (
        <Text
          key={`${index}:${line}`}
          style={[index === 0 ? primaryStyle : secondaryStyle, alignStyle]}
          numberOfLines={maxLinesPerItem}
        >
          {titleCaseLocationLine(line)}
        </Text>
      ))}
    </>
  );
}
