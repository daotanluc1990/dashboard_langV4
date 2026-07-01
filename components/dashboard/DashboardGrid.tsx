import type { DashboardPayload, TabId } from '@/types/dashboard';
import { KpiCard } from './KpiCard';
import { ChartPanel } from './ChartPanel';

const tabClass: Record<TabId, string> = {
  overview: 'tab-overview',
  revenue: 'tab-revenue',
  pnl: 'tab-pnl',
  cost: 'tab-cost',
  channel: 'tab-channel',
  menu: 'tab-menu',
  operations: 'tab-operation',
  people: 'tab-people',
  stock: 'tab-inventory',
  customer: 'tab-customer',
  expansion: 'tab-expansion'
};

const layoutMap: Record<TabId, string[]> = {
  overview: ['overview-kpi','overview-trend','overview-target','overview-ranking','overview-channel-mix','overview-health-table','overview-alert-table'],
  revenue: ['revenue-kpi','revenue-trend','revenue-branch-compare','revenue-shift-compare','revenue-channel-compare','revenue-mix-pie','revenue-growth-table'],
  pnl: ['std-kpi','std-main-wide','std-main-mid','std-main-side','std-bottom-3a','std-bottom-3b','std-bottom-6c'],
  cost: ['action-kpi','action-table','action-risk-stack','action-impact','action-priority','action-branch','action-owner'],
  channel: ['std-kpi','std-main-wide','std-main-mid','std-main-side','std-bottom-4a','std-bottom-3b-cost','std-bottom-5c'],
  menu: ['std-kpi','std-main-wide','std-main-mid','std-main-side','std-bottom-3a','std-bottom-3b','std-bottom-6c'],
  operations: ['std-kpi'],
  people: ['std-kpi','std-main-wide','std-main-mid','std-main-side','std-bottom-12'],
  stock: ['std-kpi','std-main-wide','std-main-mid','std-main-side','std-bottom-6a','std-bottom-6b'],
  customer: ['customer-kpi','customer-trend','customer-channel','customer-branch','customer-issues','customer-pattern','customer-sla','customer-table'],
  expansion: ['std-kpi','std-main-wide','std-main-mid','std-main-side','std-bottom-8b','std-bottom-4a']
};

export function DashboardGrid({ payload, loading }: { payload: DashboardPayload | null; loading: boolean }) {
  if (loading && !payload) return <section className="grid"><div className="empty span-12">Đang tải dữ liệu...</div></section>;
  if (!payload) return <section className="grid"><div className="empty span-12">Chưa có dữ liệu</div></section>;

  const layouts = layoutMap[payload.tab];
  const kpiLayout = layouts[0] || 'std-kpi';
  const widgetLayouts = payload.kpis.length ? layouts.slice(1) : layouts;

  return (
    <section className={`grid ${tabClass[payload.tab]} ${loading ? 'is-loading' : ''}`}>
      {loading ? <div className="grid-loading">Đang cập nhật dữ liệu...</div> : null}
      {payload.kpis.length ? (
        <article className={`widget ${kpiLayout}`}>
          <div className="widget-head"><h3>KPI điều hành</h3></div>
          <div className="widget-body"><div className={`kpi-grid count-${Math.min(Math.max(payload.kpis.length, 1), 8)}`}>{payload.kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}</div></div>
        </article>
      ) : null}
      {payload.widgets.map((widget, index) => <ChartPanel key={widget.id} widget={widget} layoutClass={widgetLayouts[index]} />)}
    </section>
  );
}
