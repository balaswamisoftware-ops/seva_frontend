import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { donationPurposesApi } from '@/api';
import type { DonationPurpose, Status } from '@/types';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

const STATUS_OPTIONS: { label: string; value: Status }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export default function DonationPurposesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DonationPurpose | null>(null);
  const [form, setForm] = useState<{ purposeName: string; status: Status }>({ purposeName: '', status: 'ACTIVE' });

  const { data, isLoading } = useQuery({
    queryKey: ['donation-purposes', page, search, statusFilter],
    queryFn: () => donationPurposesApi.list({
      page, limit: 20,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: donationPurposesApi.create,
    onSuccess: () => { toastSuccess('Purpose created'); reset(); queryClient.invalidateQueries({ queryKey: ['donation-purposes'] }); },
    onError: (e) => toastError('Create failed', apiErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => donationPurposesApi.update(id, payload),
    onSuccess: () => { toastSuccess('Purpose updated'); reset(); queryClient.invalidateQueries({ queryKey: ['donation-purposes'] }); },
    onError: (e) => toastError('Update failed', apiErrorMessage(e)),
  });
  const toggleMutation = useMutation({
    mutationFn: donationPurposesApi.toggleStatus,
    onSuccess: () => { toastSuccess('Status updated'); queryClient.invalidateQueries({ queryKey: ['donation-purposes'] }); },
    onError: (e) => toastError('Update failed', apiErrorMessage(e)),
  });

  const reset = () => {
    setEditorOpen(false); setEditing(null);
    setForm({ purposeName: '', status: 'ACTIVE' });
  };

  const openCreate = () => { reset(); setEditorOpen(true); };
  const openEdit = (p: DonationPurpose) => {
    setEditing(p);
    setForm({ purposeName: p.purposeName, status: p.status });
    setEditorOpen(true);
  };

  const submit = () => {
    if (!form.purposeName.trim()) return toastError('Purpose name is required');
    if (editing) updateMutation.mutate({ id: editing._id, payload: form });
    else createMutation.mutate(form);
  };

  return (
    <div className="flex flex-column gap-3">
      <PageHeader
        icon="ph ph-tag"
        title="Donation Purposes"
        subtitle="Manage the list of purposes donors can give towards."
        actions={<Button label="New Purpose" icon="ph ph-plus" onClick={openCreate} className="p-button-rounded" style={{ background: '#fff', borderColor: '#fff', color: '#b45309' }} />}
      />

      <div className="soft-card flex align-items-center gap-2 flex-wrap">
        <span className="p-input-icon-left">
          <i className="ph ph-magnifying-glass" />
          <InputText placeholder="Search purposes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
        emptyMessage="No donation purposes"
      >
        <Column field="purposeId" header="Purpose ID" style={{ width: 140 }} />
        <Column field="purposeName" header="Purpose Name" />
        <Column header="Status" body={(r: DonationPurpose) => (
          <Tag severity={r.status === 'ACTIVE' ? 'success' : 'warning'} value={r.status} />
        )} style={{ width: 120 }} />
        <Column header="Actions" body={(r: DonationPurpose) => (
          <div className="flex gap-1">
            <Button icon="ph ph-pencil-simple" rounded text size="small" onClick={() => openEdit(r)} />
            <Button
              icon={r.status === 'ACTIVE' ? 'ph ph-toggle-right' : 'ph ph-toggle-left'}
              rounded text size="small"
              severity={r.status === 'ACTIVE' ? 'warning' : 'success'}
              onClick={() => toggleMutation.mutate(r._id)}
              tooltip={r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            />
          </div>
        )} style={{ width: 140 }} />
      </DataTable>
      </div>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className={editing ? 'ph ph-pencil-simple' : 'ph ph-tag'} />
            </span>
            <span>{editing ? 'Edit Purpose' : 'New Donation Purpose'}</span>
          </div>
        }
        visible={editorOpen} onHide={reset} style={{ width: 460 }}
      >
        <div className="flex flex-column gap-3">
          {editing && (
            <div>
              <label className="block text-sm font-semibold mb-1">Purpose ID</label>
              <InputText className="w-full" value={editing.purposeId} disabled />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1">Purpose Name *</label>
            <InputText
              className="w-full"
              value={form.purposeName}
              onChange={(e) => setForm({ ...form, purposeName: e.target.value })}
              placeholder="e.g. Temple Construction"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Status</label>
            <Dropdown className="w-full" value={form.status} options={STATUS_OPTIONS} onChange={(e) => setForm({ ...form, status: e.value })} />
          </div>
          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={reset} className="flex-1" />
            <Button
              label={editing ? 'Update' : 'Create'}
              onClick={submit}
              loading={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
              style={{ background: '#b45309', borderColor: '#b45309' }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
