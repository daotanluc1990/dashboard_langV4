import type { DashboardWidget } from '@/types/dashboard';

export function DataTable({ widget }: { widget: DashboardWidget }) {
  const rows = widget.data || [];
  const columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center'; statusKey?: string }> = widget.columns || Object.keys(rows[0] || {}).map((key) => ({ key, label: key }));
  if (!rows.length) return <div className="empty">Chưa có dữ liệu phù hợp với bộ lọc</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'right' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.status ? String(row.status) : ''}>
              {columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'right' : ''}>{String(row[c.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
