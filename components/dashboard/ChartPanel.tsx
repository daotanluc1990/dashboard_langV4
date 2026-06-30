'use client';

import type { ChartDataset, DashboardWidget } from '@/types/dashboard';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DataTable } from './DataTable';

const COLORS = ['#059669', '#E24B35', '#F7B731', '#2563EB', '#10B981', '#D97706', '#DC2626'];
const roleColor: Record<string, string> = {
  primary: '#059669',
  success: '#10B981',
  warning: '#D97706',
  danger: '#DC2626',
  muted: '#94A3B8'
};

function fmt(v: any) {
  if (typeof v !== 'number') return v;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2).replace('.', ',')} tỷ`;
  if (abs >= 1_000_000) return `${Math.round(v / 1_000_000).toLocaleString('vi-VN')}tr`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString('vi-VN')}k`;
  return Math.round(v).toLocaleString('vi-VN');
}

function tooltipFormatter(value: any, name: any, item: any) {
  const dataKey = String(item?.dataKey || '');
  const payload = item?.payload || {};

  if (dataKey === 'portionsScaled') {
    return [`${fmt(Number(payload.portions || 0))} phần`, 'Tổng phần'];
  }

  if (dataKey === 'aov') {
    return [`${fmt(Number(value || 0))}đ`, name];
  }

  return [fmt(value), name];
}

function pct(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function sumKey(rows: Array<Record<string, any>>, key: string) {
  return rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function isPreviousDataset(ds: ChartDataset) {
  const k = `${ds.dataKey} ${ds.name}`.toLowerCase();
  return k.includes('previous') || k.includes('kỳ trước') || k.includes('ky truoc');
}

function widgetDelta(widget: DashboardWidget) {
  const data = widget.data || [];
  const datasets = widget.datasets || [];
  if (!data.length || !datasets.length) return null;

  const currentDs = datasets.find((ds) => !isPreviousDataset(ds) && ds.role !== 'muted');
  const previousDs = datasets.find((ds) => isPreviousDataset(ds));

  if (!currentDs || !previousDs) return null;

  const current = sumKey(data, currentDs.dataKey);
  const previous = sumKey(data, previousDs.dataKey);
  if (!previous || !Number.isFinite(current) || !Number.isFinite(previous)) return null;

  const deltaPct = pct(current, previous);
  const deltaAbs = current - previous;

  return {
    percent: deltaPct,
    absolute: deltaAbs,
    label: `${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(1).replace('.', ',')}%`,
    className: deltaPct >= 0 ? 'good' : 'bad'
  };
}

export function ChartPanel({ widget, layoutClass }: { widget: DashboardWidget; layoutClass?: string }) {
  const delta = widgetDelta(widget);

  return (
    <article className={`widget widget-${widget.type} ${layoutClass || widget.className || 'std-main-mid'}`}>
      <div className="widget-head">
        <div className="widget-title-block">
          <h3>{widget.title}</h3>
        </div>
        {delta ? (
          <div className={`widget-delta ${delta.className}`} title={`Chênh lệch: ${fmt(delta.absolute)}`}>
            {delta.label}
          </div>
        ) : null}
      </div>
      <div className="widget-body">{renderWidget(widget)}</div>
    </article>
  );
}

function renderWidget(widget: DashboardWidget) {
  if (widget.empty || widget.type === 'empty') return <div className="empty">{widget.message || 'Chưa có dữ liệu phù hợp với bộ lọc'}</div>;
  const data = widget.data || [];
  if (!data.length) return <div className="empty">Chưa có dữ liệu phù hợp với bộ lọc</div>;
  if (widget.type === 'table' || widget.type === 'alertTable') return <DataTable widget={widget} />;

  const xKey = data[0]?.label !== undefined ? 'label' : data[0]?.name !== undefined ? 'name' : data[0]?.branch !== undefined ? 'branch' : data[0]?.item !== undefined ? 'item' : data[0]?.group !== undefined ? 'group' : data[0]?.channel !== undefined ? 'channel' : 'key';
  const yKey = data[0]?.branch !== undefined ? 'branch' : data[0]?.name !== undefined ? 'name' : data[0]?.item !== undefined ? 'item' : data[0]?.group !== undefined ? 'group' : data[0]?.channel !== undefined ? 'channel' : data[0]?.label !== undefined ? 'label' : 'key';

  if (widget.type === 'pie') {
    return (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={7} />
            <Pie data={data} dataKey="value" nameKey="name" outerRadius="76%" innerRadius="0%" stroke="#fff" strokeWidth={2} isAnimationActive animationDuration={650}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'line') {
    return (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 2, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid stroke="#E2F3EA" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748B' }} tickMargin={6} />
            <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={fmt} width={42} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={7} />
            {(widget.datasets || []).map((ds, i) => <Line key={ds.dataKey} type="monotone" dataKey={ds.dataKey} name={ds.name} stroke={roleColor[ds.role || 'primary'] || COLORS[i]} strokeWidth={2.4} dot={false} strokeDasharray={isPreviousDataset(ds) ? '5 5' : undefined} isAnimationActive animationDuration={650} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'bar') {
    return (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 2, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid stroke="#E2F3EA" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={fmt} />
            <YAxis type="category" dataKey={yKey} tick={{ fontSize: 10, fill: '#64748B' }} width={92} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={7} />
            {(widget.datasets || []).map((ds, i) => <Bar key={ds.dataKey} dataKey={ds.dataKey} name={ds.name} fill={roleColor[ds.role || 'primary'] || COLORS[i]} radius={[0, 7, 7, 0]} isAnimationActive animationDuration={650} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 2, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="#E2F3EA" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748B' }} tickMargin={6} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={fmt} width={42} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={fmt} width={38} />
          <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={7} />
          {(widget.datasets || []).map((ds, i) => ds.type === 'line'
            ? <Line key={ds.dataKey} yAxisId={ds.axis === 'right' ? 'right' : 'left'} type="monotone" dataKey={ds.dataKey} name={ds.name} stroke={roleColor[ds.role || 'primary'] || COLORS[i]} strokeWidth={2.4} dot={false} strokeDasharray={isPreviousDataset(ds) ? '5 5' : undefined} isAnimationActive animationDuration={650} />
            : <Bar key={ds.dataKey} yAxisId={ds.axis === 'right' ? 'right' : 'left'} dataKey={ds.dataKey} name={ds.name} fill={roleColor[ds.role || 'primary'] || COLORS[i]} radius={[7, 7, 0, 0]} isAnimationActive animationDuration={650} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
