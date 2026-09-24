import {
  salaryRequestStatusColors,
  salaryRequestStatusIconName,
  salaryRequestStatusLabel,
  salaryRequestStatusTone,
  salaryRequestTypeShortLabel,
} from '../../drivers/utils/salaryRequestDisplay.util';
import { phonePeMetaDate } from '../utils/driverGpayTransactions.util';
import type { PendingSalaryRequestItem } from '../hooks/useDriverPendingEarnings';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Colors = {
  text: string;
  textMuted: string;
  emerald: string;
  borderSubtle: string;
  surfaceElevated: string;
};

type Props = {
  item: PendingSalaryRequestItem;
  colors: Colors;
  cardBg: string;
  isDark: boolean;
  onPress: () => void;
};

export function PendingSalaryRequestCard({ item, colors, cardBg, isDark, onPress }: Props) {
  const { request, orgName } = item;
  const tone = salaryRequestStatusTone(request.status);
  const statusColors = salaryRequestStatusColors(tone);
  const status = salaryRequestStatusLabel(request.status);
  const type = salaryRequestTypeShortLabel(request.request_type);
  const tripCount = request.trip_ids?.length ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isDark ? colors.borderSubtle : 'rgba(226,232,240,0.9)',
          shadowColor: isDark ? '#000' : 'rgba(15,23,42,0.10)',
        },
      ]}
    >
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isDark ? colors.surfaceElevated : 'rgba(248,250,252,0.92)',
                },
              ]}
            >
              <FontAwesome
                name={salaryRequestStatusIconName(tone)}
                size={14}
                color={statusColors.icon}
              />
            </View>
            <View style={styles.headText}>
              <Text style={[styles.orgName, { color: colors.text }]} numberOfLines={1}>
                {orgName}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>{type}</Text>
                <Text style={[styles.metaDot, { color: colors.emerald }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                  {phonePeMetaDate(request.created_at)}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.amount, { color: colors.text }]}>
            ₹{Math.round(Number(request.amount) || 0).toLocaleString('en-IN')}
          </Text>
        </View>

        {tripCount > 0 ? (
          <Text style={[styles.tripHint, { color: colors.textMuted }]}>
            Bulk claim ({tripCount} trip{tripCount === 1 ? '' : 's'})
          </Text>
        ) : null}

        {request.note?.trim() ? (
          <Text style={[styles.note, { color: colors.textMuted }]} numberOfLines={2}>
            {request.note.trim()}
          </Text>
        ) : null}

        <View style={[styles.footer, { borderTopColor: isDark ? colors.borderSubtle : '#f1f5f9' }]}>
          <Text
            style={[
              styles.statusPill,
              {
                color: statusColors.text,
                backgroundColor: statusColors.bg,
                borderColor: statusColors.border,
              },
            ]}
            numberOfLines={1}
          >
            {status.toUpperCase()}
          </Text>
          <FontAwesome name="chevron-right" size={12} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardInner: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  topLeft: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  orgName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  metaText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    flexShrink: 1,
  },
  metaDot: {
    fontSize: 8,
    fontWeight: '400',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 0,
  },
  tripHint: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  note: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  statusPill: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
});
