import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { eventsApi, sevasApi } from '@/api';
import type { Seva, SevaStatus } from '@/types';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage, formatINR } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

const STATUS_OPTIONS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Sold Out', value: 'SOLD_OUT' },
];
const sev = (s: SevaStatus) => s === 'ACTIVE' ? 'success' : s === 'SOLD_OUT' ? 'danger' : 'warning';

const eventInfos = (refs: Seva['eventIds']): { id: string; name: string }[] =>
  (refs ?? [])
    .filter((r): r is { _id: string; eventId: string; eventName: string } => typeof r !== 'string')
    .map((r) => ({ id: r.eventId ?? '', name: r.eventName ?? '' }));

export default function SevasPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Seva | null>(null);
  const [form, setForm] = useState<any>({
    sevaName: '', description: '', price: 0, maxTickets: 0,
    status: 'ACTIVE',
  });

  const { data: eventList } = useQuery({
    queryKey: ['events-all-for-sevas'],
    queryFn: () => eventsApi.list({ page: 1, limit: 100 }),
    refetchOnMount: 'always',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sevas', page, search, eventFilter],
    queryFn: () => sevasApi.list({ page, limit: 20, search: search || undefined, eventId: eventFilter || undefined }),
  });

  // Invalidate the Events dialog's picker too so a newly-created seva shows
  // up immediately when the user goes to attach it.
  const invalidateSevaQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['sevas'] });
    queryClient.invalidateQueries({ queryKey: ['sevas-for-attach'] });
  };

  const createMutation = useMutation({
    mutationFn: sevasApi.create,
    onSuccess: () => { toastSuccess('Seva created'); reset(); invalidateSevaQueries(); },
    onError: (e) => toastError('Create failed', apiErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => sevasApi.update(id, payload),
    onSuccess: () => { toastSuccess('Seva updated'); reset(); invalidateSevaQueries(); },
    onError: (e) => toastError('Update failed', apiErrorMessage(e)),
  });
  const removeMutation = useMutation({
    mutationFn: sevasApi.remove,
    onSuccess: () => { toastSuccess('Seva removed'); invalidateSevaQueries(); },
    onError: (e) => toastError('Failed', apiErrorMessage(e)),
  });

  const reset = () => {
    setEditorOpen(false); setEditing(null);
    setForm({ sevaName: '', description: '', price: 0, maxTickets: 0, status: 'ACTIVE' });
  };

  const openCreate = () => { reset(); setEditing(null); setEditorOpen(true); };
  const openEdit = (s: Seva) => {
    setEditing(s);
    setForm({
      sevaName: s.sevaName, description: s.description ?? '',
      price: Number(s.price), maxTickets: s.maxTickets,
      status: s.status,
    });
    setEditorOpen(true);
  };

  const submit = () => {
    if (!form.sevaName) return toastError('Name is required');
    if (editing) updateMutation.mutate({ id: editing._id, payload: form });
    else createMutation.mutate(form);
  };

  const confirmDelete = (s: Seva) =>
    confirmDialog({
      message: `Delete "${s.sevaName}"? If tickets were sold it will be soft-disabled instead.`,
      header: 'Confirm', icon: 'ph ph-warning',
      acceptClassName: 'p-button-danger',
      accept: () => removeMutation.mutate(s._id),
    });

  return (
    <div className="flex flex-column gap-3">
      <ConfirmDialog />
      <PageHeader
        icon="ph ph-gift"
        title="Sevas"
        subtitle="Manage seva offerings, pricing and ticket inventory. A seva can be attached to multiple events."
        actions={<Button label="New Seva" icon="ph ph-plus" onClick={openCreate} className="p-button-rounded" style={{ background: '#fff', borderColor: '#fff', color: '#b45309' }} />}
      />

      <div className="soft-card flex align-items-center gap-2 flex-wrap">
        <span className="p-input-icon-left">
          <i className="ph ph-magnifying-glass" />
          <InputText placeholder="Search sevas..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </span>
        <Dropdown
          value={eventFilter} onChange={(e) => { setEventFilter(e.value); setPage(1); }}
          options={eventList?.items ?? []} optionLabel="eventName" optionValue="_id"
          placeholder="All events" showClear style={{ minWidth: 200 }}
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
        emptyMessage="No sevas"
      >
        <Column field="sevaId" header="Code" />
        <Column field="sevaName" header="Seva" />
        <Column header="Events" body={(r: Seva) => {
          const infos = eventInfos(r.eventIds);
          if (infos.length === 0) return <span className="text-500">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {infos.map((info) => (
                <Tag key={info.id || info.name} value={info.name} severity="info" />
              ))}
            </div>
          );
        }} />
        <Column header="Price" body={(r: Seva) => formatINR(Number(r.price))} />
        <Column header="Available" body={(r: Seva) => r.maxTickets === 0 ? <Tag severity="info" value="Unlimited" /> : `${r.availableTickets} / ${r.maxTickets}`} />
        <Column header="Status" body={(r: Seva) => <Tag severity={sev(r.status)} value={r.status} />} />
        <Column header="Actions" body={(r: Seva) => (
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
              <i className={editing ? 'ph ph-pencil-simple' : 'ph ph-gift'} />
            </span>
            <span>{editing ? 'Edit Seva' : 'New Seva'}</span>
          </div>
        }
        visible={editorOpen} onHide={reset} style={{ width: 540 }}
      >
        <div className="flex flex-column gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Seva Name *</label>
            <InputText className="w-full" value={form.sevaName} onChange={(e) => setForm({ ...form, sevaName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <InputTextarea className="w-full" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid">
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Price (₹) *</label>
              <InputNumber className="w-full" value={form.price} onValueChange={(e) => setForm({ ...form, price: e.value ?? 0 })} mode="currency" currency="INR" locale="en-IN" min={0} />
            </div>
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Max Tickets (0 = unlimited)</label>
              <InputNumber className="w-full" value={form.maxTickets} onValueChange={(e) => setForm({ ...form, maxTickets: e.value ?? 0 })} min={0} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Status</label>
            <Dropdown className="w-full" value={form.status} options={STATUS_OPTIONS} onChange={(e) => setForm({ ...form, status: e.value })} />
          </div>
          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={reset} className="flex-1" />
            <Button label={editing ? 'Update' : 'Create'} onClick={submit} loading={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
