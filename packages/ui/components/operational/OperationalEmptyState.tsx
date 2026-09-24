import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors } from '@/design-system/colors';
import { space } from '@/design-system/spacing';
import { typography } from '@/design-system/typography';
import { OperationalButton, type OperationalButtonIntent } from './OperationalButton';
import { useOperationalDensity, type DensityTier } from './useOperationalDensity';

export interface OperationalEmptyStateAction {
  label: string;
  intent?: OperationalButtonIntent;
  onPress: () => void;
}

export interface OperationalEmptyStateProps {
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  description: string;
  /** Primary operational next step */
  primaryAction?: OperationalEmptyStateAction;
  /** Recovery / alternate path */
  secondaryAction?: OperationalEmptyStateAction;
  density?: DensityTier;
  style?: StyleProp<ViewStyle>;
}

export const OperationalEmptyState = memo(function OperationalEmptyState({
  icon = 'inbox',
  title,
  description,
  primaryAction,
  secondaryAction,
  density: densityTier = 'low',
  style,
}: OperationalEmptyStateProps) {
  const d = useOperationalDensity(densityTier);

  return (
    <View style={[styles.wrap, { paddingVertical: d.sectionGap }, style]}>
      <View style={styles.iconWrap}>
        <FontAwesome name={icon} size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {primaryAction ? (
        <View style={styles.actions}>
          <OperationalButton
            intent={primaryAction.intent ?? 'primary'}
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            fullWidth
            density={densityTier}
          />
        </View>
      ) : null}
      {secondaryAction ? (
        <OperationalButton
          intent={secondaryAction.intent ?? 'utility'}
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          fullWidth
          density={densityTier}
          style={styles.secondaryBtn}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space[6],
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[4],
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: space[2],
  },
  description: {
    ...typography.caption,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    marginTop: space[5],
  },
  secondaryBtn: {
    marginTop: space[3],
    maxWidth: 320,
    width: '100%',
  },
});
