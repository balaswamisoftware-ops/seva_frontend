import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from 'primereact/card';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { reportsApi } from '@/api';
import { formatINR } from '@/utils/format';

function downloadCSV(filename: string, rows: any[], columns: { key: string; label: string }[]) {
  const header = columns.map((c) => c.label).join(',');
  const body = rows.map((r) => columns.map((c) => JSON.stringify(r[c.key] ?? '')).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const params = { from: range[0]?.toISOString(), to: range[1]?.toISOString() };

  const byEvent    = useQuery({ queryKey: ['rpt-event', params],    queryFn: () => reportsApi.byEvent(params) });
  const bySeva     = useQuery({ queryKey: ['rpt-seva', params],     queryFn: () => reportsApi.bySeva(params) });
  const byEmployee = useQuery({ queryKey: ['rpt-emp', params],      queryFn: () => reportsApi.byEmployee(params) });

  return (
    <Card>
      <div className="flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <Calendar
          value={range as any}
          onChange={(e) => setRange((e.value as any) ?? [null, null])}
          selectionMode="range" readOnlyInput dateFormat="dd M yy"
          placeholder="Date range filter" showButtonBar
        />
      </div>

      <TabView>
        <TabPanel header="By Event" leftIcon="ph ph-calendar mr-2">
          <div className="flex justify-content-end mb-2">
            <Button label="Export CSV" icon="ph ph-download" outlined size="small"
              onClick={() => downloadCSV('sales-by-event.csv', byEvent.data ?? [], [
                { key: 'eventName', label: 'Event' }, { key: 'tickets', label: 'Tickets' },
                { key: 'quantity', label: 'Qty' }, { key: 'collection', label: 'Collection' },
              ])}
              disabled={!byEvent.data?.length}
            />
          </div>
          <DataTable value={byEvent.data ?? []} loading={byEvent.isLoading} emptyMessage="No data">
            <Column field="eventName" header="Event" />
            <Column field="tickets"   header="Tickets" />
            <Column field="quantity"  header="Quantity Sold" />
            <Column header="Collection" body={(r) => <b style={{ color: '#b45309' }}>{formatINR(r.collection)}</b>} />
          </DataTable>
        </TabPanel>
        <TabPanel header="By Seva" leftIcon="ph ph-gift mr-2">
          <div className="flex justify-content-end mb-2">
            <Button label="Export CSV" icon="ph ph-download" outlined size="small"
              onClick={() => downloadCSV('sales-by-seva.csv', bySeva.data ?? [], [
                { key: 'sevaName', label: 'Seva' }, { key: 'eventName', label: 'Event' },
                { key: 'tickets', label: 'Tickets' }, { key: 'quantity', label: 'Qty' },
                { key: 'collection', label: 'Collection' },
              ])}
              disabled={!bySeva.data?.length}
            />
          </div>
          <DataTable value={bySeva.data ?? []} loading={bySeva.isLoading} emptyMessage="No data">
            <Column field="sevaName"  header="Seva" />
            <Column field="eventName" header="Event" />
            <Column field="tickets"   header="Tickets" />
            <Column field="quantity"  header="Quantity Sold" />
            <Column header="Collection" body={(r) => <b style={{ color: '#b45309' }}>{formatINR(r.collection)}</b>} />
          </DataTable>
        </TabPanel>
        <TabPanel header="By Employee" leftIcon="ph ph-users mr-2">
          <div className="flex justify-content-end mb-2">
            <Button label="Export CSV" icon="ph ph-download" outlined size="small"
              onClick={() => downloadCSV('sales-by-employee.csv', byEmployee.data ?? [], [
                { key: 'employeeName', label: 'Employee' }, { key: 'tickets', label: 'Tickets' },
                { key: 'quantity', label: 'Qty' }, { key: 'collection', label: 'Collection' },
              ])}
              disabled={!byEmployee.data?.length}
            />
          </div>
          <DataTable value={byEmployee.data ?? []} loading={byEmployee.isLoading} emptyMessage="No data">
            <Column field="employeeName" header="Employee" />
            <Column field="tickets"      header="Tickets Sold" />
            <Column field="quantity"     header="Quantity" />
            <Column header="Collection" body={(r) => <b style={{ color: '#b45309' }}>{formatINR(r.collection)}</b>} />
          </DataTable>
        </TabPanel>
      </TabView>
    </Card>
  );
}
