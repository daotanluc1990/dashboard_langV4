'use client';
import { useEffect, useState } from 'react';
import type { DashboardFilters } from '@/types/dashboard';

export function FilterBar({
  filters,
  loading,
  onChange
}: {
  filters: DashboardFilters;
  loading?: boolean;
  onChange: (f: DashboardFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const set = (patch: Partial<DashboardFilters>) => setDraft((current) => ({ ...current, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  return (
    <section className="filters">
      <div className="filter-grid">
        <div className="f"><label>Kỳ</label><select value={draft.period} onChange={e=>set({period:e.target.value as any})}><option value="latestMonth">Tháng dữ liệu mới nhất</option><option value="today">Hôm nay</option><option value="thisWeek">Tuần này</option><option value="thisMonth">Tháng này</option><option value="thisYear">Năm nay</option><option value="custom">Tùy chọn</option></select></div>
        <div className="f"><label>Từ ngày</label><input type="date" value={draft.startDate || ''} onChange={e=>set({startDate:e.target.value})}/></div>
        <div className="f"><label>Đến ngày</label><input type="date" value={draft.endDate || ''} onChange={e=>set({endDate:e.target.value})}/></div>
        <div className="f"><label>So sánh</label><select value={draft.compareMode} onChange={e=>set({compareMode:e.target.value as any})}><option value="none">Không so sánh</option><option value="previousPeriod">Kỳ trước</option><option value="previousMonth">Cùng kỳ tháng trước</option><option value="previousYear">Cùng kỳ năm trước</option></select></div>
        <div className="f"><label>Chi nhánh</label><input value={draft.branch === 'all' ? '' : draft.branch} placeholder="Tất cả chi nhánh" onChange={e=>set({branch:e.target.value || 'all'})}/></div>
        <div className="f"><label>Kênh</label><select value={draft.channel} onChange={e=>set({channel:e.target.value})}><option value="all">Tất cả kênh</option><option>Tiền mặt</option><option>Chuyển khoản</option><option>Grab</option><option>Shopee</option><option>Be</option><option>Xanh ngon</option><option>Takeaway</option></select></div>
        <div className="f"><label>Ca</label><select value={draft.shift} onChange={e=>set({shift:e.target.value})}><option value="all">Tất cả ca</option><option>Sáng</option><option>Tối</option></select></div>
        <button className="btn-primary filter-apply" type="button" onClick={()=>onChange(draft)} disabled={loading || !dirty}>
          {loading ? 'Đang tải' : dirty ? 'Áp dụng' : 'Đã áp dụng'}
        </button>
      </div>
    </section>
  );
}
