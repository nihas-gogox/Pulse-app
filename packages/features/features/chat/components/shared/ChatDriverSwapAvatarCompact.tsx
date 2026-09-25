import type { DriverSwapPair } from "@pulse/domain/features/chat/utils/chatAvatar.util";
import { ArrowRight } from "lucide-react-native";
import { CHAT_ACCENT } from "@pulse/domain/features/chat/chatTheme";
import { View } from "react-native";
import { ChatPartyAvatar } from "../ChatPartyAvatar";
import {
  DRIVER_SWAP_NEXT_SIZE,
  DRIVER_SWAP_PREV_SIZE,
  driverSwapAvatarStyles as styles,
} from "@pulse/domain/features/chat/components/shared/chatDriverSwapAvatar.styles";

/** Static driver swap cluster for inbox / list previews (no animation). */
export function ChatDriverSwapAvatarCompact({ swap }: { swap: DriverSwapPair }) {
  return (
    <View style={styles.outer}>
      <View style={styles.shell}>
        <View style={styles.track} pointerEvents="none" />

        <View style={styles.prevSlot}>
          <View style={[styles.avatarRing, styles.prevRing]}>
            <ChatPartyAvatar identity={swap.previous} size={DRIVER_SWAP_PREV_SIZE} />
            <View style={styles.prevFrost} pointerEvents="none" />
          </View>
        </View>

        <View style={styles.arrowSlot}>
          <View style={styles.arrowPill}>
            <ArrowRight size={9} color={CHAT_ACCENT} strokeWidth={2.4} />
          </View>
        </View>

        <View style={styles.nextSlot}>
          <View style={[styles.avatarRing, styles.nextRing]}>
            <ChatPartyAvatar identity={swap.next} size={DRIVER_SWAP_NEXT_SIZE} />
          </View>
          <View style={styles.presenceDot} />
        </View>
      </View>
    </View>
  );
}
