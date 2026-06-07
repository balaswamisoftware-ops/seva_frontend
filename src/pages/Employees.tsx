import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { Card } from 'primereact/card';
import { employeesApi } from '@/api';
import type { Employee, Role } from '@/types';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage, formatDateTime, fullName } from '@/utils/format';

const ROLE_OPTIONS = [{ label: 'Super Admin', value: 'SUPER_ADMIN' }, { label: 'Admin', value: 'ADMIN' }];

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; employee?: Employee; newPin: string }>({ open: false, newPin: '' });
  const [form, setForm] = useState({ firstName: '', lastName: '', mobileNumber: '', email: '', pin: '', role: 'ADMIN' as Role });

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => employeesApi.list({ page, limit: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => { toastSuccess('Employee created'); reset(); queryClient.invalidateQueries({ queryKey: ['employees'] }); },
    onError: (e) => toastError('Create failed', apiErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => employeesApi.update(id, payload),
    onSuccess: () => { toastSuccess('Employee updated'); reset(); queryClient.invalidateQueries({ queryKey: ['employees'] }); },
    onError: (e) => toastError('Update failed', apiErrorMessage(e)),
  });
  const resetPinMutation = useMutation({
    mutationFn: ({ id, newPin }: { id: string; newPin: string }) => employeesApi.resetPin(id, newPin),
    onSuccess: () => { toastSuccess('PIN reset'); setPinDialog({ open: false, newPin: '' }); },
    onError: (e) => toastError('PIN reset failed', apiErrorMessage(e)),
  });
  const toggleMutation = useMutation({
    mutationFn: employeesApi.toggleStatus,
    onSuccess: () => { toastSuccess('Status updated'); queryClient.invalidateQueries({ queryKey: ['employees'] }); },
    onError: (e) => toastError('Failed', apiErrorMessage(e)),
  });

  const reset = () => {
    setEditorOpen(false); setEditing(null);
    setForm({ firstName: '', lastName: '', mobileNumber: '', email: '', pin: '', role: 'ADMIN' });
  };

  const openCreate = () => { setEditing(null); setForm({ firstName: '', lastName: '', mobileNumber: '', email: '', pin: '', role: 'ADMIN' }); setEditorOpen(true); };
  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({ firstName: emp.firstName, lastName: emp.lastName, mobileNumber: emp.mobileNumber, email: emp.email ?? '', pin: '', role: emp.role });
    setEditorOpen(true);
  };

  const submit = () => {
    if (editing) {
      const { pin, ...payload } = form;
      updateMutation.mutate({ id: editing._id, payload });
    } else {
      if (!/^\d{4,6}$/.test(form.pin)) return toastError('PIN must be 4-6 digits');
      createMutation.mutate(form);
    }
  };

  const confirmToggle = (emp: Employee) => {
    confirmDialog({
      message: `${emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${fullName(emp)}?`,
      header: 'Confirm', icon: 'ph ph-warning',
      accept: () => toggleMutation.mutate(emp._id),
    });
  };

  return (
    <Card>
      <ConfirmDialog />
      <div className="flex justify-content-between align-items-center mb-3 gap-3 flex-wrap">
        <div className="flex align-items-center gap-2">
          <span className="p-input-icon-left">
            <i className="ph ph-magnifying-glass" />
            <InputText placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </span>
        </div>
        <Button label="New Employee" icon="ph ph-plus" onClick={openCreate} style={{ background: '#b45309', borderColor: '#b45309' }} />
      </div>

      <DataTable
        value={data?.items ?? []}
        loading={isLoading}
        paginator
        lazy
        first={(page - 1) * 20}
        rows={20}
        totalRecords={data?.total ?? 0}
        onPage={(e) => setPage((e.page ?? 0) + 1)}
        emptyMessage="No employees found"
      >
        <Column field="employeeId" header="ID" />
        <Column header="Name" body={(r: Employee) => fullName(r)} />
        <Column field="mobileNumber" header="Mobile" />
        <Column field="email" header="Email" body={(r: Employee) => r.email ?? '—'} />
        <Column field="role" header="Role" body={(r: Employee) => <Tag severity={r.role === 'SUPER_ADMIN' ? 'danger' : 'info'} value={r.role} />} />
        <Column field="status" header="Status" body={(r: Employee) => <Tag severity={r.status === 'ACTIVE' ? 'success' : 'warning'} value={r.status} />} />
        <Column field="lastLoginAt" header="Last Login" body={(r: Employee) => formatDateTime(r.lastLoginAt)} />
        <Column
          header="Actions"
          body={(r: Employee) => (
            <div className="flex gap-1">
              <Button icon="ph ph-pencil-simple" rounded text size="small" onClick={() => openEdit(r)} tooltip="Edit" />
              <Button icon="ph ph-key" rounded text size="small" severity="warning" onClick={() => setPinDialog({ open: true, employee: r, newPin: '' })} tooltip="Reset PIN" />
              <Button
                icon={r.status === 'ACTIVE' ? 'ph ph-prohibit' : 'ph ph-check'}
                rounded text size="small"
                severity={r.status === 'ACTIVE' ? 'danger' : 'success'}
                onClick={() => confirmToggle(r)}
                tooltip={r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              />
            </div>
          )}
        />
      </DataTable>

      {/* Editor */}
      <Dialog header={editing ? 'Edit Employee' : 'New Employee'} visible={editorOpen} onHide={reset} style={{ width: 480 }}>
        <div className="flex flex-column gap-3">
          <div className="grid">
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">First Name *</label>
              <InputText className="w-full" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Last Name *</label>
              <InputText className="w-full" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Mobile *</label>
            <InputText className="w-full" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} keyfilter="num" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <InputText className="w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Role</label>
            <Dropdown className="w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.value })} options={ROLE_OPTIONS} />
          </div>
          {!editing && (
            <div>
              <label className="block text-sm font-semibold mb-1">Initial PIN (4-6 digits) *</label>
              <InputText className="w-full" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} keyfilter="num" maxLength={6} />
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={reset} className="flex-1" />
            <Button label={editing ? 'Update' : 'Create'} onClick={submit} loading={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: '#b45309', borderColor: '#b45309' }} />
          </div>
        </div>
      </Dialog>

      {/* PIN reset */}
      <Dialog header={`Reset PIN — ${pinDialog.employee ? fullName(pinDialog.employee) : ''}`} visible={pinDialog.open} onHide={() => setPinDialog({ open: false, newPin: '' })} style={{ width: 380 }}>
        <div className="flex flex-column gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1">New PIN (4-6 digits)</label>
            <InputText className="w-full" value={pinDialog.newPin} onChange={(e) => setPinDialog({ ...pinDialog, newPin: e.target.value })} keyfilter="num" maxLength={6} />
          </div>
          <div className="flex gap-2">
            <Button label="Cancel" outlined onClick={() => setPinDialog({ open: false, newPin: '' })} className="flex-1" />
            <Button
              label="Reset PIN"
              onClick={() => pinDialog.employee && resetPinMutation.mutate({ id: pinDialog.employee._id, newPin: pinDialog.newPin })}
              loading={resetPinMutation.isPending}
              disabled={!/^\d{4,6}$/.test(pinDialog.newPin)}
              className="flex-1"
              style={{ background: '#b45309', borderColor: '#b45309' }}
            />
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
