import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { SelectButton } from 'primereact/selectbutton';
import { eventsApi, sevasApi, ticketsApi } from '@/api';
import type { Event, Seva, PaymentMode, ReceiptPayload, Ticket } from '@/types';
import { formatINR } from '@/utils/format';
import { toastSuccess, toastError, toastInfo } from '@/components/toast';
import { apiErrorMessage } from '@/utils/format';
import { renderReceiptText } from '@/utils/printReceipt';
import { smartPrint } from '@/utils/printBridge';
import { sellTicketSmart } from '@/utils/sellTicketSmart';
import { useAuthStore } from '@/store/auth';

const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: 'Cash',  value: 'CASH' },
  { label: 'UPI',   value: 'UPI' },
  { label: 'Card',  value: 'CARD' },
  { label: 'Other', value: 'OTHER' },
];

export default function SalesPage() {
  const queryClient = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedSeva, setSelectedSeva]   = useState<Seva | null>(null);
  const [devoteeName, setDevoteeName]     = useState('');
  const [mobile, setMobile]               = useState('');
  const [quantity, setQuantity]           = useState<number | null>(1);
  const [paymentMode, setPaymentMode]     = useState<PaymentMode>('CASH');
  const [receiptDialog, setReceiptDialog] = useState<{ open: boolean; receipt?: ReceiptPayload; ticket?: any; offline?: boolean }>({ open: false });

  // Ongoing events — always refetch on mount so a newly-marked-ongoing event
  // shows up immediately when the operator opens this page.
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events-ongoing'],
    queryFn: eventsApi.ongoing,
    refetchOnMount: 'always',
  });

  // Sevas of selected event — also refetch on mount so sevas attached on the
  // Events page since the last visit appear without needing a hard reload.
  const { data: sevas = [], isLoading: sevasLoading } = useQuery({
    queryKey: ['sevas-by-event', selectedEvent?._id],
    queryFn: () => sevasApi.byEvent(selectedEvent!._id),
    enabled: !!selectedEvent,
    refetchOnMount: 'always',
  });

  const total = useMemo(() => {
    if (!selectedSeva || !quantity) return 0;
    return Number(selectedSeva.price) * quantity;
  }, [selectedSeva, quantity]);

  const sellMutation = useMutation({
    mutationFn: (input: { eventId: string; sevaId: string; devoteeName: string; mobileNumber?: string; quantity: number; paymentMode: PaymentMode }) =>
      sellTicketSmart(input, employee!),
    onSuccess: ({ ticket, receipt, offline }) => {
      if (offline) toastInfo('Saved offline', `Will sync when back online. Receipt # may change.`);
      else         toastSuccess('Ticket sold', `Receipt ${ticket.receiptNumber}`);
      setReceiptDialog({ open: true, receipt, ticket, offline });
      queryClient.invalidateQueries({ queryKey: ['sevas-by-event'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['daily-chart'] });
      setDevoteeName(''); setMobile(''); setQuantity(1);
    },
    onError: (e) => toastError('Sale failed', apiErrorMessage(e)),
  });

  const canSell =
    selectedEvent && selectedSeva && selectedSeva.status === 'ACTIVE' &&
    devoteeName.trim().length >= 2 && quantity && quantity >= 1 &&
    (selectedSeva.maxTickets === 0 || (quantity ?? 0) <= selectedSeva.availableTickets);

  const submitSale = () => {
    if (!canSell || !selectedEvent || !selectedSeva || !quantity) return;
    sellMutation.mutate({
      eventId: selectedEvent._id,
      sevaId: selectedSeva._id,
      devoteeName: devoteeName.trim(),
      mobileNumber: mobile.trim() || undefined,
      quantity,
      paymentMode,
    });
  };

  const handlePrint = async () => {
    if (!receiptDialog.receipt) return;
    const ticketDbId = receiptDialog.offline ? undefined : receiptDialog.ticket?._id;
    const result = await smartPrint(receiptDialog.receipt, ticketDbId);
    if (result.method === 'backend')      toastSuccess('Sent to server printer');
    else if (result.method === 'agent')   toastSuccess('Sent to local printer');
    else                                  toastInfo('Opened browser print dialog');
    if (ticketDbId && result.method !== 'backend') {
      // Backend's print endpoint already marks printed; only call this for
      // the agent/browser paths.
      ticketsApi.markPrinted(ticketDbId).catch(() => {});
    }
  };

  return (
    <div className="grid">
      {/* LEFT: Event + Sevas */}
      <div className="col-12 lg:col-7">
        <Card title="1. Select Ongoing Event" className="mb-3">
          <Dropdown
            value={selectedEvent}
            onChange={(e) => { setSelectedEvent(e.value); setSelectedSeva(null); }}
            options={events}
            optionLabel="eventName"
            placeholder={eventsLoading ? 'Loading...' : 'Choose event'}
            className="w-full"
            disabled={eventsLoading}
            itemTemplate={(o: Event) => (
              <div className="flex flex-column">
                <span className="font-semibold">{o.eventName}</span>
                <span className="text-xs text-500">{o.eventId} · {o.location ?? '—'}</span>
              </div>
            )}
            emptyMessage="No ongoing events. Create or mark an event ONGOING first."
          />
        </Card>

        <Card title="2. Select Seva">
          {!selectedEvent && <div className="text-500 text-center p-4">Pick an event first.</div>}
          {selectedEvent && sevasLoading && <div className="text-500 text-center p-4">Loading sevas...</div>}
          {selectedEvent && !sevasLoading && sevas.length === 0 && (
            <div className="text-500 text-center p-4">No active sevas for this event.</div>
          )}
          {selectedEvent && !sevasLoading && sevas.length > 0 && (
            <div className="grid">
              {sevas.map((s) => {
                const limited = s.maxTickets > 0;
                const isSelected = selectedSeva?._id === s._id;
                const disabled = s.status !== 'ACTIVE' || (limited && s.availableTickets <= 0);
                return (
                  <div className="col-6 md:col-4" key={s._id}>
                    <div
                      onClick={() => !disabled && setSelectedSeva(s)}
                      className={`p-3 border-round cursor-pointer transition-all transition-duration-150 ${
                        isSelected ? 'border-2 surface-200' : 'border-1 surface-card'
                      } ${disabled ? 'opacity-50' : 'hover:surface-100'}`}
                      style={{ borderColor: isSelected ? '#b45309' : '#e5e7eb' }}
                    >
                      <div className="font-semibold">{s.sevaName}</div>
                      <div className="text-xl font-bold mt-1" style={{ color: '#b45309' }}>{formatINR(Number(s.price))}</div>
                      <div className="text-xs text-500 mt-1">{s.sevaId}</div>
                      <div className="mt-2">
                        {limited
                          ? <Tag severity={s.availableTickets > 5 ? 'success' : 'warning'} value={`${s.availableTickets} left`} />
                          : <Tag severity="info" value="Unlimited" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* RIGHT: Devotee + Sale */}
      <div className="col-12 lg:col-5">
        <Card title="3. Devotee Details">
          <div className="flex flex-column gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Devotee Name *</label>
              <InputText value={devoteeName} onChange={(e) => setDevoteeName(e.target.value)} className="w-full" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Mobile (optional)</label>
              <InputText value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full" keyfilter="num" placeholder="+91-XXXXXXXXXX" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Quantity *</label>
              <InputNumber value={quantity} onValueChange={(e) => setQuantity(e.value)} showButtons min={1} max={selectedSeva?.maxTickets && selectedSeva.maxTickets > 0 ? selectedSeva.availableTickets : 100} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Payment Mode</label>
              <SelectButton value={paymentMode} onChange={(e) => setPaymentMode(e.value)} options={PAYMENT_OPTIONS} />
            </div>

            <div className="border-top-1 surface-border pt-3 mt-2">
              <div className="flex justify-content-between mb-2">
                <span className="text-500">Unit Price</span>
                <span>{selectedSeva ? formatINR(Number(selectedSeva.price)) : '—'}</span>
              </div>
              <div className="flex justify-content-between mb-2">
                <span className="text-500">Quantity</span>
                <span>{quantity ?? 0}</span>
              </div>
              <div className="flex justify-content-between text-xl font-bold">
                <span>TOTAL</span>
                <span style={{ color: '#b45309' }}>{formatINR(total)}</span>
              </div>
            </div>

            <Button
              label={sellMutation.isPending ? 'Processing...' : `Sell & Print Receipt — ${formatINR(total)}`}
              icon="ph ph-printer"
              className="w-full mt-2"
              style={{ background: '#b45309', borderColor: '#b45309' }}
              loading={sellMutation.isPending}
              disabled={!canSell}
              onClick={submitSale}
            />
          </div>
        </Card>
      </div>

      {/* Receipt preview dialog */}
      <Dialog
        header={receiptDialog.offline ? 'Receipt (Saved Offline)' : 'Receipt Preview'}
        visible={receiptDialog.open}
        onHide={() => setReceiptDialog({ open: false })}
        style={{ width: 460 }}
      >
        {receiptDialog.receipt && (
          <>
            {receiptDialog.offline && (
              <div className="p-2 mb-2 border-round text-sm" style={{ background: '#fef3c7', color: '#92400e' }}>
                <i className="ph ph-info mr-2" />
                This sale is saved offline. The receipt # is temporary — it will be reassigned by the server on sync.
              </div>
            )}
            <div className="receipt-preview">
              {renderReceiptText(receiptDialog.receipt)}
              {receiptDialog.receipt.printQrCode && receiptDialog.receipt.qrDataUrl && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <img src={receiptDialog.receipt.qrDataUrl} alt="QR" style={{ width: 90 }} />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Button label="Close" icon="ph ph-x" outlined onClick={() => setReceiptDialog({ open: false })} className="flex-1" />
              <Button label="Print" icon="ph ph-printer" onClick={handlePrint} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
