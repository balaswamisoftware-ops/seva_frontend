import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Calendar } from 'primereact/calendar';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { donationsApi } from '@/api/donations';
import { orgApi } from '@/api';
import type { Donation, DonationReceiptPayload } from '@/types/donation';
import { formatINR, formatDateTime, apiErrorMessage } from '@/utils/format';
import { renderReceiptText } from '@/utils/printReceipt';
import { printDonationA4 } from '@/utils/printDonationA4';
import { toastSuccess, toastError } from '@/components/toast';
import PageHeader from '@/components/PageHeader';

export default function DonationsHistoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);

  // Debounce the search box so we don't fire a query (and reset the page) on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);
  const [receipt, setReceipt] = useState<{ open: boolean; data?: DonationReceiptPayload }>({ open: false });
  const [certDialog, setCertDialog] = useState<{ open: boolean; data?: any }>({ open: false });

  // Org settings drive the A4 formatting (accent color, alignment, bold, etc).
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.get });

  const { data, isLoading } = useQuery({
    queryKey: ['donations', page, debouncedSearch, range],
    queryFn: () => donationsApi.list({
      page, limit: 20,
      search: debouncedSearch || undefined,
      from: range[0]?.toISOString(),
      to: range[1]?.toISOString(),
    }),
  });

  const issue80G = useMutation({
    mutationFn: donationsApi.issue80G,
    onSuccess: () => { toastSuccess('80G certificate issued'); queryClient.invalidateQueries({ queryKey: ['donations'] }); },
    onError: (e) => toastError('Issue failed', apiErrorMessage(e)),
  });

  const reprint = async (id: string) => {
    try {
      const r = await donationsApi.getReceipt(id);
      setReceipt({ open: true, data: r });
    } catch (e: any) { toastError('Failed', e.message); }
  };

  const viewCert = async (id: string) => {
    try {
      const c = await donationsApi.get80GCert(id);
      setCertDialog({ open: true, data: c });
    } catch (e: any) { toastError('Failed', e.message); }
  };

  const confirmIssue = (d: Donation) =>
    confirmDialog({
      message: `Issue 80G certificate for ${d.devoteeName} (${formatINR(Number(d.amount))})? Once issued, the certificate number is permanent.`,
      header: 'Confirm 80G Certificate',
      icon: 'ph ph-warning',
      accept: () => issue80G.mutate(d._id),
    });

  return (
    <div className="flex flex-column gap-3">
      <ConfirmDialog />
      <PageHeader
        icon="ph ph-list-checks"
        title="Donation History"
        subtitle="Search past donations and reprint 80G receipts."
      />

      <div className="soft-card flex align-items-center gap-2 flex-wrap">
        <span className="p-input-icon-left" style={{ minWidth: 220 }}>
          <i className="ph ph-magnifying-glass" />
          <InputText placeholder="Receipt / PAN / name / mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
        </span>
        <Calendar
          value={range as any}
          onChange={(e) => { setRange((e.value as any) ?? [null, null]); setPage(1); }}
          selectionMode="range" readOnlyInput dateFormat="dd M yy"
          placeholder="Date range" showButtonBar
        />
        <div className="font-semibold text-lg ml-auto" style={{ color: '#b45309' }}>
          Total: {formatINR(data?.totalAmount ?? 0)} ({data?.total ?? 0})
        </div>
      </div>

      <div className="soft-card p-0" style={{ overflow: 'hidden' }}>
      <DataTable
        className="fancy-table"
        value={data?.items ?? []}
        loading={isLoading}
        paginator lazy
        first={(page - 1) * 20}
        rows={20}
        totalRecords={data?.total ?? 0}
        onPage={(e) => setPage((e.page ?? 0) + 1)}
        emptyMessage="No donations"
      >
        <Column field="receiptNumber" header="Receipt" />
        <Column field="devoteeName"   header="Donor" />
        <Column field="panNumber"     header="PAN" body={(r: Donation) => r.panNumber ?? '—'} />
        <Column field="purpose"       header="Purpose" />
        <Column header="Amount" body={(r: Donation) => <span style={{ color: '#b45309', fontWeight: 700 }}>{formatINR(Number(r.amount))}</span>} />
        <Column header="Payment" body={(r: Donation) => <Tag value={r.paymentMode} />} />
        <Column header="80G" body={(r: Donation) => (
          r.is80GEligible
            ? r.cert80GIssued
              ? <Tag severity="success" value={r.cert80GNumber} />
              : <Tag severity="warning" value="Pending" />
            : <Tag severity="secondary" value="N/A" />
        )} />
        <Column header="Sold By" body={(r: Donation) => r.soldByName} />
        <Column header="Date" body={(r: Donation) => formatDateTime(r.soldAt)} />
        <Column header="Actions" body={(r: Donation) => (
          <div className="flex gap-1">
            <Button icon="ph ph-printer" rounded text size="small" tooltip="Reprint" onClick={() => reprint(r._id)} />
            {r.is80GEligible && !r.cert80GIssued && (
              <Button icon="ph ph-identification-card" rounded text size="small" severity="warning" tooltip="Issue 80G cert" onClick={() => confirmIssue(r)} />
            )}
            {r.cert80GIssued && (
              <Button icon="ph ph-file" rounded text size="small" severity="success" tooltip="View certificate" onClick={() => viewCert(r._id)} />
            )}
          </div>
        )} />
      </DataTable>
      </div>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className="ph ph-printer" />
            </span>
            <span>Reprint Receipt</span>
          </div>
        }
        visible={receipt.open} onHide={() => setReceipt({ open: false })} style={{ width: 460 }}
      >
        {receipt.data && (
          <>
            <div className="receipt-preview">{renderReceiptText(receipt.data as any)}</div>
            <div className="flex gap-2 mt-3">
              <Button label="Close" outlined onClick={() => setReceipt({ open: false })} className="flex-1" />
              <Button
                label="Print A4"
                icon="ph ph-printer"
                onClick={() => {
                  if (!receipt.data) return;
                  const opened = printDonationA4(receipt.data, org);
                  if (opened) toastSuccess('Receipt opened in a new window', 'Pick your A4 printer in the print dialog.');
                  else toastError('Pop-up blocked', 'Allow pop-ups for this site.');
                }}
                className="flex-1"
                style={{ background: '#b45309', borderColor: '#b45309' }}
              />
            </div>
          </>
        )}
      </Dialog>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className="ph ph-file" />
            </span>
            <span>80G Tax Certificate</span>
          </div>
        }
        visible={certDialog.open} onHide={() => setCertDialog({ open: false })} style={{ width: 640 }}
      >
        {certDialog.data && (
          <div className="p-3" style={{ border: '2px solid #b45309' }}>
            <div className="text-center mb-3">
              <div className="text-2xl font-bold" style={{ color: '#b45309' }}>{certDialog.data.org.name}</div>
              <div className="text-sm text-500">{certDialog.data.org.address}</div>
              <div className="text-xs">Certificate No: <b>{certDialog.data.certNumber}</b></div>
              <div className="text-xs">FY: <b>{certDialog.data.financialYear}</b></div>
            </div>
            <div className="text-center text-lg font-bold border-y-1 surface-border py-2 mb-3">
              CERTIFICATE OF DONATION (Section 80G)
            </div>
            <div className="line-height-3">
              <p>Certified that we have received a sum of <b>{formatINR(certDialog.data.donation.amount)}</b> ({certDialog.data.donation.amountInWords}) from:</p>
              <p>
                <b>{certDialog.data.donor.name}</b><br />
                {certDialog.data.donor.address}<br />
                PAN: <b>{certDialog.data.donor.pan}</b>
              </p>
              <p>Purpose: <b>{certDialog.data.donation.purpose}</b></p>
              <p>Receipt No: <b>{certDialog.data.donation.receiptNumber}</b> | Date: <b>{formatDateTime(certDialog.data.donation.date)}</b></p>
              <p>Mode: {certDialog.data.donation.paymentMode}{certDialog.data.donation.transactionRef ? ` (Ref: ${certDialog.data.donation.transactionRef})` : ''}</p>
              <p className="mt-3 text-sm">This donation is eligible for tax deduction under Section 80G of the Income Tax Act, 1961.</p>
            </div>
            <div className="text-right mt-4">
              <div>For {certDialog.data.org.name}</div>
              <div className="mt-4 text-xs text-500">Authorized Signatory</div>
            </div>
            <div className="flex justify-content-end mt-3">
              <Button label="Print" icon="ph ph-printer" onClick={() => window.print()} style={{ background: '#b45309', borderColor: '#b45309' }} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
