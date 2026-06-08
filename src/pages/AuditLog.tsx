import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { auditApi } from '@/api';
import type { AuditEntry, AuditActionType, AuditEntityType } from '@/types';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage, formatDateTime } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

const ENTITY_OPTIONS = ['Devotee', 'Event', 'EventParticipation'].map((v) => ({ label: v, value: v }));
const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ROLLBACK'].map((v) => ({ label: v, value: v }));

const actionSeverity = (a: AuditActionType) =>
  a === 'CREATE' ? 'success' : a === 'UPDATE' ? 'info' : a === 'DELETE' ? 'danger' : 'warning';
const actionIcon = (a: AuditActionType) =>
  a === 'CREATE' ? 'ph ph-plus-circle' : a === 'UPDATE' ? 'ph ph-pencil-simple' : a === 'DELETE' ? 'ph ph-trash' : 'ph ph-arrow-counter-clockwise';
const entityIcon = (e: AuditEntityType) =>
  e === 'Devotee' ? 'ph ph-user' : e === 'Event' ? 'ph ph-calendar' : 'ph ph-hand-heart';

const performer = (p: AuditEntry['performedBy']) =>
  !p ? '—' : typeof p === 'string' ? p : `${p.firstName} ${p.lastName} (${p.employeeId})`;

export default function AuditLogPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<AuditEntityType | null>(null);
  const [action, setAction] = useState<AuditActionType | null>(null);
  const [viewing, setViewing] = useState<AuditEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, entityType, action],
    queryFn: () => auditApi.list({ page, limit: 50, entityType: entityType || undefined, action: action || undefined }),
  });

  const rollbackMutation = useMutation({
    mutationFn: auditApi.rollback,
    onSuccess: (res) => {
      toastSuccess('Rollback complete', res.message);
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['devotees'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['participations'] });
    },
    onError: (e) => toastError('Rollback not possible', apiErrorMessage(e)),
  });

  const confirmRollback = (entry: AuditEntry) =>
    confirmDialog({
      message: `Roll back this ${entry.action} on ${entry.entityType} ${entry.entityCode ?? ''}? The rollback itself will be recorded in the audit log.`,
      header: 'Confirm rollback', icon: 'ph ph-arrow-counter-clockwise',
      accept: () => rollbackMutation.mutate(entry._id),
    });

  return (
    <div className="flex flex-column gap-3">
      <ConfirmDialog />
      <PageHeader
        icon="ph ph-clock-counter-clockwise"
        title="Audit Log"
        subtitle="Every create, update and delete on devotees, events and participation — with full before/after state. Super-Admin only. Roll back any change."
      />

      <div className="soft-card flex align-items-center gap-2 flex-wrap">
        <span className="font-semibold text-700"><i className="ph ph-funnel mr-1" />Filter</span>
        <Dropdown value={entityType} onChange={(e) => { setEntityType(e.value); setPage(1); }} options={ENTITY_OPTIONS} placeholder="All entities" showClear />
        <Dropdown value={action} onChange={(e) => { setAction(e.value); setPage(1); }} options={ACTION_OPTIONS} placeholder="All actions" showClear />
        <span className="ml-auto text-500 text-sm">{data?.total ?? 0} entries</span>
      </div>

      <div className="soft-card p-0" style={{ overflow: 'hidden' }}>
        <DataTable
          className="fancy-table"
          value={data?.items ?? []}
          loading={isLoading}
          paginator lazy
          first={(page - 1) * 50}
          rows={50}
          totalRecords={data?.total ?? 0}
          onPage={(e) => setPage((e.page ?? 0) + 1)}
          emptyMessage="No audit entries"
        >
          <Column header="When" body={(r: AuditEntry) => <span className="text-600 text-sm">{formatDateTime(r.createdAt)}</span>} />
          <Column
            header="Entity"
            body={(r: AuditEntry) => (
              <div className="flex align-items-center gap-2">
                <span className="stat-card__ico" style={{ width: 30, height: 30, fontSize: 15 }}><i className={entityIcon(r.entityType)} /></span>
                <div>
                  <div className="font-semibold text-900">{r.entityType}</div>
                  <div className="text-xs text-500">{r.entityCode ?? r.entityId.slice(-6)}</div>
                </div>
              </div>
            )}
          />
          <Column header="Action" body={(r: AuditEntry) => <Tag icon={actionIcon(r.action)} severity={actionSeverity(r.action)} value={r.action} />} />
          <Column header="By" body={(r: AuditEntry) => <span className="text-700 text-sm">{performer(r.performedBy)}</span>} />
          <Column header="Status" body={(r: AuditEntry) => (r.rolledBack ? <Tag severity="secondary" value="rolled back" /> : <span className="text-400">—</span>)} />
          <Column
            header="Actions"
            body={(r: AuditEntry) => (
              <div className="flex gap-1">
                <Button icon="ph ph-eye" rounded text size="small" onClick={() => setViewing(r)} tooltip="View before/after" />
                {r.action !== 'ROLLBACK' && !r.rolledBack && (
                  <Button icon="ph ph-arrow-counter-clockwise" rounded text size="small" severity="warning" onClick={() => confirmRollback(r)} tooltip="Roll back" />
                )}
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            {viewing && <Tag icon={actionIcon(viewing.action)} severity={actionSeverity(viewing.action)} value={viewing.action} />}
            <span>{viewing?.entityType} {viewing?.entityCode ?? ''}</span>
          </div>
        }
        visible={!!viewing} onHide={() => setViewing(null)} style={{ width: 760 }}
      >
        {viewing && (
          <div className="grid pt-2">
            <div className="col-6">
              <div className="diff-pane diff-before">
                <div className="diff-pane__head"><i className="ph ph-minus-circle mr-1" />Before</div>
                <pre className="diff-pane__body">{viewing.before ? JSON.stringify(viewing.before, null, 2) : '(did not exist)'}</pre>
              </div>
            </div>
            <div className="col-6">
              <div className="diff-pane diff-after">
                <div className="diff-pane__head"><i className="ph ph-plus-circle mr-1" />After</div>
                <pre className="diff-pane__body">{viewing.after ? JSON.stringify(viewing.after, null, 2) : '(removed)'}</pre>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
