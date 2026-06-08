import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Tag } from 'primereact/tag';
import { MultiSelect } from 'primereact/multiselect';
import { InputSwitch } from 'primereact/inputswitch';
import { Message } from 'primereact/message';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { eventsApi, sevasApi } from '@/api';
import type { Event, EventStatus, Seva, SevaEventRef } from '@/types';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage, formatDateTime, formatINR } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

const STATUS_OPTIONS = [
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Ongoing', value: 'ONGOING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const statusSeverity = (s: EventStatus) =>
  s === 'ONGOING' ? 'success' : s === 'UPCOMING' ? 'info' : s === 'COMPLETED' ? 'secondary' : 'danger';

const refId = (r: SevaEventRef): string => (typeof r === 'string' ? r : r._id);
const refName = (r: SevaEventRef): string => (typeof r === 'string' ? r : r.eventName);
const isAttachedTo = (s: Seva, eventId: string): boolean =>
  (s.eventIds ?? []).some((r) => refId(r) === eventId);

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<any>({
    eventName: '', description: '', startDate: null, endDate: null, location: '', status: 'UPCOMING', collectDevoteeDetails: false,
  });
  const [pickedSevas, setPickedSevas] = useState<Seva[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['events', page, search, statusFilter],
    queryFn: () => eventsApi.list({ page, limit: 20, search: search || undefined, status: statusFilter || undefined }),
  });

  // The picker shows real existing sevas (with _ids) — never templates. New
  // sevas are created on the Sevas page; this picker only attaches existing
  // records to the event by reassigning their eventId.
  // staleTime stays at the default (0) so every dialog open refetches — picks
  // up sevas that were just created on the Sevas page in another tab/route.
  const { data: allSevas } = useQuery({
    queryKey: ['sevas-for-attach'],
    // 100 = the backend's listQuerySchema max. Plenty for a master seva list
    // at a single org; if you outgrow this we'll need pagination on the picker.
    queryFn: () => sevasApi.list({ page: 1, limit: 100 }),
    enabled: editorOpen,
    refetchOnMount: 'always',
  });

  // Hide sevas already attached to the event being edited.
  const pickableSevas = useMemo<Seva[]>(() => {
    const items = (allSevas?.items ?? []) as Seva[];
    if (!editing) return items;
    return items.filter((s) => !isAttachedTo(s, editing._id));
  }, [allSevas, editing]);

  // After an event mutation, refresh every query whose result depends on the
  // event list (Counter Sales picker, Donations picker, the Sevas filter, the
  // mobile app's ongoing list).
  const invalidateEventLists = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['events-ongoing'] });
    queryClient.invalidateQueries({ queryKey: ['events-active-for-donation'] });
    queryClient.invalidateQueries({ queryKey: ['events-all-for-sevas'] });
  };

  const removeMutation = useMutation({
    mutationFn: eventsApi.remove,
    onSuccess: () => { toastSuccess('Event deleted'); invalidateEventLists(); },
    onError: (e) => toastError('Delete failed', apiErrorMessage(e)),
  });

  const reset = () => {
    setEditorOpen(false); setEditing(null);
    setForm({ eventName: '', description: '', startDate: null, endDate: null, location: '', status: 'UPCOMING', collectDevoteeDetails: false });
    setPickedSevas([]);
  };

  const openCreate = () => { reset(); setEditorOpen(true); };
  const openEdit = (ev: Event) => {
    reset();
    setEditing(ev);
    setForm({
      eventName: ev.eventName, description: ev.description ?? '',
      startDate: new Date(ev.startDate), endDate: new Date(ev.endDate),
      location: ev.location ?? '', status: ev.status,
      collectDevoteeDetails: ev.collectDevoteeDetails ?? false,
    });
    setEditorOpen(true);
  };

  const submit = async () => {
    if (!form.eventName || !form.startDate || !form.endDate) return toastError('Name, start, end required');
    if (form.endDate < form.startDate) return toastError('End date must be on or after the start date');
    setSubmitting(true);
    try {
      // Date-only pickers give us midnight. Bump endDate to end-of-day so the
      // "ongoing" filter (endDate >= now in event.service.ts) keeps the event
      // active through its last day.
      const endOfDay = new Date(form.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      const payload = { ...form, endDate: endOfDay };

      let eventId: string;
      if (editing) {
        await eventsApi.update(editing._id, payload);
        eventId = editing._id;
      } else {
        const created = await eventsApi.create(payload);
        eventId = created._id;
      }

      // Append this event to each picked seva's eventIds (don't overwrite —
      // a seva can be on many events at once). Skip sevas that are already
      // attached, just in case the picker state got out of sync.
      for (const s of pickedSevas) {
        if (isAttachedTo(s, eventId)) continue;
        const current = (s.eventIds ?? []).map(refId);
        await sevasApi.update(s._id, { eventIds: [...current, eventId] });
      }

      const attached = pickedSevas.length;
      toastSuccess(
        editing ? 'Event updated' : 'Event created',
        attached ? `${attached} seva(s) attached to this event` : undefined,
      );
      reset();
      invalidateEventLists();
      if (attached) {
        queryClient.invalidateQueries({ queryKey: ['sevas'] });
        queryClient.invalidateQueries({ queryKey: ['sevas-for-attach'] });
        // Sevas were re-attached — refresh per-event seva lists too.
        queryClient.invalidateQueries({ queryKey: ['sevas-by-event'] });
      }
    } catch (e) {
      toastError(editing ? 'Update failed' : 'Create failed', apiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (ev: Event) =>
    confirmDialog({
      message: `Delete "${ev.eventName}"? Cannot be undone.`,
      header: 'Confirm', icon: 'ph ph-warning',
      acceptClassName: 'p-button-danger',
      accept: () => removeMutation.mutate(ev._id),
    });

  const alreadyAttachedElsewhere = pickedSevas.some(
    (s) => (s.eventIds ?? []).length > 0,
  );

  return (
    <div className="flex flex-column gap-3">
      <ConfirmDialog />
      <PageHeader
        icon="ph ph-calendar"
        title="Events"
        subtitle="Create and manage events, attach sevas, and toggle devotee collection."
        actions={<Button label="New Event" icon="ph ph-plus" onClick={openCreate} className="p-button-rounded" style={{ background: '#fff', borderColor: '#fff', color: '#b45309' }} />}
      />

      <div className="soft-card flex align-items-center gap-2 flex-wrap">
        <span className="p-input-icon-left">
          <i className="ph ph-magnifying-glass" />
          <InputText placeholder="Search events..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </span>
        <Dropdown
          value={statusFilter} onChange={(e) => { setStatusFilter(e.value); setPage(1); }}
          options={STATUS_OPTIONS} placeholder="All statuses" showClear
        />
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
        emptyMessage="No events"
      >
        <Column field="eventId" header="Code" />
        <Column field="eventName" header="Event Name" />
        <Column field="location" header="Location" body={(r: Event) => r.location ?? '—'} />
        <Column header="Start" body={(r: Event) => formatDateTime(r.startDate)} />
        <Column header="End" body={(r: Event) => formatDateTime(r.endDate)} />
        <Column header="Status" body={(r: Event) => <Tag severity={statusSeverity(r.status)} value={r.status} />} />
        <Column header="Actions" body={(r: Event) => (
          <div className="flex gap-1">
            <Button icon="ph ph-pencil-simple" rounded text size="small" onClick={() => openEdit(r)} />
            <Button icon="ph ph-trash" rounded text size="small" severity="danger" onClick={() => confirmDelete(r)} />
          </div>
        )} />
      </DataTable>
      </div>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className={editing ? 'ph ph-pencil-simple' : 'ph ph-calendar'} />
            </span>
            <span>{editing ? 'Edit Event' : 'New Event'}</span>
          </div>
        }
        visible={editorOpen} onHide={reset} style={{ width: 600 }}
      >
        <div className="flex flex-column gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Event Name *</label>
            <InputText className="w-full" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <InputTextarea className="w-full" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid">
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Start Date *</label>
              <Calendar
                className="w-full"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.value })}
                dateFormat="dd M yy"
                showIcon
                readOnlyInput
                panelClassName="compact-calendar"
                minDate={new Date(new Date().getFullYear() - 1, 0, 1)}
              />
            </div>
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">End Date *</label>
              <Calendar
                className="w-full"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.value })}
                dateFormat="dd M yy"
                showIcon
                readOnlyInput
                panelClassName="compact-calendar"
                minDate={form.startDate ?? undefined}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Location</label>
            <InputText className="w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Status</label>
            <Dropdown className="w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.value })} options={STATUS_OPTIONS} />
          </div>

          <div className={`toggle-card ${form.collectDevoteeDetails ? 'is-on' : ''}`}>
            <div className="flex align-items-start gap-2">
              <i className="ph ph-identification-card text-2xl" style={{ color: '#b45309' }} />
              <div>
                <div className="toggle-card__title">Collect devotee details</div>
                <small className="text-600">When on, phone number is mandatory for participation; name, gothram &amp; nakshatram stay optional.</small>
              </div>
            </div>
            <InputSwitch checked={form.collectDevoteeDetails} onChange={(e) => setForm({ ...form, collectDevoteeDetails: e.value })} />
          </div>

          <div className="border-top-1 surface-border pt-3 mt-1">
            <label className="block text-sm font-semibold mb-1">Attach existing sevas</label>
            <MultiSelect
              className="w-full"
              value={pickedSevas}
              options={pickableSevas}
              optionLabel="sevaName"
              dataKey="_id"
              filter
              display="chip"
              placeholder={
                (allSevas?.items.length ?? 0) === 0
                  ? 'No sevas exist yet — create them on the Sevas page'
                  : 'Pick from existing sevas...'
              }
              disabled={(allSevas?.items.length ?? 0) === 0}
              onChange={(e) => setPickedSevas(e.value)}
              itemTemplate={(s: Seva) => {
                const refs = s.eventIds ?? [];
                const subtitle = refs.length === 0
                  ? 'not attached to any event'
                  : `also in: ${refs.map(refName).join(', ')}`;
                return (
                  <div className="flex justify-content-between align-items-center w-full gap-2">
                    <div className="flex flex-column">
                      <span className="font-semibold">{s.sevaName}</span>
                      <span className="text-xs text-500">{subtitle}</span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#b45309' }}>
                      {formatINR(Number(s.price))}
                    </span>
                  </div>
                );
              }}
            />
            <small className="text-500 block mt-1">
              New sevas are created only on the Sevas page. The same seva can be attached to multiple events — inventory is shared across them.
            </small>
            {alreadyAttachedElsewhere && (
              <Message
                severity="info"
                className="mt-2"
                text="Some picked sevas are already on other events. They will stay there too — this just adds them to this event."
              />
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={reset} className="flex-1" disabled={submitting} />
            <Button
              label={editing ? 'Update' : 'Create'}
              onClick={submit}
              loading={submitting}
              className="flex-1"
              style={{ background: '#b45309', borderColor: '#b45309' }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
