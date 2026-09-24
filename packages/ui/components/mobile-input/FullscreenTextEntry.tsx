/**
 * Full-screen multiline text entry (notes / remarks).
 * Mirrors FullscreenNumericEntry chrome: close, title, Done apply.
 */
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Theme from "@pulse/core/constants/Theme";

export type FullscreenTextEntryProps = {
  visible: boolean;
  onClose: () => void;
  /** Called with trimmed text when user taps Done. */
  onSubmit: (value: string) => void;
  initialValue?: string;
  label?: string;
  contextLine?: string;
  placeholder?: string;
  submitLabel?: string;
  maxLength?: number;
};

export function FullscreenTextEntry({
  visible,
  onClose,
  onSubmit,
  initialValue = "",
  label = "Notes",
  contextLine,
  placeholder = "Add a note…",
  submitLabel = "Done",
  maxLength = 500,
}: FullscreenTextEntryProps) {
  const insets = useSafeAreaInsets();
  const [raw, setRaw] = useState(initialValue);

  useEffect(() => {
    if (visible) setRaw(initialValue);
  }, [visible, initialValue]);

  const handleSubmit = useCallback(() => {
    onSubmit(raw.trim());
  }, [onSubmit, raw]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: Theme.surface }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <Text style={styles.headerLabel} numberOfLines={1}>
              {label}
            </Text>
            {contextLine ? (
              <Text style={styles.headerContext} numberOfLines={1}>
                {contextLine}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.headerBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
          >
            <Text style={styles.doneText}>{submitLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <TextInput
            value={raw}
            onChangeText={setRaw}
            placeholder={placeholder}
            placeholderTextColor={Theme.textMuted}
            multiline
            autoFocus
            maxLength={maxLength}
            textAlignVertical="top"
            style={[
              styles.input,
              {
                color: Theme.textPrimaryDark,
                backgroundColor: Theme.cardWhite,
                borderColor: Theme.borderLight,
              },
            ]}
            accessibilityLabel={label}
          />
          <Text style={styles.counter}>
            {raw.trim().length}/{maxLength}
          </Text>
        </View>

        <View style={{ height: Math.max(insets.bottom, 12) }} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
    gap: 8,
  },
  headerBtn: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: "center",
  },
  headerMid: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.2,
  },
  headerContext: {
    fontSize: 10,
    fontWeight: "500",
    color: Theme.textMuted,
    letterSpacing: 0.1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  doneText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.driverEmerald,
    textAlign: "right",
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: 10,
    fontWeight: "500",
    color: Theme.textMuted,
    paddingBottom: 4,
  },
});
