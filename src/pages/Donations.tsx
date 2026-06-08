import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Checkbox } from 'primereact/checkbox';
import { SelectButton } from 'primereact/selectbutton';
import { Message } from 'primereact/message';
import { eventsApi, donationPurposesApi, orgApi } from '@/api';
import { donationsApi } from '@/api/donations';
import type { PaymentMode } from '@/types';
import type { DonationReceiptPayload } from '@/types/donation';
import { formatINR, apiErrorMessage } from '@/utils/format';
import { toastSuccess, toastError } from '@/components/toast';
import { printDonationA4 } from '@/utils/printDonationA4';
import { renderReceiptText } from '@/utils/printReceipt';
import PageHeader from '@/components/PageHeader';

const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: 'Cash',  value: 'CASH' },
  { label: 'UPI',   value: 'UPI' },
  { label: 'Card',  value: 'CARD' },
  { label: 'Other', value: 'OTHER' },
];

const PRESET_AMOUNTS = [101, 251, 501, 1001, 2501, 5001, 11_000, 21_000];
const FALLBACK_PURPOSE = 'General Donation';

export default function DonationsPage() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState(FALLBACK_PURPOSE);
  const [devoteeName, setDevoteeName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [is80GEligible, setIs80GEligible] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptDialog, setReceiptDialog] = useState<{ open: boolean; receipt?: DonationReceiptPayload; id?: string }>({ open: false });

  const { data: events } = useQuery({
    queryKey: ['events-active-for-donation'],
    queryFn: () => eventsApi.list({ page: 1, limit: 100, status: 'ONGOING' }),
    refetchOnMount: 'always',
  });

  const { data: purposes = [] } = useQuery({
    queryKey: ['donation-purposes-active'],
    queryFn: donationPurposesApi.active,
    refetchOnMount: 'always',
  });

  // Org settings carry the A4 formatting choices that the print template uses.
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.get });

  const needsPAN = is80GEligible && (amount ?? 0) > 2000;
  const panValid = !panNumber || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.toUpperCase());
  const canSubmit =
    (isAnonymous || devoteeName.trim().length >= 2) &&
    amount && amount > 0 &&
    (!needsPAN || (panValid && panNumber.length === 10));

  const create = useMutation({
    mutationFn: donationsApi.create,
    onSuccess: ({ donation, receipt }) => {
      toastSuccess('Donation received', `Receipt ${donation.receiptNumber} — ${formatINR(Number(donation.amount))}`);
      setReceiptDialog({ open: true, receipt, id: donation._id });
      // reset
      setDevoteeName(''); setMobile(''); setEmail(''); setAddress(''); setPanNumber('');
      setAmount(null); setTransactionRef(''); setNotes('');
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (e) => toastError('Donation failed', apiErrorMessage(e)),
  });

  const submit = () => {
    if (!canSubmit) return;
    create.mutate({
      eventId: eventId || undefined,
      purpose,
      devoteeName: isAnonymous ? 'Anonymous' : devoteeName.trim(),
      mobileNumber: mobile.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      panNumber: panNumber.trim().toUpperCase() || undefined,
      isAnonymous,
      amount: amount!,
      paymentMode,
      transactionRef: transactionRef.trim() || undefined,
      is80GEligible,
      notes: notes.trim() || undefined,
    });
  };

  const print = async () => {
    if (!receiptDialog.receipt) return;
    // Donations print on A4 letterhead, not thermal — pick any A4 printer
    // from the browser's print dialog (USB, WiFi, OS-installed network etc).
    const opened = printDonationA4(receiptDialog.receipt, org);
    if (!opened) {
      toastError('Pop-up blocked', 'Allow pop-ups for this site so the receipt window can open.');
      return;
    }
    toastSuccess('Receipt opened in a new window', 'Pick your A4 printer in the print dialog.');
    if (receiptDialog.id) donationsApi.markPrinted(receiptDialog.id).catch(() => {});
  };

  return (
    <div className="flex flex-column gap-3">
      <PageHeader
        icon="ph ph-hand-heart"
        title="Donations"
        subtitle="Record donations and issue 80G receipts."
      />

      <div className="grid">
      <div className="col-12 lg:col-7">
        <div className="soft-card">
          <div className="flex align-items-center gap-2 mb-3">
            <i className="ph ph-user-circle" style={{ fontSize: 20, color: '#b45309' }} />
            <span className="font-semibold text-900">Donor Details</span>
          </div>
          <div className="flex flex-column gap-3">
            <div className="grid">
              <div className="col-6">
                <label className="block text-sm font-semibold mb-1">Event (optional)</label>
                <Dropdown
                  className="w-full"
                  value={eventId}
                  options={events?.items ?? []}
                  optionLabel="eventName" optionValue="_id"
                  placeholder="General — no event"
                  onChange={(e) => setEventId(e.value)}
                  showClear
                />
              </div>
              <div className="col-6">
                <label className="block text-sm font-semibold mb-1">Purpose</label>
                <Dropdown
                  className="w-full" value={purpose}
                  options={purposes.map((p) => ({ label: p.purposeName, value: p.purposeName }))}
                  onChange={(e) => setPurpose(e.value)}
                  placeholder={purposes.length === 0 ? 'No purposes configured' : 'Select purpose'}
                  filter
                />
              </div>
            </div>

            <div className="flex align-items-center gap-2">
              <Checkbox inputId="anon" checked={isAnonymous} onChange={(e) => setIsAnonymous(!!e.checked)} />
              <label htmlFor="anon" className="cursor-pointer">Anonymous donation</label>
            </div>

            {!isAnonymous && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-1">Devotee Name *</label>
                  <InputText className="w-full" value={devoteeName} onChange={(e) => setDevoteeName(e.target.value)} />
                </div>
                <div className="grid">
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Mobile</label>
                    <InputText className="w-full" value={mobile} onChange={(e) => setMobile(e.target.value)} keyfilter="num" />
                  </div>
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <InputText className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Address {is80GEligible && '(for 80G certificate)'}</label>
                  <InputTextarea className="w-full" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    PAN {needsPAN && <span className="text-red-600">* (required &gt; ₹2000 for 80G)</span>}
                  </label>
                  <InputText
                    className={`w-full ${panNumber && !panValid ? 'p-invalid' : ''}`}
                    value={panNumber} maxLength={10}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                  />
                  {panNumber && !panValid && <small className="text-red-600">Format: 5 letters, 4 digits, 1 letter</small>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="col-12 lg:col-5">
        <div className="soft-card">
          <div className="flex align-items-center gap-2 mb-3">
            <i className="ph ph-coins" style={{ fontSize: 20, color: '#b45309' }} />
            <span className="font-semibold text-900">Donation Amount</span>
          </div>
          <div className="flex flex-column gap-3">
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((a) => (
                <Button
                  key={a}
                  label={`₹${a.toLocaleString('en-IN')}`}
                  size="small"
                  outlined={amount !== a}
                  onClick={() => setAmount(a)}
                />
              ))}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Amount *</label>
              <InputNumber
                className="w-full"
                value={amount} onValueChange={(e) => setAmount(e.value ?? null)}
                mode="currency" currency="INR" locale="en-IN" min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Payment Mode</label>
              <SelectButton value={paymentMode} options={PAYMENT_OPTIONS} onChange={(e) => setPaymentMode(e.value)} />
            </div>
            {paymentMode !== 'CASH' && (
              <div>
                <label className="block text-sm font-semibold mb-1">Transaction Reference</label>
                <InputText className="w-full" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UPI Ref / Cheque No / Last 4 digits" />
              </div>
            )}
            <div className="flex align-items-center gap-2">
              <Checkbox inputId="80g" checked={is80GEligible} onChange={(e) => setIs80GEligible(!!e.checked)} />
              <label htmlFor="80g" className="cursor-pointer">Issue 80G tax-exempt receipt</label>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Notes (internal)</label>
              <InputTextarea className="w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {needsPAN && !panNumber && (
              <Message severity="warn" text="PAN is required for 80G donations above ₹2000" />
            )}

            <Button
              label={create.isPending ? 'Processing...' : `Receive Donation — ${amount ? formatINR(amount) : '—'}`}
              icon="ph ph-printer"
              className="w-full"
              style={{ background: '#b45309', borderColor: '#b45309' }}
              loading={create.isPending}
              disabled={!canSubmit}
              onClick={submit}
            />
          </div>
        </div>
      </div>
      </div>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className="ph ph-receipt" />
            </span>
            <span>Donation Receipt</span>
          </div>
        }
        visible={receiptDialog.open}
        onHide={() => setReceiptDialog({ open: false })}
        style={{ width: 460 }}
      >
        {receiptDialog.receipt && (
          <>
            <div className="receipt-preview">
              {renderReceiptText(receiptDialog.receipt as any)}
            </div>
            <div className="flex gap-2 mt-3">
              <Button label="Close" outlined onClick={() => setReceiptDialog({ open: false })} className="flex-1" />
              <Button label="Print" icon="ph ph-printer" onClick={print} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
