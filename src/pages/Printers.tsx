import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { Message } from 'primereact/message';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { printersApi } from '@/api';
import type { Printer, PrinterStatus, PrinterType } from '@/types/printer';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage } from '@/utils/format';

const TYPE_OPTIONS: { label: string; value: PrinterType }[] = [
  { label: 'Network (WiFi / Ethernet)', value: 'NETWORK' },
  { label: 'USB via local agent',       value: 'AGENT_USB' },
];

const STATUS_OPTIONS: { label: string; value: PrinterStatus }[] = [
  { label: 'Active',   value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

const WIDTH_OPTIONS = [
  { label: '58 mm', value: 58 },
  { label: '80 mm', value: 80 },
];

interface Form {
  name: string;
  type: PrinterType;
  ipAddress: string;
  port: number;
  agentUrl: string;
  agentKey: string;
  paperWidth: 58 | 80;
  isDefault: boolean;
  status: PrinterStatus;
  location: string;
  notes: string;
}

const blank = (): Form => ({
  name: '', type: 'NETWORK',
  ipAddress: '', port: 9100,
  agentUrl: '', agentKey: '',
  paperWidth: 58, isDefault: false, status: 'ACTIVE',
  location: '', notes: '',
});

export default function PrintersPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: printersApi.list,
    refetchOnMount: 'always',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['printers'] });

  const createMutation = useMutation({
    mutationFn: printersApi.create,
    onSuccess: () => { toastSuccess('Printer added'); reset(); invalidate(); },
    onError: (e) => toastError('Add failed', apiErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => printersApi.update(id, payload),
    onSuccess: () => { toastSuccess('Printer updated'); reset(); invalidate(); },
    onError: (e) => toastError('Update failed', apiErrorMessage(e)),
  });
  const removeMutation = useMutation({
    mutationFn: printersApi.remove,
    onSuccess: () => { toastSuccess('Printer removed'); invalidate(); },
    onError: (e) => toastError('Remove failed', apiErrorMessage(e)),
  });

  const reset = () => {
    setEditorOpen(false);
    setEditing(null);
    setForm(blank());
  };

  const openCreate = () => { reset(); setEditorOpen(true); };
  const openEdit = (p: Printer) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      ipAddress: p.ipAddress ?? '',
      port: p.port ?? 9100,
      agentUrl: p.agentUrl ?? '',
      agentKey: p.agentKey ?? '',
      paperWidth: p.paperWidth ?? 58,
      isDefault: p.isDefault,
      status: p.status,
      location: p.location ?? '',
      notes: p.notes ?? '',
    });
    setEditorOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) return toastError('Name is required');
    if (form.type === 'NETWORK' && !form.ipAddress.trim()) return toastError('IP address is required for a network printer');
    if (form.type === 'AGENT_USB' && !form.agentUrl.trim()) return toastError('Agent URL is required for a USB printer');

    // Send only the connection fields that apply to the chosen type.
    const common = {
      name: form.name.trim(),
      type: form.type,
      paperWidth: form.paperWidth,
      isDefault: form.isDefault,
      status: form.status,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    const payload: any = form.type === 'NETWORK'
      ? { ...common, ipAddress: form.ipAddress.trim(), port: form.port || 9100 }
      : { ...common, agentUrl: form.agentUrl.trim(), agentKey: form.agentKey.trim() || undefined };

    if (editing) updateMutation.mutate({ id: editing._id, payload });
    else createMutation.mutate(payload);
  };

  const confirmDelete = (p: Printer) =>
    confirmDialog({
      message: `Remove "${p.name}"? Operators using this printer will fall back to browser print.`,
      header: 'Remove printer',
      icon: 'ph ph-warning',
      acceptClassName: 'p-button-danger',
      accept: () => removeMutation.mutate(p._id),
    });

  const runTest = async (p: Printer) => {
    setTestingId(p._id);
    try {
      const res = await printersApi.test(p._id);
      toastSuccess('Test sent', `Via ${res.method}. Check the printer for a slip.`);
    } catch (e) {
      toastError('Test failed', apiErrorMessage(e));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card>
      <ConfirmDialog />

      <div className="flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
        <div>
          <div className="text-xl font-bold" style={{ color: '#92400e' }}>Printers</div>
          <div className="text-500 text-sm">
            Network printers print over WiFi/Ethernet directly from the server. USB printers go through a local print-agent.
          </div>
        </div>
        <Button label="Add Printer" icon="ph ph-plus" onClick={openCreate} style={{ background: '#b45309', borderColor: '#b45309' }} />
      </div>

      <DataTable value={printers} loading={isLoading} emptyMessage="No printers yet">
        <Column field="name" header="Name" body={(r: Printer) => (
          <div className="flex flex-column">
            <span className="font-semibold">{r.name}</span>
            {r.location && <span className="text-xs text-500">{r.location}</span>}
          </div>
        )} />
        <Column header="Type" body={(r: Printer) => (
          <Tag value={r.type === 'NETWORK' ? 'Network' : 'USB · Agent'}
               severity={r.type === 'NETWORK' ? 'success' : 'info'} />
        )} />
        <Column header="Connection" body={(r: Printer) =>
          r.type === 'NETWORK'
            ? <code>{r.ipAddress}:{r.port ?? 9100}</code>
            : <code className="text-xs">{r.agentUrl}</code>
        } />
        <Column header="Width" body={(r: Printer) => `${r.paperWidth} mm`} />
        <Column header="Default" body={(r: Printer) => r.isDefault ? <Tag value="Default" severity="warning" /> : '—'} />
        <Column header="Status" body={(r: Printer) => <Tag value={r.status} severity={r.status === 'ACTIVE' ? 'success' : 'secondary'} />} />
        <Column header="Actions" body={(r: Printer) => (
          <div className="flex gap-1">
            <Button
              icon="ph ph-printer"
              rounded text size="small"
              tooltip="Test print"
              tooltipOptions={{ position: 'top' }}
              loading={testingId === r._id}
              onClick={() => runTest(r)}
            />
            <Button icon="ph ph-pencil-simple" rounded text size="small" onClick={() => openEdit(r)} />
            <Button icon="ph ph-trash" rounded text size="small" severity="danger" onClick={() => confirmDelete(r)} />
          </div>
        )} />
      </DataTable>

      <Dialog
        header={editing ? 'Edit Printer' : 'Add Printer'}
        visible={editorOpen}
        onHide={reset}
        style={{ width: 560 }}
      >
        <div className="flex flex-column gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <InputText
              className="w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Counter 1 — TVS RP3200"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Type *</label>
            <Dropdown
              className="w-full"
              value={form.type}
              options={TYPE_OPTIONS}
              onChange={(e) => setForm({ ...form, type: e.value })}
            />
          </div>

          {form.type === 'NETWORK' ? (
            <div className="grid">
              <div className="col-8">
                <label className="block text-sm font-semibold mb-1">IP Address *</label>
                <InputText
                  className="w-full"
                  value={form.ipAddress}
                  onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                  placeholder="192.168.1.50"
                />
              </div>
              <div className="col-4">
                <label className="block text-sm font-semibold mb-1">Port</label>
                <InputNumber
                  className="w-full"
                  value={form.port}
                  onValueChange={(e) => setForm({ ...form, port: e.value ?? 9100 })}
                  min={1}
                  max={65535}
                  useGrouping={false}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1">Agent URL *</label>
                <InputText
                  className="w-full"
                  value={form.agentUrl}
                  onChange={(e) => setForm({ ...form, agentUrl: e.target.value })}
                  placeholder="http://localhost:9100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Agent Key (optional)</label>
                <InputText
                  className="w-full"
                  value={form.agentKey}
                  onChange={(e) => setForm({ ...form, agentKey: e.target.value })}
                  placeholder="Shared secret if your agent requires one"
                />
              </div>
            </>
          )}

          <div className="grid">
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Paper Width</label>
              <Dropdown
                className="w-full"
                value={form.paperWidth}
                options={WIDTH_OPTIONS}
                onChange={(e) => setForm({ ...form, paperWidth: e.value })}
              />
            </div>
            <div className="col-6">
              <label className="block text-sm font-semibold mb-1">Status</label>
              <Dropdown
                className="w-full"
                value={form.status}
                options={STATUS_OPTIONS}
                onChange={(e) => setForm({ ...form, status: e.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Location (optional)</label>
            <InputText
              className="w-full"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Front counter"
            />
          </div>

          <label className="flex align-items-center gap-2">
            <InputSwitch
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: !!e.value })}
            />
            <span>Use as default printer</span>
          </label>

          {form.type === 'AGENT_USB' && (
            <Message
              severity="info"
              text="USB printers require the local print-agent running on the operator's PC. The server will forward print jobs to the agent URL."
            />
          )}

          <div className="flex gap-2 mt-2">
            <Button label="Cancel" outlined onClick={reset} className="flex-1" />
            <Button
              label={editing ? 'Update' : 'Add'}
              onClick={submit}
              loading={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
              style={{ background: '#b45309', borderColor: '#b45309' }}
            />
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
