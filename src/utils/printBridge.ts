import type { ReceiptPayload } from '@/types';
import type { DonationReceiptPayload } from '@/types/donation';
import { printReceipt as browserPrint } from './printReceipt';
import { printersApi } from '@/api';

const AGENT_URL = localStorage.getItem('printAgentUrl') ?? 'http://localhost:9100';
const AGENT_KEY = localStorage.getItem('printAgentKey') ?? '';

interface AgentStatus { ok: boolean; ready: boolean; printerType?: string; }
let cachedStatus: { status: AgentStatus; ts: number } | null = null;
const STATUS_CACHE_MS = 5000;

/**
 * Check if the local print agent is available and the printer is ready.
 * Caches the result for 5 seconds to avoid hammering the agent on every print.
 */
export async function checkPrintAgent(force = false): Promise<AgentStatus> {
  if (!force && cachedStatus && Date.now() - cachedStatus.ts < STATUS_CACHE_MS) {
    return cachedStatus.status;
  }
  try {
    const res = await fetch(`${AGENT_URL}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error('Agent not OK');
    const status = await res.json() as AgentStatus;
    cachedStatus = { status, ts: Date.now() };
    return status;
  } catch {
    const status = { ok: false, ready: false };
    cachedStatus = { status, ts: Date.now() };
    return status;
  }
}

/**
 * Convert a receipt payload (seva or donation) into the shape the agent expects.
 * The agent's printer.ts handles both types based on `type` and `ticket`/`donation`.
 */
function toAgentPayload(receipt: ReceiptPayload | DonationReceiptPayload): any {
  const isDonation = (receipt as any).type === 'DONATION';
  const ticket = (receipt as ReceiptPayload).ticket;
  const donation = (receipt as DonationReceiptPayload).donation;

  return {
    type: isDonation ? 'DONATION' : 'SEVA',
    width: receipt.width,
    alignment: receipt.alignment,
    fontSize: receipt.fontSize,
    printQrCode: receipt.printQrCode,
    qrPayload: isDonation && donation
      ? `DRCP:${donation.receiptNumber}|DON:${donation.donationId}|AMT:${donation.amount}`
      : ticket
        ? `RCP:${ticket.receiptNumber}|BK:${ticket.bookingNumber}|TKT:${ticket.ticketId}`
        : undefined,
    org: receipt.org,
    receiptHeader: receipt.receiptHeader,
    footer: receipt.footer,
    ticket: isDonation ? undefined : ticket,
    donation: isDonation ? donation : undefined,
  };
}

/**
 * Print a receipt. Strategy (best → worst):
 *   1. Backend printer  — if a default printer is configured server-side and
 *      a ticketDbId is provided, the backend renders + dispatches directly to
 *      the network or USB-agent printer. Operator does nothing.
 *   2. Local print-agent on this PC — legacy direct-print path. Useful if the
 *      printer isn't visible from the server but is plugged into this PC.
 *   3. Browser print dialog — always works.
 *
 * Returns the method used so the UI can show a status indicator.
 */
export async function smartPrint(
  receipt: ReceiptPayload | DonationReceiptPayload,
  ticketDbId?: string,
): Promise<{ method: 'backend' | 'agent' | 'browser'; ok: boolean; error?: string }> {
  // 1. Backend printer (only for tickets; donations still go via legacy paths).
  if (ticketDbId) {
    try {
      await printersApi.print(ticketDbId);
      return { method: 'backend', ok: true };
    } catch (e: any) {
      // No printer configured / printer unreachable — keep going.
      if (e?.response?.status !== 400) {
        // 400 is "no default printer", not a real failure — silently fall through.
        // Other statuses are worth logging.
        // eslint-disable-next-line no-console
        console.warn('Backend print failed, falling back:', e?.message ?? e);
      }
    }
  }

  // 2. Local print-agent on this PC.
  const status = await checkPrintAgent();
  if (status.ok && status.ready) {
    try {
      const res = await fetch(`${AGENT_URL}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AGENT_KEY && { 'x-agent-key': AGENT_KEY }),
        },
        body: JSON.stringify(toAgentPayload(receipt)),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      if (data.ok) return { method: 'agent', ok: true };
      throw new Error(data.error ?? 'Agent print failed');
    } catch (e: any) {
      browserPrint(receipt as ReceiptPayload);
      return { method: 'browser', ok: true, error: `Agent failed: ${e.message}. Used browser.` };
    }
  }

  // 3. Browser print dialog.
  browserPrint(receipt as ReceiptPayload);
  return { method: 'browser', ok: true };
}

export async function openCashDrawer(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/open-drawer`, {
      method: 'POST',
      headers: AGENT_KEY ? { 'x-agent-key': AGENT_KEY } : {},
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function configureAgent(url: string, key?: string) {
  localStorage.setItem('printAgentUrl', url);
  if (key) localStorage.setItem('printAgentKey', key);
  cachedStatus = null;
}
