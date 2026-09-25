import { StyleSheet, Text, View } from 'react-native';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { ITEM_LEVEL_DELIVERY_PERSISTED } from '../stopVerificationSummary';
import type { StopVerificationTotals } from '../stopVerificationSummary';
import { expectedQtyLabel } from '../stopVerificationSummary';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  delivery: boolean;
  totals: StopVerificationTotals;
};

export function DeliveryCompletionSummary({ colors, delivery, totals }: Props) {
  if (!delivery) {
    return (
      <View
        testID="pickup-completion-summary"
        style={[styles.box, { borderColor: colors.emeraldBorder, backgroundColor: colors.emeraldMuted }]}
      >
        <Text style={[styles.title, { color: colors.emerald }]}>Ready to confirm pickup</Text>
        <Text style={[styles.body, { color: colors.text }]}>{expectedQtyLabel(totals)}</Text>
      </View>
    );
  }

  return (
    <View
      testID="delivery-completion-summary"
      style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Stop-level confirm</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {ITEM_LEVEL_DELIVERY_PERSISTED
          ? expectedQtyLabel(totals)
          : 'Confirming completes this stop, not each item.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
});
