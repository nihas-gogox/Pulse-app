import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { CHAT_ACCENT } from "@pulse/domain/features/chat/chatTheme";
import type { DriverSwapPair } from "@pulse/domain/features/chat/utils/chatAvatar.util";
import { ChatPartyAvatar } from "../ChatPartyAvatar";
import {
  DRIVER_SWAP_NEXT_SIZE,
  DRIVER_SWAP_PREV_SIZE,
  driverSwapAvatarStyles as styles,
} from "@pulse/domain/features/chat/components/shared/chatDriverSwapAvatar.styles";

export function ChatDriverSwapAvatar({ swap }: { swap: DriverSwapPair }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const swapProgress = useRef(new Animated.Value(0)).current;
  const arrowPulse = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    swapProgress.setValue(0);

    Animated.sequence([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(swapProgress, {
        toValue: 1,
        speed: 12,
        bounciness: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entrance, swapProgress, swap.previous.displayName, swap.next.displayName]);

  useEffect(() => {
    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(arrowPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const liveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 950,
          useNativeDriver: true,
        }),
      ]),
    );
    arrowLoop.start();
    liveLoop.start();
    return () => {
      arrowLoop.stop();
      liveLoop.stop();
    };
  }, [arrowPulse, livePulse]);

  const shellScale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const shellOpacity = entrance;

  const prevTranslateX = swapProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [10, 4, 0],
  });
  const prevOpacity = swapProgress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.45, 0.78],
  });
  const prevScale = swapProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 0.96],
  });

  const arrowOpacity = swapProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.55, 1],
  });
  const arrowTranslateX = Animated.add(
    swapProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [-4, 0],
    }),
    arrowPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 2],
    }),
  );
  const arrowScale = swapProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.55, 0.9, 1],
  });

  const nextTranslateX = swapProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [14, 5, 0],
  });
  const nextOpacity = swapProgress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.65, 1],
  });
  const nextScale = swapProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.78, 0.96, 1],
  });

  const ringOpacity = livePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0],
  });
  const ringScale = livePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          opacity: shellOpacity,
          transform: [{ scale: shellScale }],
        },
      ]}
    >
      <View style={styles.shell}>
        <View style={styles.track} pointerEvents="none" />

        <Animated.View
          style={[
            styles.prevSlot,
            {
              opacity: prevOpacity,
              transform: [{ translateX: prevTranslateX }, { scale: prevScale }],
            },
          ]}
        >
          <View style={[styles.avatarRing, styles.prevRing]}>
            <ChatPartyAvatar identity={swap.previous} size={DRIVER_SWAP_PREV_SIZE} />
            <View style={styles.prevFrost} pointerEvents="none" />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.arrowSlot,
            {
              opacity: arrowOpacity,
              transform: [{ translateX: arrowTranslateX }, { scale: arrowScale }],
            },
          ]}
        >
          <View style={styles.arrowPill}>
            <ArrowRight size={9} color={CHAT_ACCENT} strokeWidth={2.4} />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.nextSlot,
            {
              opacity: nextOpacity,
              transform: [{ translateX: nextTranslateX }, { scale: nextScale }],
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.newRingPulse,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <View style={[styles.avatarRing, styles.nextRing]}>
            <ChatPartyAvatar identity={swap.next} size={DRIVER_SWAP_NEXT_SIZE} />
          </View>
          <Animated.View
            style={[
              styles.presenceDot,
              {
                transform: [
                  {
                    scale: livePulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              },
            ]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
