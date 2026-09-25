import {
  CHAT_EMOJI_FONT_SIZES,
  chatEmojiLoopDurationMs,
  resolveChatEmojiMotion,
  type ChatEmojiSize,
} from "@pulse/domain/features/chat/utils/chatEmojiAnim.util";
import { useEffect } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type ChatAnimatedEmojiProps = {
  emoji: string;
  size?: ChatEmojiSize;
  /** Idle loop animation (pulse / flicker / bounce per emoji). */
  loop?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * Larger emoji glyph with subtle motion — used in composer panels, reactions, and hover toolbars.
 */
export function ChatAnimatedEmoji({
  emoji,
  size = "md",
  loop = true,
  style,
}: ChatAnimatedEmojiProps) {
  const progress = useSharedValue(0);
  const motion = resolveChatEmojiMotion(emoji);
  const fontSize = CHAT_EMOJI_FONT_SIZES[size];
  const half = chatEmojiLoopDurationMs(motion) / 2;

  useEffect(() => {
    if (!loop) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: half,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: half,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [emoji, half, loop, motion, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    let scale = 1;
    let rotate = 0;
    let translateY = 0;

    switch (motion) {
      case "flicker":
        scale = 1 + t * 0.16;
        rotate = (t - 0.5) * 12;
        translateY = -t * 2.5;
        break;
      case "heartbeat":
        scale = 1 + t * 0.14;
        translateY = -t * 1.5;
        break;
      case "bounce":
        translateY = -t * 5;
        scale = 1 + t * 0.08;
        break;
      case "wiggle":
        rotate = (t - 0.5) * 16;
        scale = 1 + t * 0.06;
        break;
      default:
        scale = 1 + t * 0.11;
    }

    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }, { translateY }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Text
        style={[
          {
            fontSize,
            lineHeight: Math.round(fontSize * 1.14),
          },
          style,
        ]}
      >
        {emoji}
      </Text>
    </Animated.View>
  );
}
