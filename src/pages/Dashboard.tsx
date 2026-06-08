import { useQuery } from '@tanstack/react-query';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { reportsApi } from '@/api';
import { formatINR } from '@/utils/format';
import { useAuthStore } from '@/store/auth';
import PageHeader from '@/components/PageHeader';

/* ── tiny inline-SVG sparkline ─────────────────────────────────────────── */
function Sparkline({ data, color, width = 130, height = 36 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 2 - ((v - min) / range) * (height - 4)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const gid = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type DeltaKind = 'up' | 'down' | 'flat';
function deltaInfo(curr: number, prev: number): { kind: DeltaKind; text: string } {
  if (prev === 0 && curr === 0) return { kind: 'flat', text: '0%' };
  if (prev === 0) return { kind: 'up', text: 'new' };
  const pct = ((curr - prev) / prev) * 100;
  const kind: DeltaKind = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
  return { kind, text: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%` };
}

interface KpiProps {
  icon: string; iconBg: string; iconColor: string; label: string; value: string;
  spark?: number[]; sparkColor?: string; delta?: { kind: DeltaKind; text: string; note?: string }; sub?: string;
}
function Kpi({ icon, iconBg, iconColor, label, value, spark, sparkColor, delta, sub }: KpiProps) {
  return (
    <div className="kpi">
      <div className="kpi__head">
        <div className="kpi__ico" style={{ background: iconBg, color: iconColor }}><i className={icon} /></div>
        <div className="kpi__label">{label}</div>
      </div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__foot">
        {delta ? (
          <span className={`delta ${delta.kind}`}>
            <i className={delta.kind === 'up' ? 'ph ph-trend-up' : delta.kind === 'down' ? 'ph ph-trend-down' : 'ph ph-minus'} />
            {delta.text}{delta.note ? <span className="font-normal ml-1" style={{ opacity: .8 }}>{delta.note}</span> : null}
          </span>
        ) : sub ? <span className="kpi__sub">{sub}</span> : <span />}
        {spark && <Sparkline data={spark} color={sparkColor ?? iconColor} />}
      </div>
    </div>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const dateLabel = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Build a continuous N-day axis so missing days show as 0 instead of a 2-point line.
function buildSeries(daily: any[], days = 14) {
  const map = new Map(daily.map((d) => [d._id, d]));
  const out: { key: string; label: string; ticket: number; donation: number; total: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400e3);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = map.get(key);
    out.push({
      key,
      label: `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-IN', { month: 'short' })}`,
      ticket: row?.ticketAmount ?? 0,
      donation: row?.donationAmount ?? 0,
      total: (row?.ticketAmount ?? 0) + (row?.donationAmount ?? 0),
    });
  }
  return out;
}

