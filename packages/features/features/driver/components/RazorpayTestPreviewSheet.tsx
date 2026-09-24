/**
 * A10.2 — PILOT/TEST ONLY. A visual preview of the intended Razorpay
 * checkout UX, used only while RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not
 * configured (see the real path: handlePay() -> createMarketplaceFeeOrder()
 * -> RazorpayCheckoutSheet, completely untouched by this file).
 *
 * This component is presentational only. It never talks to Supabase
 * directly -- `onOutcome` is the SAME simulate-outcome call the plain
 * "Cash"/pilot flow already uses (marketplace-test-payment edge function ->
 * confirm_marketplace_fee_payment()), so there is exactly one authoritative
 * payment state, same as before. UPI/Card/Netbanking selection here is
 * cosmetic only -- it does not change which backend call is made.
 *
 * Remove this file alongside the rest of the A10.2 pilot payment methods
 * once real Razorpay credentials are configured and this preview is no
 * longer needed.
 */
import { formatINR } from '@pulse/core/lib/format';
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  ShieldAlert,
  Smartphone,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type RazorpayTestPreviewOrder = { amount: number };

type Phase = 'select' | 'processing' | 'success' | 'failure';
type Method = 'upi' | 'card' | 'netbanking';

export interface RazorpayTestPreviewSheetProps {
  order: RazorpayTestPreviewOrder | null;
  onOutcome: (outcome: 'paid' | 'failed') => Promise<{ error: Error | null }>;
  onDismiss: () => void;
}

export function RazorpayTestPreviewSheet({
  order,
  onOutcome,
  onDismiss,
}: RazorpayTestPreviewSheetProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [method, setMethod] = useState<Method>('upi');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setPhase('select');
      setMethod('upi');
      setErrorText(null);
    }
  }, [order]);

  if (!order) return null;

  const run = async (outcome: 'paid' | 'failed') => {
    setErrorText(null);
    setPhase('processing');
    const { error } = await onOutcome(outcome);
    if (error) {
      setErrorText(error.message);
      setPhase('select');
      return;
    }
    setPhase(outcome === 'paid' ? 'success' : 'failure');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Razorpay</Text>
              <Text style={styles.brandSub}>Pay to Pulse</Text>
            </View>
            <View style={styles.testBadge}>
              <ShieldAlert size={12} color="#92400e" />
              <Text style={styles.testBadgeText}>TEST PREVIEW</Text>
            </View>
          </View>

          {phase === 'select' || phase === 'processing' ? (
            <>
              <Text style={styles.feeLabel}>Marketplace Platform Fee</Text>
              <Text style={styles.amount}>{formatINR(order.amount)}</Text>

              <Text style={styles.sectionLabel}>Choose payment method</Text>
              <View style={styles.methodRow}>
                <MethodTile
                  Icon={Smartphone}
                  label="UPI"
                  active={method === 'upi'}
                  onPress={() => setMethod('upi')}
                />
                <MethodTile
                  Icon={CreditCard}
                  label="Card"
                  active={method === 'card'}
                  onPress={() => setMethod('card')}
                />
                <MethodTile
                  Icon={Landmark}
                  label="Netbanking"
                  active={method === 'netbanking'}
                  onPress={() => setMethod('netbanking')}
                />
              </View>

              <View style={styles.methodDetailBox}>
                {method === 'upi' ? (
                  <>
                    <Text style={styles.methodDetailLabel}>UPI ID</Text>
                    <Text style={styles.methodDetailValue}>pulse.marketplace@upi</Text>
                  </>
                ) : method === 'card' ? (
                  <>
                    <Text style={styles.methodDetailLabel}>Card</Text>
                    <Text style={styles.methodDetailValue}>•••• •••• •••• 4242</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.methodDetailLabel}>Bank</Text>
                    <Text style={styles.methodDetailValue}>Preview bank</Text>
                  </>
                )}
              </View>

              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

              <Pressable
                disabled={phase === 'processing'}
                onPress={() => void run('paid')}
                style={[styles.payButton, phase === 'processing' && styles.payButtonBusy]}
              >
                {phase === 'processing' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.payButtonText}>Pay {formatINR(order.amount)}</Text>
                )}
              </Pressable>

              <Pressable
                disabled={phase === 'processing'}
                onPress={() => void run('failed')}
                style={styles.failLink}
              >
                <Text style={styles.failLinkText}>Simulate payment failure</Text>
              </Pressable>

              <Pressable disabled={phase === 'processing'} onPress={onDismiss} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Text style={styles.disclaimer}>
                This is a payment-flow preview. No real payment will be processed.
              </Text>
            </>
          ) : phase === 'success' ? (
            <View style={styles.resultBlock}>
              <CheckCircle2 size={56} color="#16a34a" />
              <Text style={styles.resultTitle}>Payment successful</Text>
              <Text style={styles.resultSubtitle}>Marketplace fee paid</Text>
              <Text style={styles.resultAmount}>{formatINR(order.amount)}</Text>
              <View style={styles.testBadge}>
                <ShieldAlert size={12} color="#92400e" />
                <Text style={styles.testBadgeText}>TEST PREVIEW — no real money was charged</Text>
              </View>
              <Pressable onPress={onDismiss} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.resultBlock}>
              <XCircle size={56} color="#dc2626" />
              <Text style={styles.resultTitle}>Payment failed</Text>
              <Text style={styles.resultSubtitle}>Simulated failure — nothing was charged</Text>
              <View style={styles.testBadge}>
                <ShieldAlert size={12} color="#92400e" />
                <Text style={styles.testBadgeText}>TEST PREVIEW — not a real Razorpay attempt</Text>
              </View>
              <Pressable onPress={() => setPhase('select')} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>Try again</Text>
              </Pressable>
              <Pressable onPress={onDismiss} style={styles.cancel}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MethodTile({
  Icon,
  label,
  active,
  onPress,
}: {
  Icon: typeof Smartphone;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.methodTile, active && styles.methodTileActive]}>
      <Icon size={18} color={active ? '#1d4ed8' : '#475569'} />
      <Text style={[styles.methodTileText, active && styles.methodTileTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 20, fontWeight: '800', color: '#1d4ed8', letterSpacing: -0.3 },
  brandSub: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 2 },
  testBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 1,
  },
  testBadgeText: { fontSize: 9, fontWeight: '800', color: '#92400e', letterSpacing: 0.3 },
  feeLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4 },
  amount: { fontSize: 30, fontWeight: '800', color: '#0f172a' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  methodTileActive: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  methodTileText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  methodTileTextActive: { color: '#1d4ed8' },
  methodDetailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  methodDetailLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  methodDetailValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  errorText: { fontSize: 12, fontWeight: '600', color: '#dc2626' },
  payButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  payButtonBusy: { opacity: 0.7 },
  payButtonText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  failLink: { alignItems: 'center', paddingVertical: 8 },
  failLinkText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  cancel: { alignItems: 'center', paddingVertical: 6 },
  cancelText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  disclaimer: { fontSize: 10, fontWeight: '500', color: '#94a3b8', textAlign: 'center', marginTop: 2 },
  resultBlock: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  resultSubtitle: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  resultAmount: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  doneButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 10,
  },
  doneButtonText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
