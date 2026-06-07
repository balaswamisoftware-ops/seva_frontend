import { db, setMeta, getMeta, pendingSales, type QueuedSale } from './offlineDB';
import { api } from '@/api/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pull all data needed for offline operation.
 * Call this:
 *  - After login (always)
 *  - On reconnect to online (refresh stale data)
 *  - Periodically while online (every 5 min)
 */
export async function bootstrapOffline(): Promise<void> {
  const { data } = await api.get('/sync/bootstrap');
  await db.transaction('rw', db.employees, db.events, db.sevas, db.orgSettings, async () => {
    await db.employees.clear();
    await db.employees.bulkPut(data.employees);
    await db.events.clear();
    await db.events.bulkPut(data.events);
    await db.sevas.clear();
    await db.sevas.bulkPut(data.sevas);
    if (data.orgSettings) {
      await db.orgSettings.clear();
      await db.orgSettings.put({ ...data.orgSettings, _id: data.orgSettings._id });
    }
  });
  await setMeta('lastBootstrap', new Date());
}

export async function isBootstrapped(): Promise<boolean> {
  return (await db.employees.count()) > 0;
}

export async function lastBootstrapAt(): Promise<Date | undefined> {
  return getMeta<Date>('lastBootstrap');
}

/** Queue a sale for offline submission */
export async function queueSale(sale: Omit<QueuedSale, 'clientId' | 'status' | 'attempts' | 'timestamp'> & { timestamp?: Date }): Promise<QueuedSale> {
  const entry: QueuedSale = {
    clientId: uuidv4(),
    timestamp: sale.timestamp ?? new Date(),
    status: 'pending',
    attempts: 0,
    type: sale.type,
    payload: sale.payload,
    localReceipt: sale.localReceipt,
  };
  await db.queue.put(entry);
  return entry;
}

/** Sync all pending sales — call after reconnect */
export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const pending = await pendingSales();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  // Mark as syncing
  await db.queue.where('clientId').anyOf(pending.map(p => p.clientId)).modify({ status: 'syncing' });

  const batch = pending.map(p => ({
    clientId: p.clientId,
    type: p.type,
    timestamp: p.timestamp,
    payload: p.payload,
  }));

  try {
    const { data } = await api.post('/sync/sync', { sales: batch });
    const results = (data.data?.results ?? []) as Array<{
      clientId: string; status: 'synced' | 'failed';
      id?: string; receiptNumber?: string;
      error?: string; retryable?: boolean;
    }>;

    let synced = 0, failed = 0;
    for (const r of results) {
      if (r.status === 'synced') {
        await db.queue.update(r.clientId, {
          status: 'synced',
          serverId: r.id,
          serverReceiptNumber: r.receiptNumber,
          syncedAt: new Date(),
        });
        synced++;
      } else {
        const item = await db.queue.get(r.clientId);
        await db.queue.update(r.clientId, {
          status: 'failed',
          attempts: (item?.attempts ?? 0) + 1,
          lastError: r.error,
        });
        failed++;
      }
    }
    return { synced, failed };
  } catch (e: any) {
    // Network error during sync — revert syncing → pending so we retry later
    await db.queue.where('status').equals('syncing').modify({ status: 'pending' });
    throw e;
  }
}

/** Purge synced sales older than N days (housekeeping) */
export async function purgeSynced(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86400e3);
  return db.queue
    .where('status').equals('synced')
    .and((s) => !!s.syncedAt && s.syncedAt < cutoff)
    .delete();
}

/** Quick stats */
export async function queueStats() {
  const [pending, syncing, synced, failed] = await Promise.all([
    db.queue.where('status').equals('pending').count(),
    db.queue.where('status').equals('syncing').count(),
    db.queue.where('status').equals('synced').count(),
    db.queue.where('status').equals('failed').count(),
  ]);
  return { pending, syncing, synced, failed };
}
