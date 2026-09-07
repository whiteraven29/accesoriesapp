import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  /** Null until the first probe resolves, so the UI can avoid a false alarm. */
  isChecking: boolean;
}

/**
 * Connectivity for market conditions: a stall can hold a bar of signal and
 * still have no working route, so we trust `isInternetReachable` when the
 * platform reports it and fall back to `isConnected` when it is indeterminate.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const reachable =
        state.isInternetReachable === null ? Boolean(state.isConnected) : state.isInternetReachable;
      setIsOnline(Boolean(state.isConnected) && reachable);
      setIsChecking(false);
    });

    NetInfo.fetch().then(state => {
      const reachable =
        state.isInternetReachable === null ? Boolean(state.isConnected) : state.isInternetReachable;
      setIsOnline(Boolean(state.isConnected) && reachable);
      setIsChecking(false);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, isChecking };
}
