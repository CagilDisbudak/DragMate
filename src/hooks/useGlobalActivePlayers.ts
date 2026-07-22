import { useEffect, useState } from 'react';
import { getSocket, EV } from '../lib/socket';

/**
 * Live count of connected players, driven by the authoritative server. The
 * server broadcasts `presence:count` on every connect/disconnect (an honest live
 * socket count) — replacing the old Firestore "presence docs with a client clock"
 * scheme that never cleaned up stale entries.
 */
type PresenceState = {
  count: number | null;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  isSupported: boolean;
};

export function useGlobalActivePlayers(): PresenceState {
  const [count, setCount] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = getSocket();

    const onPresence = (data: { count: number }) => {
      setCount(data?.count ?? null);
      setLoading(false);
    };
    const onConnect = () => setIsOnline(true);
    const onDisconnect = () => setIsOnline(false);

    if (socket.connected) setIsOnline(true);
    socket.on(EV.presence, onPresence);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off(EV.presence, onPresence);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return {
    count,
    loading,
    error: null,
    isOnline,
    isSupported: true,
  };
}
