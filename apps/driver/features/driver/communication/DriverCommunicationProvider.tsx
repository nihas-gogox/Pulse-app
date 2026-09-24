/**
 * Root orchestrator for driver chat, payment realtime, and GPS telemetry.
 * Pauses heavy listeners when the app is backgrounded (primitive AppState guard).
 */
import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { DriverChatProvider } from '../../chat/contexts/DriverChatContext';
import { useDriverPaymentListener } from './hooks/useDriverPaymentListener';
import type { DriverPaymentCompletedPayload } from './hooks/useDriverPaymentListener';
import { useAppStateIsActive } from '@pulse/core/lib/hooks/useAppStateIsActive';
import { useDriverHomeDriversQuery } from '@pulse/domain/lib/queries/useDriverHomeDriversQuery';

export type DriverCommunicationContextValue = {
  /** True when AppState is `active` — use to gate GPS loops and realtime. */
  communicationActive: boolean;
  userId: string | null;
  driverIds: string[];
  driverIdsKey: string;
  lastPaymentEvent: DriverPaymentCompletedPayload | null;
};

const DriverCommunicationContext = createContext<
  DriverCommunicationContextValue | undefined
>(undefined);

export function useDriverCommunication(): DriverCommunicationContextValue {
  const ctx = useContext(DriverCommunicationContext);
  if (!ctx) {
    throw new Error(
      'useDriverCommunication must be used within DriverCommunicationProvider',
    );
  }
  return ctx;
}

export function DriverCommunicationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const communicationActive = useAppStateIsActive();
  const { profile } = useAuth();
  const uid = (profile as { uid?: string })?.uid ?? null;

  const { activeLinkedDrivers, driverIdsKey } =
    useDriverHomeDriversQuery(uid);

  const driverIds = useMemo(
    () => activeLinkedDrivers.map((d) => d.id),
    [activeLinkedDrivers],
  );

  const driverIdsForPayment = useMemo(
    () => (communicationActive ? driverIds : []),
    [communicationActive, driverIds],
  );

  const { lastPaymentEvent } = useDriverPaymentListener({
    userId: uid,
    driverIds: driverIdsForPayment,
    enabled: communicationActive && !!uid && driverIdsForPayment.length > 0,
  });

  const value = useMemo<DriverCommunicationContextValue>(
    () => ({
      communicationActive,
      userId: uid,
      driverIds,
      driverIdsKey,
      lastPaymentEvent,
    }),
    [
      communicationActive,
      uid,
      driverIds,
      driverIdsKey,
      lastPaymentEvent,
    ],
  );

  return (
    <DriverCommunicationContext.Provider value={value}>
      <DriverChatProvider isActive={communicationActive}>
        {children}
      </DriverChatProvider>
    </DriverCommunicationContext.Provider>
  );
}
