import { useState } from 'react';
import Theme from '@pulse/core/constants/Theme';
import Layout from '@pulse/core/constants/Layout';
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import type { DriverTripStopOrder } from '../commerce-mission/driverTripStopOrders.types';
import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';
import {
  canSubmitDeliveryProof,
  emptyDeliveryProof,
  type DeliveryProofDraft,
} from '@pulse/domain/features/driver/job-card/deliveryProof';
import {
  formatStopPlace,
  isDeliveryStop,
  stopRoleLabel,
} from './multiOrderStopCopy';
import { DeliveryCompletionSummary } from './parts/DeliveryCompletionSummary';
import { DeliveryProofSection } from './parts/DeliveryProofSection';
import { StopLocationCard } from './parts/StopLocationCard';
import { StopOrderList } from './parts/StopOrderList';
import { StopVerificationActionBar } from './parts/StopVerificationActionBar';
import { StopVerificationHeader } from './parts/StopVerificationHeader';
import { stopVerificationTotals } from './stopVerificationSummary';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  stop: DriverStopExecutionStop;
  orders: readonly DriverTripStopOrder[];
  stopIndex: number;
  stopTotal: number;
  ordersLoading: boolean;
  loadError: string | null;
  busy: boolean;
  confirmed: boolean;
  review?: boolean;
  nextStop: DriverStopExecutionStop | null;
  onBack: () => void;
  onConfirm: (proof: DeliveryProofDraft) => void;
  onViewNextStop: () => void;
};

export function DriverStopVerificationScreen({
  stop,
  orders,
  stopIndex,
  stopTotal,
  ordersLoading,
  loadError,
  busy,
  confirmed,
  review = false,
  nextStop,
  onBack,
  onConfirm,
  onViewNextStop,
}: Props) {
  const colors = useDriverThemeColors();
  const insets = useSafeAreaInsets();
  const delivery = isDeliveryStop(String(stop.stopType));
  const role = stopRoleLabel(String(stop.stopType));
  const totals = stopVerificationTotals(orders);
  const customer =
    orders.map((o) => o.customerName?.trim()).find((n) => n) ?? stop.contactName;
  const confirmCta = delivery ? 'Confirm delivery' : 'Confirm pickup';
  const footerPad =
    Math.max(insets.bottom, 10) + (Platform.OS === 'web' ? Layout.tabBarDockHeight + 8 : 8);
  const [proof, setProof] = useState(emptyDeliveryProof);
  const needsProof = !review && !confirmed;
  const proofReady = !needsProof || canSubmitDeliveryProof(proof);
  const ordersReady = !(ordersLoading && orders.length === 0);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onBack}
    >
      <View
        testID="driver-stop-verification"
        style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top }]}
      >
        <StopVerificationHeader
          colors={colors}
          role={role}
          stopIndex={stopIndex}
          stopTotal={stopTotal}
          review={review}
          onBack={onBack}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <StopLocationCard colors={colors} stop={stop} customerName={customer} />

          {loadError ? (
            <Text style={[styles.error, { color: Theme.negative }]} accessibilityRole="alert">
              Could not load orders for this stop.
            </Text>
          ) : null}
          {ordersLoading && orders.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>Loading orders…</Text>
          ) : null}

          <StopOrderList colors={colors} orders={orders} delivery={delivery} />
          <DeliveryProofSection
            colors={colors}
            kind={delivery ? 'delivery' : 'pickup'}
            draft={proof}
            readOnly={review || confirmed}
            onChange={setProof}
          />
          <DeliveryCompletionSummary colors={colors} delivery={delivery} totals={totals} />

          {confirmed ? (
            <View style={styles.done} testID="stop-verification-done">
              <Text style={[styles.doneTitle, { color: colors.emerald }]}>Completed</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                Stop {stopIndex} of {stopTotal}
              </Text>
              {nextStop ? (
                <>
                  <Text style={[styles.nextKicker, { color: colors.textMuted }]}>Next stop</Text>
                  <Text style={[styles.nextPlace, { color: colors.text }]} numberOfLines={1}>
                    {formatStopPlace(nextStop)}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    {stopRoleLabel(String(nextStop.stopType))}
                  </Text>
                </>
              ) : (
                <Text style={[styles.muted, { color: colors.textMuted }]}>No further stops.</Text>
              )}
            </View>
          ) : null}
        </ScrollView>

        {review && !confirmed ? null : confirmed ? (
          <StopVerificationActionBar
            colors={colors}
            cta={nextStop && !review ? 'View next stop' : 'Back to route'}
            busy={false}
            bottomInset={footerPad}
            onPress={onViewNextStop}
          />
        ) : (
          <StopVerificationActionBar
            colors={colors}
            cta={confirmCta}
            busy={busy}
            disabled={!ordersReady || !proofReady}
            bottomInset={footerPad}
            onPress={() => onConfirm(proof)}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 14,
  },
  muted: {
    fontSize: 12,
    fontWeight: '500',
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
  },
  done: { gap: 2 },
  doneTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextKicker: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nextPlace: {
    fontSize: 14,
    fontWeight: '700',
  },
});
