'use client';
import type { DashboardWidget } from '@/types/dashboard';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DataTable } from './DataTable';

const COLORS = ['#1D4E89', '#2A9D8F', '#F4A261', '#E76F51', '#3A86FF', '#6C757D', '#8AB17D'];
const roleColor: Record<string, string> = { primary: '#1D4E89', success: '#2A9D8F', warning: '#F4A261', danger: '#E76F51', muted: '#8D99AE', blue: '#3A86FF' };

function fmt(v: any) {
  if (typeof v !== 'number') return v;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2).replace('.', ',')} tỷ`;
  if (abs >= 1_000_000) return `${Math.round(v / 1_000_000).toLocaleString('vi-VN')}tr`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString('vi-VN')}k`;
  return Math.round(v).toLocaleString('vi-VN');
}

export function ChartPanel({ widget, layoutClass }: { widget: DashboardWidget; layoutClass?: string }) {
  return (
    <article className={`widget widget-${widget.type} ${layoutClass || widget.className || 'std-main-mid'}`}>
      <div className="widget-head">
        <div>
          <h3>{widget.title}</h3>
        </div>
      </div>
      <div className="widget-body">{renderWidget(widget)}</div>
    </article>
  );
}

function renderWidget(widget: DashboardWidget) {
  if (widget.empty || widget.type === 'empty') return <div className="empty small">{widget.message || 'Chưa có dữ liệu phù hợp với bộ lọc'}</div>;
  const data = widget.data || [];
  if (!data.length) return <div className="empty small">Chưa có dữ liệu phù hợp với bộ lọc</div>;
  if (widget.type === 'table' || widget.type === 'alertTable') return <DataTable widget={widget} />;

  const xKey = data[0]?.label !== undefined ? 'label' : data[0]?.name !== undefined ? 'name' : data[0]?.branch !== undefined ? 'branch' : data[0]?.item !== undefined ? 'item' : data[0]?.group !== undefined ? 'group' : data[0]?.channel !== undefined ? 'channel' : 'key';
  const yKey = data[0]?.branch !== undefined ? 'branch' : data[0]?.name !== undefined ? 'name' : data[0]?.item !== undefined ? 'item' : data[0]?.group !== undefined ? 'group' : data[0]?.channel !== undefined ? 'channel' : data[0]?.label !== undefined ? 'label' : 'key';

  if (widget.type === 'pie') {
    return (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} iconSize={7}/>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius="72%" innerRadius="0%" stroke="#fff" strokeWidth={2}>
              {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>) }
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
          <LineChart data={data} margin={{ left: 4, right: 8, top: 2, bottom: 0 }}>
            <CartesianGrid stroke="#E9EFF5" />
            <XAxis dataKey={xKey} tick={{fontSize:10, fill:'#637083'}} tickMargin={4} />
            <YAxis tick={{fontSize:10, fill:'#637083'}} tickFormatter={fmt} width={34}/>
            <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} iconSize={7}/>
            {(widget.datasets||[]).map((ds,i)=><Line key={ds.dataKey} type="monotone" dataKey={ds.dataKey} name={ds.name} stroke={roleColor[ds.role||'primary']||COLORS[i]} strokeWidth={2.2} dot={false}/>) }
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'bar') {
    return (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 8, top: 2, bottom: 0 }}>
            <CartesianGrid stroke="#E9EFF5" />
            <XAxis type="number" tick={{fontSize:10, fill:'#637083'}} tickFormatter={fmt}/>
            <YAxis type="category" dataKey={yKey} tick={{fontSize:10, fill:'#637083'}} width={88}/>
            <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} iconSize={7}/>
            {(widget.datasets||[]).map((ds,i)=><Bar key={ds.dataKey} dataKey={ds.dataKey} name={ds.name} fill={roleColor[ds.role||'primary']||COLORS[i]} radius={[0,6,6,0]}/>) }
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'stacked') {
    return (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 4, right: 8, top: 2, bottom: 0 }} barCategoryGap="26%" barGap={0}>
            <CartesianGrid stroke="#E8EEF5" vertical={false} />
            <XAxis dataKey={xKey} tick={{fontSize:10, fill:'#5D6B7C'}} tickMargin={4} />
            <YAxis tick={{fontSize:10, fill:'#5D6B7C'}} tickFormatter={fmt} width={38}/>
            <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 12, border: '0', background: '#172033', color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} iconSize={7}/>
            {(widget.datasets||[]).map((ds,i)=><Bar key={ds.dataKey} stackId="total" dataKey={ds.dataKey} name={ds.name} fill={roleColor[ds.role||'primary']||COLORS[i%COLORS.length]} maxBarSize={34} radius={[3,3,3,3]}/>) }
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 4, right: 8, top: 2, bottom: 0 }}>
          <CartesianGrid stroke="#E9EFF5" />
          <XAxis dataKey={xKey} tick={{fontSize:10, fill:'#637083'}} tickMargin={4}/>
          <YAxis yAxisId="left" tick={{fontSize:10, fill:'#637083'}} tickFormatter={fmt} width={34}/>
          <YAxis yAxisId="right" orientation="right" tick={{fontSize:10, fill:'#637083'}} tickFormatter={fmt} width={34}/>
          <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '0', background: '#172033', color: '#fff' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} iconSize={7}/>
          {(widget.datasets||[]).map((ds,i)=> ds.type === 'line'
            ? <Line key={ds.dataKey} yAxisId={ds.axis === 'right' ? 'right' : 'left'} type="monotone" dataKey={ds.dataKey} name={ds.name} stroke={roleColor[ds.role||'primary']||COLORS[i]} strokeWidth={2.2} dot={false}/>
            : <Bar key={ds.dataKey} yAxisId={ds.axis === 'right' ? 'right' : 'left'} dataKey={ds.dataKey} name={ds.name} fill={roleColor[ds.role||'primary']||COLORS[i]} radius={[6,6,0,0]}/>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
