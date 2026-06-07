import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Calendar } from 'primereact/calendar';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { ticketsApi } from '@/api';
import type { Ticket, ReceiptPayload } from '@/types';
import { formatDateTime, formatINR } from '@/utils/format';
import { renderReceiptText } from '@/utils/printReceipt';
import { smartPrint } from '@/utils/printBridge';
import { toastError, toastSuccess, toastInfo } from '@/components/toast';

export default function TicketsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [receipt, setReceipt] = useState<{ open: boolean; data?: ReceiptPayload; ticketId?: string }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, search, range],
    queryFn: () => ticketsApi.list({
      page, limit: 20,
      search: search || undefined,
      from: range[0]?.toISOString(),
      to: range[1]?.toISOString(),
    }),
  });

  const reprint = async (id: string) => {
    try {
      const r = await ticketsApi.getReceipt(id);
      setReceipt({ open: true, data: r, ticketId: id });
    } catch (e: any) {
      toastError('Failed to load receipt', e.message);
    }
  };

  const print = async () => {
    if (!receipt.data) return;
    const result = await smartPrint(receipt.data, receipt.ticketId);
    if (result.method === 'backend')    toastSuccess('Sent to server printer');
    else if (result.method === 'agent') toastSuccess('Sent to local printer');
    else                                toastInfo('Opened browser print dialog');
  };

  return (
    <Card>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="p-input-icon-left flex-1" style={{ minWidth: 200 }}>
          <i className="ph ph-magnifying-glass" />
          <InputText placeholder="Receipt / booking / devotee / mobile" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full" />
        </span>
        <Calendar
          value={range as any}
          onChange={(e) => setRange((e.value as any) ?? [null, null])}
          selectionMode="range" readOnlyInput dateFormat="dd M yy"
          placeholder="Date range" showButtonBar
        />
      </div>

      <DataTable
        value={data?.items ?? []}
        loading={isLoading}
        paginator lazy
        first={(page - 1) * 20}
        rows={20}
        totalRecords={data?.total ?? 0}
        onPage={(e) => setPage((e.page ?? 0) + 1)}
        emptyMessage="No tickets"
      >
        <Column field="receiptNumber" header="Receipt" />
        <Column field="bookingNumber" header="Booking" />
        <Column header="Event" body={(r: Ticket) => r.eventName} />
        <Column header="Seva" body={(r: Ticket) => r.sevaName} />
        <Column field="devoteeName" header="Devotee" />
        <Column field="quantity" header="Qty" />
        <Column header="Amount" body={(r: Ticket) => <b style={{ color: '#b45309' }}>{formatINR(Number(r.totalAmount))}</b>} />
        <Column header="Payment" body={(r: Ticket) => <Tag value={r.paymentMode} />} />
        <Column header="Sold By" body={(r: Ticket) => r.soldByName} />
        <Column header="Sold At" body={(r: Ticket) => formatDateTime(r.soldAt)} />
        <Column header="" body={(r: Ticket) => (
          <Button icon="ph ph-printer" rounded text tooltip="Reprint" onClick={() => reprint(r._id)} />
        )} />
      </DataTable>

      <Dialog header="Reprint Receipt" visible={receipt.open} onHide={() => setReceipt({ open: false })} style={{ width: 460 }}>
        {receipt.data && (
          <>
            <div className="receipt-preview">
              {renderReceiptText(receipt.data)}
              {receipt.data.printQrCode && receipt.data.qrDataUrl && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <img src={receipt.data.qrDataUrl} alt="QR" style={{ width: 90 }} />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Button label="Close" outlined onClick={() => setReceipt({ open: false })} className="flex-1" />
              <Button label="Print" icon="ph ph-printer" onClick={print} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
            </div>
          </>
        )}
      </Dialog>
    </Card>
  );
}
