import { ticketsApi } from '@/api';
import { db } from '@/db/offlineDB';
import { queueSale } from '@/db/offlineSync';
import { v4 as uuidv4 } from 'uuid';
import type { Ticket, ReceiptPayload, PaymentMode } from '@/types';

interface SellInput {
  eventId: string;
  sevaId: string;
  devoteeName: string;
  mobileNumber?: string;
  quantity: number;
  paymentMode: PaymentMode;
}

/**
 * Sells a ticket — online or offline.
 *
 * ONLINE: hits the server, gets the real receipt back, returns it.
 * OFFLINE: builds a local "draft" receipt with a temporary number (TEMP-<uuid>),
 *          decrements local inventory, queues the sale for later sync.
 *
 * The local receipt prints just fine. When sync happens, the server assigns the
 * real sequential receipt number and the queue entry is updated.
 */
export async function sellTicketSmart(
  input: SellInput,
  employee: { id: string; firstName: string; lastName: string },
): Promise<{ ticket: Ticket | any; receipt: ReceiptPayload; offline: boolean }> {
  if (navigator.onLine) {
    try {
      const result = await ticketsApi.sell(input);
      return { ...result, offline: false };
    } catch (e: any) {
      // Server unreachable despite navigator.onLine being true — fall through to offline
      if (!e?.response) {
        console.warn('Server unreachable, falling back to offline mode');
      } else {
        throw e; // it's a real validation/business error, surface it
      }
    }
  }

  // ---- Offline path ----
  const [event, seva, org] = await Promise.all([
    db.events.get(input.eventId),
    db.sevas.get(input.sevaId),
    db.orgSettings.toCollection().first(),
  ]);
  if (!event) throw new Error('Event not found in offline cache');
  if (!seva)  throw new Error('Seva not found in offline cache');
  if (seva.status !== 'ACTIVE') throw new Error('Seva is not active');
  if (seva.maxTickets > 0 && seva.availableTickets < input.quantity) {
    throw new Error(`Only ${seva.availableTickets} tickets available offline`);
  }

  // Decrement local inventory (best-effort — server is source of truth on sync)
  if (seva.maxTickets > 0) {
    seva.availableTickets -= input.quantity;
    await db.sevas.put(seva);
  }

  const clientId = uuidv4();
  const tempReceiptNum = `TEMP-${clientId.slice(0, 8)}`;
  const tempBookingNum = `TEMP-BK-${clientId.slice(0, 8)}`;
  const tempTicketId   = `TEMP-TKT-${clientId.slice(0, 8)}`;
  const total = Number(seva.price) * input.quantity;
  const now = new Date();

  const offlineTicket = {
    _id: clientId,
    ticketId: tempTicketId,
    bookingNumber: tempBookingNum,
    receiptNumber: tempReceiptNum,
    eventId: event._id, sevaId: seva._id,
    eventName: event.eventName, sevaName: seva.sevaName,
    devoteeName: input.devoteeName, mobileNumber: input.mobileNumber,
    quantity: input.quantity, unitPrice: Number(seva.price), totalAmount: total,
    paymentMode: input.paymentMode,
    soldByEmployeeId: employee.id,
    soldByName: `${employee.firstName} ${employee.lastName}`,
    soldAt: now.toISOString(),
    printed: false,
    _offline: true,
  };

  // Build a local receipt payload that matches the server's shape
  const columns = (org?.printerWidth ?? 58) === 80 ? 48 : 32;
  const receipt: ReceiptPayload = {
    width: (org?.printerWidth ?? 58) as 58 | 80,
    columns,
    alignment: org?.textAlignment ?? 'center',
    fontSize: org?.fontSize ?? 'normal',
    org: {
      name: org?.orgName ?? 'Organization',
      address: org?.address ?? '',
      contact: org?.contactNumber ?? '',
      gst: org?.gstNumber ?? '',
      logoUrl: org?.printLogo ? org?.logoUrl : undefined,
    },
    receiptHeader: org?.receiptHeader ?? '',
    printLogo: !!org?.printLogo,
    printQrCode: !!org?.printQrCode,
    qrDataUrl: undefined, // can't generate QR offline without library; could add qrcode lib if needed
    ticket: {
      receiptNumber: tempReceiptNum,
      bookingNumber: tempBookingNum,
      ticketId: tempTicketId,
      eventName: event.eventName,
      sevaName: seva.sevaName,
      devoteeName: input.devoteeName,
      mobileNumber: input.mobileNumber,
      quantity: input.quantity,
      unitPrice: Number(seva.price),
      totalAmount: total,
      paymentMode: input.paymentMode,
      soldByName: `${employee.firstName} ${employee.lastName}`,
      soldAt: now.toISOString(),
    },
    footer: {
      thankYou: org?.thankYouMessage ?? '',
      quote: org?.spiritualQuote ?? '',
      custom: (org?.receiptFooter ?? '') + ' (OFFLINE — Receipt # will be reassigned)',
    },
    lineSpacing: org?.lineSpacing ?? 1,
  };

  await queueSale({
    type: 'SEVA',
    payload: input,
    localReceipt: receipt,
    timestamp: now,
  });

  return { ticket: offlineTicket, receipt, offline: true };
}
