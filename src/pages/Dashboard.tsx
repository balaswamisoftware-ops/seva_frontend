import { useQuery } from '@tanstack/react-query';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { reportsApi } from '@/api';
import { formatINR } from '@/utils/format';

interface StatProps { icon: string; label: string; value: string | number; sub?: string; color: string; }
function StatCard({ icon, label, value, sub, color }: StatProps) {
  return (
    <Card className="shadow-1">
      <div className="flex justify-content-between align-items-start">
        <div>
          <div className="text-500 text-sm font-semibold">{label}</div>
          <div className="text-3xl font-bold mt-2" style={{ color }}>{value}</div>
          {sub && <div className="text-xs text-500 mt-1">{sub}</div>}
        </div>
        <div className="flex align-items-center justify-content-center border-round" style={{ width: 48, height: 48, background: `${color}20` }}>
          <i className={`${icon} text-xl`} style={{ color }} />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: reportsApi.dashboard,
  });
  const { data: dailyData } = useQuery({
    queryKey: ['daily-chart'],
    queryFn: () => reportsApi.dailyChart(14),
  });

  if (isLoading || !summary) {
    return <div className="flex justify-content-center p-5"><ProgressSpinner /></div>;
  }

  const labels = (dailyData ?? []).map((d: any) => d._id.slice(5));
  const ticketSeries = (dailyData ?? []).map((d: any) => d.ticketAmount ?? 0);
  const donationSeries = (dailyData ?? []).map((d: any) => d.donationAmount ?? 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Seva Collection (₹)',
        data: ticketSeries,
        backgroundColor: 'rgba(217,119,6,0.4)',
        borderColor: '#b45309',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Donations (₹)',
        data: donationSeries,
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236,72,153,0.3)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Collection ₹' } } },
  };

  const todayTotal     = (summary.today.tickets.amount ?? 0)     + (summary.today.donations.amount ?? 0);
  const monthTotal     = (summary.month.tickets.amount ?? 0)     + (summary.month.donations.amount ?? 0);
  const allTimeTotal   = (summary.total.tickets.amount ?? 0)     + (summary.total.donations.amount ?? 0);

  return (
    <div className="flex flex-column gap-3">
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-money"           label="Today's Total"    value={formatINR(todayTotal)} sub={`Seva: ${formatINR(summary.today.tickets.amount)} | Donations: ${formatINR(summary.today.donations.amount)}`} color="#16a34a" />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-chart-line"      label="Month Total"      value={formatINR(monthTotal)} sub={`${summary.month.tickets.count} tickets · ${summary.month.donations.count} donations`} color="#2563eb" />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-ticket"          label="Tickets Today"    value={summary.today.tickets.count} sub={`Qty: ${summary.today.tickets.qty}`} color="#b45309" />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-fill ph-heart"   label="Donations Today"  value={summary.today.donations.count} sub={`Amount: ${formatINR(summary.today.donations.amount)}`} color="#ec4899" />
        </div>
      </div>

      <div className="grid">
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-calculator"      label="All-time Collection" value={formatINR(allTimeTotal)} color="#7c3aed" />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-users"    label="Active Employees" value={summary.counts.employees} color="#0ea5e9" />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-calendar" label="Events"           value={summary.counts.events}    color="#f59e0b" />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <StatCard icon="ph ph-gift"     label="Sevas"            value={summary.counts.sevas}     color="#ec4899" />
        </div>
      </div>

      <Card title="Last 14 days — Seva vs Donation Collection">
        <div style={{ height: 320 }}>
          <Chart type="line" data={chartData} options={chartOptions} />
        </div>
      </Card>
    </div>
  );
}
