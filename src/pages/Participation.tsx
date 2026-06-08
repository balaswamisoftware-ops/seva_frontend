import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import { eventsApi, sevasApi, devoteesApi, participationsApi } from '@/api';
import type { Event, Seva, PaymentMode } from '@/types';
import { toastSuccess, toastError, toastInfo } from '@/components/toast';
import { apiErrorMessage, formatDateTime, formatINR } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

const PHONE_RE = /^[6-9]\d{9}$/;
const PAYMENT_OPTIONS = ['CASH', 'UPI', 'CARD', 'OTHER'].map((v) => ({ label: v, value: v }));
const emptyForm = { phoneNumber: '', fullName: '', gothram: '', nakshatram: '', sevaId: '', quantity: 1, paymentMode: 'CASH' as PaymentMode, notes: '' };
const initials = (name?: string) => (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export default function ParticipationPage() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [lookupDone, setLookupDone] = useState<'idle' | 'found' | 'new'>('idle');

  const { data: events } = useQuery({ queryKey: ['events-ongoing'], queryFn: () => eventsApi.ongoing() });
  const selectedEvent: Event | undefined = events?.find((e) => e._id === eventId);

  const { data: sevas } = useQuery({
    queryKey: ['sevas-by-event', eventId],
    queryFn: () => sevasApi.byEvent(eventId),
    enabled: !!eventId,
  });

  const { data: participations, isLoading } = useQuery({
    queryKey: ['participations', eventId],
    queryFn: () => participationsApi.list({ eventId, limit: 50 }),
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: participationsApi.create,
    onSuccess: (res) => {
      toastSuccess('Participation recorded', res.message);
      setOpen(false); setForm({ ...emptyForm }); setLookupDone('idle');
      queryClient.invalidateQueries({ queryKey: ['participations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['devotees'] });
    },
    onError: (e) => toastError('Failed', apiErrorMessage(e)),
  });

  const requiresPhone = !!selectedEvent?.collectDevoteeDetails;
  const rows = participations?.items ?? [];
  const collected = rows.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  const doLookup = async () => {
    if (!PHONE_RE.test(form.phoneNumber)) return toastError('Enter a valid 10-digit mobile number');
    try {
      const d = await devoteesApi.lookup(form.phoneNumber);
      if (d) {
        setForm((f) => ({ ...f, fullName: d.fullName, gothram: d.gothram ?? '', nakshatram: d.nakshatram ?? '' }));
        setLookupDone('found');
        toastInfo('Existing devotee', `${d.fullName} (${d.devoteeId}) — details linked`);
      } else {
        setLookupDone('new');
        toastInfo('New devotee', 'No match found — a new devotee will be created on save');
      }
    } catch (e) { toastError('Lookup failed', apiErrorMessage(e)); }
  };

  const submit = () => {
    if (requiresPhone && !PHONE_RE.test(form.phoneNumber)) return toastError('This event requires a valid phone number');
    if (form.phoneNumber && !PHONE_RE.test(form.phoneNumber)) return toastError('Enter a valid 10-digit mobile number');
    createMutation.mutate({
      eventId,
      phoneNumber: form.phoneNumber || undefined,
      fullName: form.fullName || undefined,
      gothram: form.gothram || undefined,
      nakshatram: form.nakshatram || undefined,
      sevaId: form.sevaId || undefined,
      quantity: form.quantity,
      paymentMode: form.paymentMode,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="flex flex-column gap-3">
      <PageHeader
        icon="ph ph-hand-heart"
        title="Event Participation"
        subtitle="Record a devotee taking part in an event. Look up by phone — existing devotees are linked, new ones are created automatically."
        actions={
          <Button
            label="Add Participation" icon="ph ph-plus" disabled={!eventId}
            onClick={() => { setForm({ ...emptyForm }); setLookupDone('idle'); setOpen(true); }}
            className="p-button-rounded" style={{ background: '#fff', borderColor: '#fff', color: '#b45309' }}
          />
        }
      />

      <div className="soft-card flex align-items-center gap-3 flex-wrap">
        <span className="font-semibold text-700"><i className="ph ph-calendar-check mr-1" />Event</span>
        <Dropdown
          value={eventId}
          onChange={(e) => setEventId(e.value)}
          options={(events ?? []).map((e) => ({ label: `${e.eventName} (${e.eventId})`, value: e._id }))}
          placeholder="Select an ongoing event"
          style={{ minWidth: 300 }}
          filter
        />
        {selectedEvent && (
          <Tag
            icon={requiresPhone ? 'ph ph-phone' : 'ph ph-info'}
            severity={requiresPhone ? 'warning' : 'info'}
            value={requiresPhone ? 'Phone required' : 'Devotee details optional'}
          />
        )}
      </div>

      {!eventId ? (
        <div className="soft-card text-center py-6">
          <i className="ph ph-hand-heart text-4xl" style={{ color: '#d97706' }} />
          <div className="text-700 font-semibold mt-2">Pick an event to begin</div>
          <div className="text-500 text-sm">Select an ongoing event above to view and record participation.</div>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-card__ico"><i className="ph ph-users-three" /></div>
              <div><div className="stat-card__label">Participants</div><div className="stat-card__value">{participations?.total ?? 0}</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-card__ico"><i className="ph ph-wallet" /></div>
              <div><div className="stat-card__label">Collected</div><div className="stat-card__value">{formatINR(collected)}</div></div>
            </div>
          </div>

          <div className="soft-card p-0" style={{ overflow: 'hidden' }}>
            <DataTable className="fancy-table" value={rows} loading={isLoading} emptyMessage="No participation recorded yet." paginator rows={20}>
              <Column
                header="Devotee"
                body={(r) => (
                  <div className="flex align-items-center gap-2">
                    <div className="ini-avatar">{initials(r.devoteeName)}</div>
                    <div>
                      <div className="font-semibold text-900">{r.devoteeName || 'Anonymous'}</div>
                      <div className="text-xs text-500">{r.participationId}</div>
                    </div>
                  </div>
                )}
              />
              <Column header="Phone" body={(r) => r.phoneNumber || <span className="text-400">—</span>} />
              <Column header="Seva" body={(r) => r.sevaName || <span className="text-400">—</span>} />
              <Column header="Qty" field="quantity" />
              <Column header="Amount" body={(r) => (r.totalAmount != null ? <span className="font-semibold" style={{ color: '#b45309' }}>{formatINR(r.totalAmount)}</span> : '—')} />
              <Column header="Mode" body={(r) => <Tag value={r.paymentMode} style={{ background: '#fef3c7', color: '#92400e' }} />} />
              <Column header="When" body={(r) => <span className="text-600 text-sm">{formatDateTime(r.createdAt)}</span>} />
            </DataTable>
          </div>
        </>
      )}

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className="ph ph-hand-heart" />
            </span>
            <span>Add Participation</span>
          </div>
        }
        visible={open} onHide={() => setOpen(false)} style={{ width: 540 }}
      >
        <div className="flex flex-column gap-3 pt-2">
          {requiresPhone && <Message severity="warn" className="w-full" text="This event requires a phone number for every participant." />}
          <div>
            <label className="block text-sm font-semibold mb-1">Phone Number {requiresPhone ? '*' : ''}</label>
            <div className="flex gap-2">
              <span className="p-input-icon-left flex-1">
                <i className="ph ph-phone" />
                <InputText
                  className="w-full"
                  value={form.phoneNumber}
                  onChange={(e) => { setForm({ ...form, phoneNumber: e.target.value }); setLookupDone('idle'); }}
                  keyfilter="num" maxLength={10} placeholder="10-digit mobile"
                />
              </span>
              <Button label="Lookup" icon="ph ph-magnifying-glass" outlined onClick={doLookup} />
            </div>
            {lookupDone === 'found' && <small className="text-green-600"><i className="ph ph-check-circle mr-1" />Existing devotee linked.</small>}
            {lookupDone === 'new' && <small className="text-orange-600"><i className="ph ph-user-plus mr-1" />New devotee — will be created on save.</small>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Full Name</label>
            <span className="p-input-icon-left w-full">
              <i className="ph ph-user" />
              <InputText className="w-full" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </span>
          </div>
          <div className="grid">
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Gothram</label>
              <InputText className="w-full" value={form.gothram} onChange={(e) => setForm({ ...form, gothram: e.target.value })} placeholder="Optional" />
            </div>
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Nakshatram</label>
              <InputText className="w-full" value={form.nakshatram} onChange={(e) => setForm({ ...form, nakshatram: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <div className="toggle-card" style={{ display: 'block' }}>
            <div className="grid">
              <div className="col-7">
                <label className="block text-sm font-semibold mb-1">Seva (optional)</label>
                <Dropdown
                  className="w-full"
                  value={form.sevaId}
                  onChange={(e) => setForm({ ...form, sevaId: e.value })}
                  options={(sevas ?? []).map((s: Seva) => ({ label: `${s.sevaName} — ${formatINR(Number(s.price))}`, value: s._id }))}
                  placeholder="None"
                  showClear
                />
              </div>
              <div className="col-5">
                <label className="block text-sm font-semibold mb-1">Quantity</label>
                <InputNumber className="w-full" value={form.quantity} onValueChange={(e) => setForm({ ...form, quantity: e.value ?? 1 })} min={1} showButtons />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-sm font-semibold mb-1">Payment Mode</label>
              <Dropdown className="w-full" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.value })} options={PAYMENT_OPTIONS} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Notes</label>
            <InputTextarea className="w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={() => setOpen(false)} className="flex-1" />
            <Button label="Save Participation" icon="ph ph-check" onClick={submit} loading={createMutation.isPending} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
