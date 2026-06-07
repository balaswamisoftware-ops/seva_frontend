import Dexie, { Table } from 'dexie';
import type { Event, Seva, OrgSettings, ReceiptPayload } from '@/types';

export interface CachedEmployee {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  pinHash: string;       // bcrypt hash — used for offline PIN verification
}

export interface QueuedSale {
  clientId: string;       // UUIDv4
  type: 'SEVA' | 'DONATION';
  timestamp: Date;
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
  // Local-only preview receipt rendered immediately for printing
  localReceipt: ReceiptPayload | any;
  // Once synced, the server's receipt number replaces the local one
  serverReceiptNumber?: string;
  serverId?: string;
  syncedAt?: Date;
}

class SevaERPDB extends Dexie {
  employees!: Table<CachedEmployee, string>;
  events!: Table<Event, string>;
  sevas!: Table<Seva, string>;
  orgSettings!: Table<OrgSettings & { _id: string }, string>;
  queue!: Table<QueuedSale, string>;
  meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('SevaERP_OfflineDB');
    this.version(1).stores({
      employees:    '_id, employeeId, mobileNumber',
      events:       '_id, eventId, status',
      sevas:        '_id, sevaId, eventId, status',
      orgSettings:  '_id',
      queue:        'clientId, status, timestamp, type',
      meta:         'key',
    });
  }
}

export const db = new SevaERPDB();

// ---- Meta helpers ----
export async function setMeta(key: string, value: any) {
  await db.meta.put({ key, value });
}
export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

// ---- Pending queue ----
export const pendingSales = () => db.queue.where('status').anyOf(['pending', 'failed']).toArray();
export const allQueuedSales = () => db.queue.orderBy('timestamp').reverse().toArray();
