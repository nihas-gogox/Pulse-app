/**
 * Logged-in driver’s face plate for the driver app.
 *
 * - Resolves signed photo / preset (including user-* seeds) via useDriverAvatarUri
 * - Transparent preset art sits on dark emerald (not pale muted green)
 */
import Theme from "@pulse/core/constants/Theme";
import { useAuth } from "@pulse/domain/contexts/AuthContext";
import { useOptionalDriverAvatar } from "@pulse/core/contexts/DriverAvatarContext";
import { resolveDriverAvatarImageSource } from "@pulse/core/constants/DriverLevels";
import { useDriverAvatarUri } from "@pulse/domain/lib/avatarUpload";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React from "react";
import {
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type Props = {
  size: number;
  /** Override resolved URI (e.g. local preview). */
  uri?: string | null;
  /** Prefer over AsyncStorage when set. */
  seed?: string | null;
  borderColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function DriverSelfAvatar({
  size,
  uri,
  seed,
  borderColor = Theme.driverEmerald,
  backgroundColor = Theme.driverEmerald,
  style,
}: Props) {
  const { profile } = useAuth();
  const { avatarUri } = useDriverAvatarUri();
  const ctx = useOptionalDriverAvatar();
  const effectiveUri = (uri ?? "").trim() || avatarUri;
  const effectiveSeed =
    (seed ?? "").trim() ||
    profile?.avatar_seed?.trim() ||
    ctx?.avatarSeed ||
    undefined;
  const source = resolveDriverAvatarImageSource(effectiveUri, effectiveSeed);
  const radius = size / 2;
  const iconSize = Math.max(12, Math.round(size * 0.38));

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor,
          backgroundColor,
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
        />
      ) : (
        <FontAwesome name="user" size={iconSize} color={Theme.cardWhite} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
