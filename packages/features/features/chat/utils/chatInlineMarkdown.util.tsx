import React from "react";
import { Platform, Text, type TextStyle } from "react-native";

export const CHAT_MD_BOLD: TextStyle = { fontWeight: "700" };
export const CHAT_MD_ITALIC: TextStyle = { fontStyle: "italic" };
export const CHAT_MD_CODE: TextStyle = {
  fontFamily: Platform.select({
    web: "ui-monospace, SFMono-Regular, Menlo, monospace",
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
  backgroundColor: "rgba(0,0,0,0.06)",
  color: "#1D1C1D",
};

/**
 * Parses **bold**, _italic_, `code` with nested styles (e.g. `**_HI_**`).
 * Prefers bold/code before italic so markers inside bold spans resolve correctly.
 */
export function renderChatInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  if (!/\*\*|_|`/.test(text)) return [text];

  const re = /(\*\*([^*\n]+?)\*\*)|(`([^`\n]+?)`)|(_([^_\n]+?)_)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <Text key={k++} style={CHAT_MD_BOLD}>
          {renderChatInlineMarkdown(match[2])}
        </Text>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <Text key={k++} style={CHAT_MD_CODE}>
          {match[4]}
        </Text>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <Text key={k++} style={CHAT_MD_ITALIC}>
          {renderChatInlineMarkdown(match[6])}
        </Text>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Removes inline markdown markers (**bold**, _italic_, `code`) for plain-text previews. */
export function stripChatInlineMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/`([^`\n]+?)`/g, "$1")
    .replace(/_([^_\n]+?)_/g, "$1");
}

const HIDDEN_MARKER: TextStyle = { color: "transparent" };

/**
 * Composer overlay — keeps marker characters in the layout (invisible) so the
 * caret in the transparent TextInput stays aligned with the formatted preview.
 */
export function renderChatComposerPreview(text: string): React.ReactNode[] {
  if (!text) return [];
  if (!/\*\*|_|`/.test(text)) return [text];

  const re = /(\*\*([^*\n]+?)\*\*)|(`([^`\n]+?)`)|(_([^_\n]+?)_)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(<Text key={k++} style={HIDDEN_MARKER}>**</Text>);
      nodes.push(
        <Text key={k++} style={CHAT_MD_BOLD}>
          {renderChatComposerPreview(match[2])}
        </Text>,
      );
      nodes.push(<Text key={k++} style={HIDDEN_MARKER}>**</Text>);
    } else if (match[3] !== undefined) {
      nodes.push(<Text key={k++} style={HIDDEN_MARKER}>`</Text>);
      nodes.push(<Text key={k++} style={CHAT_MD_CODE}>{match[4]}</Text>);
      nodes.push(<Text key={k++} style={HIDDEN_MARKER}>`</Text>);
    } else if (match[5] !== undefined) {
      nodes.push(<Text key={k++} style={HIDDEN_MARKER}>_</Text>);
      nodes.push(
        <Text key={k++} style={CHAT_MD_ITALIC}>
          {renderChatComposerPreview(match[6])}
        </Text>,
      );
      nodes.push(<Text key={k++} style={HIDDEN_MARKER}>_</Text>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Pending toolbar toggles only — styles full value without extra marker width. */
export function renderChatComposerPendingPreview(
  text: string,
  pending: { bold?: boolean; italic?: boolean; code?: boolean },
): React.ReactNode[] {
  if (!text) return [];
  if (pending.code) return [<Text style={CHAT_MD_CODE}>{text}</Text>];
  if (pending.bold) return [<Text style={CHAT_MD_BOLD}>{text}</Text>];
  if (pending.italic) return [<Text style={CHAT_MD_ITALIC}>{text}</Text>];
  return [text];
}
