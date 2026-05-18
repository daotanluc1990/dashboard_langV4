import type { KpiCard as Kpi } from '@/types/dashboard';

function roleFromKpi(kpi: Kpi): string {
  const status = kpi.status || 'neutral';
  const title = `${kpi.id} ${kpi.title}`.toLowerCase();
  if (status === 'danger') return 'bad role-danger';
  if (status === 'warning') return 'role-warning';
  if (status === 'good') return 'role-success';
  if (title.includes('doanh thu') || title.includes('số phần') || title.includes('aov')) return 'role-primary';
  return 'role-secondary';
}

function normalizeDelta(kpi: Kpi): string {
  const text = String(kpi.delta || '—').trim();
  if (!text || text === '—') return '—';
  const value = text.replace(/^[▲△▴▵▼▽▾▿]\s*/g, '').trim();
  if (!value || value === text) return text;
  return `${(kpi.deltaRaw || 0) < 0 ? '▼' : '▲'} ${value}`;
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className={`kpi ${roleFromKpi(kpi)}`}>
      <div className="label">{kpi.title}</div>
      <div className="value">{kpi.value}</div>
      <div className={`delta ${(kpi.deltaRaw || 0) < 0 ? 'bad' : 'good'}`}>{normalizeDelta(kpi)}</div>
    </div>
  );
}