export default function DashboardPage() {
  const employee = useAuthStore((s) => s.employee);
  const firstName = employee?.firstName || 'there';
  const { data: summary, isLoading } = useQuery({ queryKey: ['dashboard-summary'], queryFn: reportsApi.dashboard });
  const { data: dailyData } = useQuery({ queryKey: ['daily-chart'], queryFn: () => reportsApi.dailyChart(14) });
  const { data: topEvents } = useQuery({ queryKey: ['rpt-event-top'], queryFn: () => reportsApi.byEvent() });

  if (isLoading || !summary) return <div className="flex justify-content-center p-6"><ProgressSpinner /></div>;

  const series = buildSeries(dailyData ?? [], 14);
  const totalSpark = series.map((s) => s.total);

  const todayTotal   = (summary.today.tickets.amount ?? 0) + (summary.today.donations.amount ?? 0);
  const monthTotal   = (summary.month.tickets.amount ?? 0) + (summary.month.donations.amount ?? 0);
  const allTimeTotal = (summary.total.tickets.amount ?? 0) + (summary.total.donations.amount ?? 0);
  const txToday      = (summary.today.tickets.count ?? 0) + (summary.today.donations.count ?? 0);
  const avgTicket    = summary.month.tickets.count ? summary.month.tickets.amount / summary.month.tickets.count : 0;

  // today vs yesterday (last two points of the continuous series)
  const yesterdayTotal = series.length >= 2 ? series[series.length - 2].total : 0;
  const todayDelta = { ...deltaInfo(todayTotal, yesterdayTotal), note: 'vs yest.' };

  /* area chart */
  const chartData = {
    labels: series.map((s) => s.label),
    datasets: [
      { label: 'Seva', data: series.map((s) => s.ticket), borderColor: '#b45309', backgroundColor: 'rgba(217,119,6,0.16)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#b45309' },
      { label: 'Donations', data: series.map((s) => s.donation), borderColor: '#db2777', backgroundColor: 'rgba(219,39,119,0.12)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#db2777' },
    ],
  };
  const chartOptions = {
    maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1f2937', padding: 12, cornerRadius: 8, callbacks: { label: (c: any) => ` ${c.dataset.label}: ${formatINR(c.parsed.y)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9a9690', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
      y: { beginAtZero: true, grid: { color: '#f4efe4' }, border: { display: false }, ticks: { color: '#9a9690', font: { size: 10 }, callback: (v: any) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`) } },
    },
  };

  /* donut — this month mix */
  const mixSeva = summary.month.tickets.amount ?? 0;
  const mixDon  = summary.month.donations.amount ?? 0;
  const mixTotal = mixSeva + mixDon;
  const donutData = {
    labels: ['Seva', 'Donations'],
    datasets: [{ data: mixTotal ? [mixSeva, mixDon] : [1, 0], backgroundColor: ['#b45309', '#db2777'], hoverBackgroundColor: ['#92400e', '#be185d'], borderWidth: 0 }],
  };
  const donutOptions = { maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: !!mixTotal, callbacks: { label: (c: any) => ` ${c.label}: ${formatINR(c.parsed)}` } } } };
  const pct = (v: number) => (mixTotal ? Math.round((v / mixTotal) * 100) : 0);

  /* leaderboard */
  const leaders = (topEvents ?? []).slice(0, 5);
  const maxCollection = Math.max(...leaders.map((e: any) => e.collection), 1);

  return (
    <div className="flex flex-column gap-3">
      <PageHeader icon="ph ph-house" title={`${greeting()}, ${firstName}`} subtitle={dateLabel()} />

      {/* KPI row */}
      <div className="grid">
        <div className="col-12 sm:col-6 lg:col-3">
          <Kpi icon="ph ph-coins" iconBg="#fff3e6" iconColor="#b45309" label="Today's Collection" value={formatINR(todayTotal)}
            spark={totalSpark} sparkColor="#b45309" delta={todayDelta} />
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <Kpi icon="ph ph-chart-line-up" iconBg="#eef4ff" iconColor="#2563eb" label="This Month" value={formatINR(monthTotal)}
            spark={totalSpark} sparkColor="#2563eb" sub={`${summary.month.tickets.count} tickets · ${summary.month.donations.count} donations`} />
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <Kpi icon="ph ph-receipt" iconBg="#f3eefe" iconColor="#7c3aed" label="Transactions Today" value={String(txToday)}
            sub={`${summary.today.tickets.count} seva · ${summary.today.donations.count} donation`} />
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <Kpi icon="ph ph-tag" iconBg="#e9fbf2" iconColor="#059669" label="Avg Ticket (MTD)" value={formatINR(avgTicket)}
            sub={`Across ${summary.month.tickets.count} tickets`} />
        </div>
      </div>

      {/* Trend + mix */}
      <div className="grid">
        <div className="col-12 lg:col-8">
          <div className="panel">
            <div className="flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <div className="panel__title">Collection Trend</div>
                <div className="panel__sub">Seva vs donations · last 14 days</div>
              </div>
              <div className="lg">
                <span className="lg__item"><span className="lg__dot" style={{ background: '#b45309' }} />Seva</span>
                <span className="lg__item"><span className="lg__dot" style={{ background: '#db2777' }} />Donations</span>
              </div>
            </div>
            <div style={{ height: 300 }}><Chart type="line" data={chartData} options={chartOptions} /></div>
          </div>
        </div>
        <div className="col-12 lg:col-4">
          <div className="panel">
            <div className="panel__title">Collection Mix</div>
            <div className="panel__sub mb-2">This month</div>
            <div className="donut-wrap" style={{ height: 180 }}>
              <Chart type="doughnut" data={donutData} options={donutOptions} style={{ height: '100%' }} />
              <div className="donut-center">
                <small>Total</small>
                <b>{formatINR(mixTotal)}</b>
              </div>
            </div>
            <div className="mt-3">
              <div className="mix-row">
                <span className="lg__item"><span className="lg__dot" style={{ background: '#b45309' }} />Seva</span>
                <span><b>{formatINR(mixSeva)}</b> <span className="text-500">· {pct(mixSeva)}%</span></span>
              </div>
              <div className="mix-row">
                <span className="lg__item"><span className="lg__dot" style={{ background: '#db2777' }} />Donations</span>
                <span><b>{formatINR(mixDon)}</b> <span className="text-500">· {pct(mixDon)}%</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard + counts */}
      <div className="grid">
        <div className="col-12 lg:col-8">
          <div className="panel">
            <div className="panel__title mb-1">Top Events</div>
            <div className="panel__sub mb-2">By all-time collection</div>
            {leaders.length === 0 ? (
              <div className="text-500 text-sm py-4 text-center">No sales recorded yet.</div>
            ) : leaders.map((e: any, i: number) => (
              <div className="lead" key={e._id ?? i}>
                <div className="lead__rank">{i + 1}</div>
                <div className="lead__body">
                  <div className="lead__name">{e.eventName}</div>
                  <div className="lead__bar"><div className="lead__fill" style={{ width: `${Math.max(6, (e.collection / maxCollection) * 100)}%` }} /></div>
                </div>
                <div className="lead__val">{formatINR(e.collection)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-12 lg:col-4">
          <div className="grid">
            <div className="col-6 lg:col-12">
              <Kpi icon="ph ph-calculator" iconBg="#f3eefe" iconColor="#7c3aed" label="All-time Collection" value={formatINR(allTimeTotal)} />
            </div>
            <div className="col-6 lg:col-12">
              <div className="grid">
                <div className="col-12 sm:col-4 lg:col-4"><Kpi icon="ph ph-calendar" iconBg="#fff7e6" iconColor="#f59e0b" label="Events" value={String(summary.counts.events)} /></div>
                <div className="col-12 sm:col-4 lg:col-4"><Kpi icon="ph ph-gift" iconBg="#fdeef6" iconColor="#db2777" label="Sevas" value={String(summary.counts.sevas)} /></div>
                <div className="col-12 sm:col-4 lg:col-4"><Kpi icon="ph ph-users" iconBg="#e7f6fd" iconColor="#0ea5e9" label="Staff" value={String(summary.counts.employees)} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
