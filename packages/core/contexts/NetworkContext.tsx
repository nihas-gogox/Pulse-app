/**
 * Network context — uses @react-native-community/netinfo.
 * Exposes isConnected so the app can require internet before auth/API calls.
 */
import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

/** True when we should allow network calls. Unknown state is treated as online so user can try. */
export function useIsOnline(): boolean {
  const { isConnected, isInternetReachable } = useNetwork();
  if (isConnected === false) return false;
  if (isConnected === true && isInternetReachable === false) return false;
  return true;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setState);
    NetInfo.fetch().then(setState).catch(() => { /* non-fatal; addEventListener handles ongoing state */ });
    return unsubscribe;
  }, []);

  const value = useMemo<NetworkContextType>(
    () => ({
      isConnected: state?.isConnected ?? null,
      isInternetReachable: state?.isInternetReachable ?? null,
    }),
    [state?.isConnected, state?.isInternetReachable],
  );

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}
