import type { AnimationObject } from "lottie-react-native";

/**
 * The shape LottieView's `source` prop accepts: an inline animation JSON,
 * a remote `{ uri }`, or a URL string.
 * Use this instead of `object` so sources stay assignable to <LottieView>.
 */
export type LottieSource = AnimationObject | { uri: string } | string;
