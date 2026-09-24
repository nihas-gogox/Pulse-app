/**
 * Phase A5 — relationship-aware summary, additive to DriverHomeScreen.
 * Not a rewrite of the execution screen below it: Employment, Fleet and
 * Market are relationships/capabilities of one identity, shown together,
 * never a mode switch. Each row reuses an already-existing hook — no new
 * employer query, no new Fleet Owner capability check, no new Market query
 * beyond the one small trip-count read this file itself needs (see
 * usePilotWorkSummaryQuery's own comment for why that one is unavoidable).
 */
import Theme from '@pulse/core/constants/Theme';
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { useDriverFleetOwnerQuery } from '../../../lib/queries/useDriverFleetOwnerQuery';
import { useDriverHomeDriversQuery } from '@pulse/domain/lib/queries/useDriverHomeDriversQuery';
import { useFleetOwnerOpenLoadsQuery } from '../../../lib/queries/useFleetOwnerOpenLoadsQuery';
import { useMyMarketBidsQuery } from '../../../lib/queries/useMyMarketBidsQuery';
import { useOwnerVehiclesQuery } from '../../../lib/queries/useOwnerVehiclesQuery';
import { usePilotWorkSummaryQuery } from '../../../lib/queries/usePilotWorkSummaryQuery';
import { ROUTES } from '@pulse/core/lib/routes';
import { useRouter, type Href } from 'expo-router';
import { Briefcase, ChevronRight, ShoppingBag, Truck } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function PilotRelationshipSummary({ uid }: { uid: string | null }) {
  const router = useRouter();
  const colors = useDriverThemeColors();
  const cardBorder = colors.border;

  const linkedDriversQuery = useDriverHomeDriversQuery(uid);
  const employers = linkedDriversQuery.employerLinkedDrivers;
  const activeDriverIds = useMemo(
    () => linkedDriversQuery.activeLinkedDrivers.map((d) => d.id),
    [linkedDriversQuery.activeLinkedDrivers],
  );
  const { activeCount, upcomingCount } = usePilotWorkSummaryQuery(activeDriverIds);

  const { vehicles } = useOwnerVehiclesQuery(uid);
  const { isFleetOwner } = useDriverFleetOwnerQuery(uid);
  const { loads } = useFleetOwnerOpenLoadsQuery(uid);
  const { bids } = useMyMarketBidsQuery(uid);
  const pendingBids = useMemo(() => bids.filter((b) => b.status === 'pending').length, [bids]);

  // Nothing to show for a brand-new profile with no employer, no vehicle, and
  // no Fleet Owner capability yet — avoid an empty shell above the real screen.
  const hasAnything = employers.length > 0 || vehicles.length > 0 || isFleetOwner;
  if (!hasAnything) return null;

  return (
    <View style={styles.stack}>
      {employers.length > 0 ? (
        <Row
          icon={<Briefcase size={16} color={colors.emerald} />}
          colors={colors}
          cardBorder={cardBorder}
          title="Your Work"
          primary={
            employers.length === 1
              ? employers[0].organizations?.name?.trim() || 'Your employer'
              : `${employers.length} employers`
          }
          secondary={`${activeCount} active · ${upcomingCount} upcoming`}
          onPress={undefined}
        />
      ) : null}

      <Row
        icon={<Truck size={16} color={colors.emerald} />}
        colors={colors}
        cardBorder={cardBorder}
        title="Your Fleet"
        primary={vehicles.length > 0 ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}` : 'No vehicle yet'}
        secondary={vehicles.length > 0 ? 'Tap to manage' : 'Add your vehicle to unlock Market'}
        onPress={() =>
          router.push(
            (vehicles.length > 0
              ? ROUTES.driverMyFleet()
              : ROUTES.driverBecomeFleetOwner()) as Href,
          )
        }
      />

      {isFleetOwner ? (
        <Row
          icon={<ShoppingBag size={16} color={colors.emerald} />}
          colors={colors}
          cardBorder={cardBorder}
          title="Market"
          primary={`${loads.length} load${loads.length === 1 ? '' : 's'} available`}
          secondary={`${pendingBids} pending bid${pendingBids === 1 ? '' : 's'}`}
          onPress={() => router.push(ROUTES.driverAvailableLoads() as Href)}
        />
      ) : null}
    </View>
  );
}

function Row({
  icon,
  colors,
  cardBorder,
  title,
  primary,
  secondary,
  onPress,
}: {
  icon: React.ReactNode;
  colors: ReturnType<typeof useDriverThemeColors>;
  cardBorder: string;
  title: string;
  primary: string;
  secondary: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
        <Text style={[styles.primary, { color: colors.text }]} numberOfLines={1}>
          {primary}
        </Text>
        <Text style={[styles.secondary, { color: colors.textMuted }]} numberOfLines={1}>
          {secondary}
        </Text>
      </View>
      {onPress ? <ChevronRight size={16} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: cardBorder }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: cardBorder, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.surfaceGray,
  },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  primary: { fontSize: 15, fontWeight: '800', marginTop: 1 },
  secondary: { fontSize: 12, fontWeight: '600', marginTop: 1 },
});
