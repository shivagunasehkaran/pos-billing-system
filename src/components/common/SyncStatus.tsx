/**
 * SyncStatus - Shows sync status indicator
 */

import { useSyncStatus } from '../../hooks/useSyncStatus';

export function SyncStatus() {
  const { online, isSyncing, pendingCount, lastSyncText, lastError } = useSyncStatus();

  return (
    <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-gray-100 rounded-lg">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs md:text-sm text-gray-700 whitespace-nowrap">
        {online ? 'Online' : 'Offline'}
      </span>
      {isSyncing && (
        <span className="text-xs md:text-sm text-blue-600 animate-pulse whitespace-nowrap">Syncing...</span>
      )}
      {pendingCount > 0 && (
        <span className="text-xs md:text-sm text-orange-600 whitespace-nowrap">
          {pendingCount} pending
        </span>
      )}
      <span className="hidden md:inline text-xs text-gray-500">{lastSyncText}</span>
      {lastError && (
        <span className="text-xs text-red-600 flex-shrink-0" title={lastError}>
          ⚠️
        </span>
      )}
    </div>
  );
}

