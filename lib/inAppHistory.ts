/**
 * In-app path stack for back navigation.
 *
 * Expo Router's `canGoBack()` is often false on web even after a real push,
 * so callers fall through to `router.replace(home)` and remount the trips
 * board (the app's starting page). This stack records pushes separately from
 * replaces so back can return to the screen that opened the current one.
 */

type Frame = { href: string; historyLength: number };

const stack: Frame[] = [];

function isBootHref(href: string): boolean {
  return href === "/" || href === "/index";
}

function readBrowserHref(pathname: string): string {
  const fromRouter = (pathname ?? "").trim() || "/";
  try {
    if (typeof window !== "undefined" && window.location?.pathname) {
      const locPath = window.location.pathname;
      if (locPath && locPath !== "/") {
        return `${locPath}${window.location.search || ""}`;
      }
    }
  } catch {
    // Native, or location unavailable.
  }
  return fromRouter;
}

function readHistoryLength(): number {
  try {
    if (typeof window !== "undefined" && typeof window.history?.length === "number") {
      return window.history.length;
    }
  } catch {
    // Native.
  }
  return -1;
}

/** Record the screen the user just landed on. */
export function noteInAppPath(pathname: string, historyLengthOverride?: number): void {
  const href = readBrowserHref(pathname);
  if (!href) return;

  const len = historyLengthOverride ?? readHistoryLength();
  const top = stack[stack.length - 1];
  if (top?.href === href) return;

  const earlier = stack.findIndex((frame) => frame.href === href);
  if (earlier >= 0 && earlier < stack.length - 1) {
    stack.splice(earlier + 1);
    return;
  }

  // Index boot (`/`) is not a page to return to. A later screen replaces it
  // even when the router push grows `history.length`.
  if (top && (isBootHref(top.href) || (len >= 0 && len <= top.historyLength))) {
    stack[stack.length - 1] = { href, historyLength: len };
    return;
  }

  stack.push({ href, historyLength: len });
}

export function hasInAppPrevious(): boolean {
  return peekInAppPrevious() != null;
}

/** Screen under the current one, ignoring the index boot route. */
export function peekInAppPrevious(): string | null {
  for (let i = stack.length - 2; i >= 0; i -= 1) {
    const href = stack[i]?.href;
    if (href && !isBootHref(href)) return href;
  }
  return null;
}

export function resetInAppHistory(): void {
  stack.length = 0;
}
