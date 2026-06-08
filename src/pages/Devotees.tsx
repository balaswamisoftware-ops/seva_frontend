import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { devoteesApi } from '@/api';
import type { Devotee } from '@/types';
import { useAuthStore } from '@/store/auth';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage, formatDateTime } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

const PHONE_RE = /^[6-9]\d{9}$/;
const emptyForm = { fullName: '', phoneNumber: '', gothram: '', nakshatram: '' };
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export default function DevoteesPage() {
  const queryClient = useQueryClient();
  const isSuper = useAuthStore((s) => s.employee?.role === 'SUPER_ADMIN');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Devotee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isLoading } = useQuery({
    queryKey: ['devotees', page, search],
    queryFn: () => devoteesApi.list({ page, limit: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: devoteesApi.create,
    onSuccess: () => { toastSuccess('Devotee created'); reset(); queryClient.invalidateQueries({ queryKey: ['devotees'] }); },
    onError: (e) => toastError('Create failed', apiErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => devoteesApi.update(id, payload),
    onSuccess: () => { toastSuccess('Devotee updated'); reset(); queryClient.invalidateQueries({ queryKey: ['devotees'] }); },
    onError: (e) => toastError('Update failed', apiErrorMessage(e)),
  });
  const removeMutation = useMutation({
    mutationFn: devoteesApi.remove,
    onSuccess: () => { toastSuccess('Devotee deleted'); queryClient.invalidateQueries({ queryKey: ['devotees'] }); },
    onError: (e) => toastError('Delete failed', apiErrorMessage(e)),
  });

  const reset = () => { setEditorOpen(false); setEditing(null); setForm({ ...emptyForm }); };
  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setEditorOpen(true); };
  const openEdit = (d: Devotee) => {
    setEditing(d);
    setForm({ fullName: d.fullName, phoneNumber: d.phoneNumber, gothram: d.gothram ?? '', nakshatram: d.nakshatram ?? '' });
    setEditorOpen(true);
  };

  const submit = () => {
    if (form.fullName.trim().length < 2) return toastError('Full name is required');
    if (!PHONE_RE.test(form.phoneNumber)) return toastError('Enter a valid 10-digit mobile number');
    if (editing) updateMutation.mutate({ id: editing._id, payload: form });
    else createMutation.mutate(form);
  };

  const confirmDelete = (d: Devotee) =>
    confirmDialog({
      message: `Delete devotee "${d.fullName}" (${d.phoneNumber})? This is audited and can be rolled back by a Super Admin.`,
      header: 'Confirm', icon: 'ph ph-warning', acceptClassName: 'p-button-danger',
      accept: () => removeMutation.mutate(d._id),
    });

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-column gap-3">
      <ConfirmDialog />
      <PageHeader
        icon="ph ph-user-list"
        title="Devotees"
        subtitle="Manage devotee records. Phone number is unique across all devotees and is the key used for event participation."
        actions={<Button label="Add Devotee" icon="ph ph-plus" onClick={openCreate} className="p-button-rounded" style={{ background: '#fff', borderColor: '#fff', color: '#b45309' }} />}
      />

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-card__ico"><i className="ph ph-users" /></div>
          <div>
            <div className="stat-card__label">Total Devotees</div>
            <div className="stat-card__value">{data?.total ?? '—'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__ico"><i className="ph ph-magnifying-glass" /></div>
          <div className="flex-1">
            <div className="stat-card__label mb-1">Search</div>
            <span className="p-input-icon-left w-full">
              <i className="ph ph-magnifying-glass" />
              <InputText className="w-full" placeholder="Name, phone, gothram…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </span>
          </div>
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
          emptyMessage="No devotees yet — add the first one."
        >
          <Column
            header="Devotee"
            body={(r: Devotee) => (
              <div className="flex align-items-center gap-2">
                <div className="ini-avatar">{initials(r.fullName)}</div>
                <div>
                  <div className="font-semibold text-900">{r.fullName}</div>
                  <div className="text-xs text-500">{r.devoteeId}</div>
                </div>
              </div>
            )}
          />
          <Column header="Phone" body={(r: Devotee) => <span className="font-medium"><i className="ph ph-phone text-500 mr-1" />{r.phoneNumber}</span>} />
          <Column header="Gothram" body={(r: Devotee) => (r.gothram ? <Tag value={r.gothram} style={{ background: '#fef3c7', color: '#92400e' }} /> : <span className="text-400">—</span>)} />
          <Column header="Nakshatram" body={(r: Devotee) => (r.nakshatram ? <Tag value={r.nakshatram} style={{ background: '#fef3c7', color: '#92400e' }} /> : <span className="text-400">—</span>)} />
          <Column header="Added" body={(r: Devotee) => <span className="text-600 text-sm">{formatDateTime(r.createdAt)}</span>} />
          <Column
            header="Actions"
            body={(r: Devotee) => (
              <div className="flex gap-1">
                <Button icon="ph ph-pencil-simple" rounded text size="small" onClick={() => openEdit(r)} tooltip="Edit" />
                {isSuper && <Button icon="ph ph-trash" rounded text size="small" severity="danger" onClick={() => confirmDelete(r)} tooltip="Delete" />}
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <span className="page-head__icon" style={{ width: 38, height: 38, fontSize: 18, background: '#fef3c7', color: '#b45309', border: 'none' }}>
              <i className={editing ? 'ph ph-pencil-simple' : 'ph ph-user-plus'} />
            </span>
            <span>{editing ? 'Edit Devotee' : 'Add Devotee'}</span>
          </div>
        }
        visible={editorOpen} onHide={reset} style={{ width: 480 }}
      >
        <div className="flex flex-column gap-3 pt-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Full Name *</label>
            <span className="p-input-icon-left w-full">
              <i className="ph ph-user" />
              <InputText className="w-full" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Ravi Kumar" />
            </span>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone Number *</label>
            <span className="p-input-icon-left w-full">
              <i className="ph ph-phone" />
              <InputText className="w-full" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} keyfilter="num" maxLength={10} placeholder="10-digit mobile" />
            </span>
            <small className="text-500">Unique across all devotees.</small>
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
          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={reset} className="flex-1" />
            <Button label={editing ? 'Update' : 'Create'} icon="ph ph-check" onClick={submit} loading={saving} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
