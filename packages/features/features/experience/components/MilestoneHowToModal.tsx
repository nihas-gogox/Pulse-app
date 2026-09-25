/**
 * How-to sheet for one experience roadmap level.
 */
import { PulsePillButton } from "@pulse/ui/components/PulsePillButton";
import Theme from "@pulse/core/constants/Theme";
import {
  getMilestoneGuide,
  type ExperienceLevelConfig,
  type ExperienceProgress,
  type MilestoneGuideActionKind,
  type MilestoneGuideAudience,
} from "@pulse/domain/features/experience/experienceProgress";
import { X } from "lucide-react-native";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MilestoneHowToModalProps = {
  visible: boolean;
  level: ExperienceLevelConfig | null;
  progress: ExperienceProgress;
  audience?: MilestoneGuideAudience;
  onClose: () => void;
  onAction?: (kind: MilestoneGuideActionKind) => void;
};

export function MilestoneHowToModal({
  visible,
  level,
  progress,
  audience = "driver",
  onClose,
  onAction,
}: MilestoneHowToModalProps) {
  const insets = useSafeAreaInsets();
  const guide = useMemo(
    () => (level ? getMilestoneGuide(level, progress, { audience }) : null),
    [level, progress, audience],
  );

  if (!guide) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadText}>
              <Text style={styles.kicker}>{guide.statusLabel.toUpperCase()}</Text>
              <Text style={styles.title}>{guide.title}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={Theme.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          <Text style={styles.goal}>{guide.goal}</Text>
          <Text style={styles.unlocks}>Unlocks {guide.unlocks}</Text>
          <Text style={styles.intro}>{guide.intro}</Text>

          {guide.lockedHint ? (
            <Text style={styles.locked}>{guide.lockedHint}</Text>
          ) : null}

          <Text style={styles.stepsLabel}>WHAT TO DO</Text>
          {guide.steps.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          {guide.action && onAction ? (
            <PulsePillButton
              label={guide.action.label}
              onPress={() => onAction(guide.action!.kind)}
              fullWidth
              style={styles.cta}
            />
          ) : (
            <PulsePillButton
              label="Got it"
              onPress={onClose}
              fullWidth
              variant="outline"
              style={styles.cta}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
  },
  card: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 22,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    zIndex: 2,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardHeadText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Theme.accentGold,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Theme.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  goal: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: Theme.textPrimary,
  },
  unlocks: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textSecondary,
  },
  intro: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: Theme.textSecondary,
  },
  locked: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: Theme.warning,
  },
  stepsLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Theme.textMuted,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Theme.brandBlueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.textPrimary,
  },
  stepText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
    color: Theme.textPrimary,
  },
  cta: { marginTop: 8 },
});
