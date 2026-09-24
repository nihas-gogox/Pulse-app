export type ChatPendingFormat = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

export function getChatFormatMarker(fmt: keyof ChatPendingFormat): string {
  if (fmt === "bold") return "**";
  if (fmt === "italic") return "_";
  return "`";
}

export function isChatMarkdownWrapped(text: string, marker: string): boolean {
  return (
    text.length >= marker.length * 2 &&
    text.startsWith(marker) &&
    text.endsWith(marker)
  );
}

/** Virtual markdown for composer live preview (pending toggles + existing markers). */
export function getComposerMarkdownPreviewSource(
  text: string,
  pending: ChatPendingFormat,
): string {
  if (!text) return text;

  let out = text;
  if (pending.code && !isChatMarkdownWrapped(out, "`")) out = `\`${out}\``;
  if (pending.bold && !isChatMarkdownWrapped(out, "**")) out = `**${out}**`;
  if (pending.italic && !isChatMarkdownWrapped(out, "_")) out = `_${out}_`;
  return out;
}

export function shouldShowComposerMarkdownPreview(
  text: string,
  pending: ChatPendingFormat,
): boolean {
  if (!text) return false;
  if (pending.bold || pending.italic || pending.code) return true;
  return /\*\*|_|`/.test(text);
}

/** Wrap outgoing composer text with any active format toggles (B / I / code). */
export function finalizeOutgoingMarkdown(
  text: string,
  pending: ChatPendingFormat,
): string {
  let out = text.trim();
  if (!out) return out;

  if (pending.code && !isChatMarkdownWrapped(out, "`")) out = `\`${out}\``;
  if (pending.bold && !isChatMarkdownWrapped(out, "**")) out = `**${out}**`;
  if (pending.italic && !isChatMarkdownWrapped(out, "_")) out = `_${out}_`;
  return out;
}

/** Toggle markdown markers on the full composer value (wrap / unwrap). */
export function toggleMarkdownFormat(
  text: string,
  fmt: keyof ChatPendingFormat,
): { nextText: string; active: boolean } {
  const marker = getChatFormatMarker(fmt);
  const trimmed = text.trim();

  if (!trimmed) {
    return { nextText: text, active: false };
  }

  const stripped = trimmed.split(marker).join("");
  if (stripped !== trimmed) {
    return { nextText: stripped, active: false };
  }

  return { nextText: `${marker}${trimmed}${marker}`, active: true };
}
