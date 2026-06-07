import { useEffect, useState, useCallback } from 'react';
import { syncPending, queueStats, bootstrapOffline } from '@/db/offlineSync';
import { toastSuccess, toastError, toastInfo } from '@/components/toast';

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/**
 * Wire up the auto-sync behavior:
 *  - When transitioning offline → online, run sync + bootstrap
 *  - Periodic background sync every 60s while online
 *  - Reports stats and notifies user on completion
 */
export function useAutoSync(enabled: boolean) {
  const online = useOnline();
  const [stats, setStats] = useState({ pending: 0, syncing: 0, synced: 0, failed: 0 });

  const refreshStats = useCallback(async () => {
    setStats(await queueStats());
  }, []);

  const doSync = useCallback(async (silent = false) => {
    try {
      const { synced, failed } = await syncPending();
      if (synced > 0 && !silent) toastSuccess(`Synced ${synced} offline ${synced === 1 ? 'sale' : 'sales'}`);
      if (failed > 0 && !silent) toastError(`${failed} offline sale${failed === 1 ? '' : 's'} failed to sync`);
      await refreshStats();
    } catch (e: any) {
      if (!silent) toastError('Sync failed', e?.message);
    }
  }, [refreshStats]);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  // Online/offline transition
  useEffect(() => {
    if (!enabled) return;
    if (online) {
      toastInfo('Back online — syncing...');
      doSync().then(() => bootstrapOffline().catch(() => {}));
    } else {
      toastInfo('You are offline', 'Sales will be saved locally');
    }
  }, [online, enabled, doSync]);

  // Periodic background sync
  useEffect(() => {
    if (!enabled || !online) return;
    const id = setInterval(() => doSync(true).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [enabled, online, doSync]);

  return { online, stats, syncNow: () => doSync(false), refreshStats };
}
