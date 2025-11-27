/**
 * useSyncStatus - Hook for sync status and control
 */

import { useState, useEffect, useCallback } from 'react';
import type { SyncState } from '../domain/types';
import { eventBus } from '../utils/eventBus';
import { isOnline } from '../utils/network';

export function useSyncStatus() {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    pendingOperationsCount: 0,
    syncCursors: {},
  });
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync events
    const unsubscribeStateChanged = eventBus.on('sync:state-changed', (state: SyncState) => {
      setSyncState(state);
    });

    const unsubscribeSuccess = eventBus.on('sync:success', ({ syncState: state }: { syncState: SyncState }) => {
      setSyncState(state);
    });

    const unsubscribeError = eventBus.on('sync:error', ({ syncState: state }: { syncState: SyncState }) => {
      setSyncState(state);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeStateChanged();
      unsubscribeSuccess();
      unsubscribeError();
    };
  }, []);

  const getLastSyncText = useCallback(() => {
    if (!syncState.lastSyncTime) {
      return 'Never synced';
    }

    const diff = Date.now() - syncState.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }, [syncState.lastSyncTime]);

  return {
    syncState,
    online,
    isSyncing: syncState.isSyncing,
    pendingCount: syncState.pendingOperationsCount,
    lastSyncText: getLastSyncText(),
    lastError: syncState.lastError,
  };
}

