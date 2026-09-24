/**
 * A7.3 — Driver Home entry point, now a routing decision rather than a
 * direct re-export.
 *
 * Legacy DriverHomeScreen (dispatcher-oriented: Online/Offline via
 * drivers.status, DriverTripFlowCard for an active trip) stays completely
 * unmodified and is still what renders for:
 *   - any driver whose participation isn't DCO-eligible (employed/invited)
 *   - a DCO-eligible driver who currently has an active trip (unavailable)
 *   - while participation/availability are still loading (fail safe to the
 *     existing behavior rather than flash the new surface incorrectly)
 *
 * DriverAvailableScreen (new, A7.2-approved) renders only for a DCO-eligible
 * driver who is currently available (is_driver_available() === true).
 *
 * Participation is fetched locally here (not via a shared hook) rather than
 * touching features/reach/screens/DriverStoriesScreen.tsx's own inline
 * fetch of the same data -- Marketplace/Reach discovery code is explicitly
 * out of scope for A7.3.
 */
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import DriverAvailableScreen from '../../features/drivers/screens/DriverAvailableScreen';
import DriverHomeScreen from '../../features/drivers/screens/DriverHomeScreen';
import { useDriverAvailabilityQuery } from '@pulse/domain/lib/queries/useDriverAvailabilityQuery';
import { getDriverFleetMemberships } from '@pulse/domain/features/reach/services/driverReferrals.service';
import {
  isDcoEligibleParticipation,
  resolveDriverParticipation,
  type DriverMembershipLike,
} from '../../features/reach/utils/driverParticipation';
import { useEffect, useState } from 'react';

export default function DriverIndexRoute() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';

  const [memberships, setMemberships] = useState<DriverMembershipLike[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!uid) {
      setMemberships(null);
      return;
    }
    void getDriverFleetMemberships()
      .then(({ memberships: m }) => {
        if (!cancelled) setMemberships(m);
      })
      .catch(() => {
        if (!cancelled) setMemberships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const { available, isLoading: availabilityLoading, isError: availabilityError } =
    useDriverAvailabilityQuery(uid);

  const participationKnown = memberships !== null;
  const isDcoEligible = participationKnown
    ? isDcoEligibleParticipation(resolveDriverParticipation(memberships))
    : false;

  const showAvailableSurface =
    participationKnown &&
    !availabilityLoading &&
    !availabilityError &&
    isDcoEligible &&
    available === true;

  return showAvailableSurface ? <DriverAvailableScreen /> : <DriverHomeScreen />;
}
