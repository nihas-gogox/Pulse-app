import { TripFeedbackModal } from "@pulse/ui/components/TripFeedbackModal";
import { ChatFeedbackCard } from "../ChatFeedbackCard";
import type { TripMessageRow } from "@pulse/domain/features/chat/types/chat.types";
import Theme from "@pulse/core/constants/Theme";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export function DriverShipperFeedbackModal({
  visible,
  onClose,
  tripId,
  message = null,
  targetName,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  message?: TripMessageRow | null;
  targetName: string;
  onSubmitted?: () => void;
}) {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmitted = useCallback(() => {
    onSubmitted?.();
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, 1100);
  }, [onClose, onSubmitted]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <TripFeedbackModal visible={visible} onRequestClose={onClose}>
      <View style={styles.inner}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close rating"
        >
          <X size={18} color={Theme.textPrimaryDark} strokeWidth={2.2} />
        </TouchableOpacity>
        {visible && tripId ? (
          <ChatFeedbackCard
            key={`${tripId}:${message?.id ?? "none"}`}
            message={message}
            tripId={tripId}
            audience="driver"
            targetNameOverride={targetName}
            presentation="modal"
            onSubmitted={handleSubmitted}
          />
        ) : null}
      </View>
    </TripFeedbackModal>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: "relative",
    width: "100%",
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.whiteMuted,
  },
});
