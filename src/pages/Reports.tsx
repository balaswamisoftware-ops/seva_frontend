import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { reportsApi } from '@/api';
import { formatINR } from '@/utils/format';
import PageHeader from '@/components/PageHeader';

function downloadCSV(filename: string, rows: any[], columns: { key: string; label: string }[]) {
  const header = columns.map((c) => c.label).join(',');
  const body = rows.map((r) => columns.map((c) => JSON.stringify(r[c.key] ?? '')).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

const sum = (rows: any[] = [], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

function MiniStat({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card__ico" style={{ background: `${accent}1f`, color: accent }}><i className={icon} /></div>
      <div><div className="stat-card__label">{label}</div><div className="stat-card__value">{value}</div></div>
    </div>
  );
}

const collectionBody = (r: any) => <span className="font-bold" style={{ color: '#b45309' }}>{formatINR(r.collection)}</span>;

export default function ReportsPage() {
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [activeIndex, setActiveIndex] = useState(0);
  const params = { from: range[0]?.toISOString(), to: range[1]?.toISOString() };

  const byEvent    = useQuery({ queryKey: ['rpt-event', params],    queryFn: () => reportsApi.byEvent(params) });
  const bySeva     = useQuery({ queryKey: ['rpt-seva', params],     queryFn: () => reportsApi.bySeva(params) });
  const byEmployee = useQuery({ queryKey: ['rpt-emp', params],      queryFn: () => reportsApi.byEmployee(params) });

  const active = [byEvent.data, bySeva.data, byEmployee.data][activeIndex] ?? [];
  const totalCollection = sum(active, 'collection');
  const totalTickets = sum(active, 'tickets');
  const totalQty = sum(active, 'quantity');

  const exportBtn = (filename: string, rows: any[], columns: { key: string; label: string }[]) => (
    <Button
      label="Export CSV" icon="ph ph-download-simple" size="small"
      onClick={() => downloadCSV(filename, rows, columns)}
      disabled={!rows?.length}
      style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}
    />
  );

  return (
    <div className="flex flex-column gap-3">
      <PageHeader
        icon="ph ph-chart-bar"
        title="Reports"
        subtitle="Collection performance by event, seva and employee. Filter by date range and export to CSV."
        actions={
          <Calendar
            value={range as any}
            onChange={(e) => setRange((e.value as any) ?? [null, null])}
            selectionMode="range" readOnlyInput dateFormat="dd M yy"
            placeholder="Date range" showButtonBar
            showIcon
            panelClassName="compact-calendar"
            style={{ minWidth: 230 }}
          />
        }
      />

      <div className="stat-row">
        <MiniStat icon="ph ph-coins"   label="Total Collection" value={formatINR(totalCollection)} accent="#b45309" />
        <MiniStat icon="ph ph-ticket"  label="Tickets"          value={totalTickets}               accent="#2563eb" />
        <MiniStat icon="ph ph-stack"   label="Quantity Sold"    value={totalQty}                   accent="#7c3aed" />
      </div>

      <div className="soft-card">
        <TabView className="fancy-tabs" activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="By Event" leftIcon="ph ph-calendar mr-2">
            <div className="flex justify-content-end mb-2">
              {exportBtn('sales-by-event.csv', byEvent.data ?? [], [
                { key: 'eventName', label: 'Event' }, { key: 'tickets', label: 'Tickets' },
                { key: 'quantity', label: 'Qty' }, { key: 'collection', label: 'Collection' },
              ])}
            </div>
            <DataTable className="fancy-table" value={byEvent.data ?? []} loading={byEvent.isLoading} emptyMessage="No sales in this period" stripedRows>
              <Column field="eventName" header="Event" body={(r) => <span className="font-semibold text-900">{r.eventName}</span>} />
              <Column field="tickets"   header="Tickets" />
              <Column field="quantity"  header="Quantity Sold" />
              <Column header="Collection" body={collectionBody} />
            </DataTable>
          </TabPanel>

          <TabPanel header="By Seva" leftIcon="ph ph-gift mr-2">
            <div className="flex justify-content-end mb-2">
              {exportBtn('sales-by-seva.csv', bySeva.data ?? [], [
                { key: 'sevaName', label: 'Seva' }, { key: 'eventName', label: 'Event' },
                { key: 'tickets', label: 'Tickets' }, { key: 'quantity', label: 'Qty' }, { key: 'collection', label: 'Collection' },
              ])}
            </div>
            <DataTable className="fancy-table" value={bySeva.data ?? []} loading={bySeva.isLoading} emptyMessage="No sales in this period" stripedRows>
              <Column field="sevaName"  header="Seva" body={(r) => <span className="font-semibold text-900">{r.sevaName}</span>} />
              <Column field="eventName" header="Event" />
              <Column field="tickets"   header="Tickets" />
              <Column field="quantity"  header="Quantity Sold" />
              <Column header="Collection" body={collectionBody} />
            </DataTable>
          </TabPanel>

          <TabPanel header="By Employee" leftIcon="ph ph-users mr-2">
            <div className="flex justify-content-end mb-2">
              {exportBtn('sales-by-employee.csv', byEmployee.data ?? [], [
                { key: 'employeeName', label: 'Employee' }, { key: 'tickets', label: 'Tickets' },
                { key: 'quantity', label: 'Qty' }, { key: 'collection', label: 'Collection' },
              ])}
            </div>
            <DataTable className="fancy-table" value={byEmployee.data ?? []} loading={byEmployee.isLoading} emptyMessage="No sales in this period" stripedRows>
              <Column field="employeeName" header="Employee" body={(r) => <span className="font-semibold text-900">{r.employeeName}</span>} />
              <Column field="tickets"      header="Tickets Sold" />
              <Column field="quantity"     header="Quantity" />
              <Column header="Collection" body={collectionBody} />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>
    </div>
  );
}
