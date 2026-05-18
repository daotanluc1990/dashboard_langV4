'use client';
import type { DashboardFilters } from '@/types/dashboard';
export function FilterBar({ filters, onChange }: { filters: DashboardFilters; onChange: (f: DashboardFilters) => void }) {
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch });
  return (
    <section className="filters">
      <div className="filter-grid">
        <div className="f"><label>Kỳ</label><select value={filters.period} onChange={e=>set({period:e.target.value as any})}><option value="today">Hôm nay</option><option value="thisWeek">Tuần này</option><option value="thisMonth">Tháng này</option><option value="thisYear">Năm nay</option><option value="custom">Tùy chọn</option></select></div>
        <div className="f"><label>Từ ngày</label><input type="date" value={filters.startDate || ''} onChange={e=>set({startDate:e.target.value})}/></div>
        <div className="f"><label>Đến ngày</label><input type="date" value={filters.endDate || ''} onChange={e=>set({endDate:e.target.value})}/></div>
        <div className="f"><label>So sánh</label><select value={filters.compareMode} onChange={e=>set({compareMode:e.target.value as any})}><option value="none">Không so sánh</option><option value="previousPeriod">Kỳ trước</option><option value="previousMonth">Cùng kỳ tháng trước</option><option value="previousYear">Cùng kỳ năm trước</option></select></div>
        <div className="f"><label>Chi nhánh</label><input value={filters.branch === 'all' ? '' : filters.branch} placeholder="Tất cả chi nhánh" onChange={e=>set({branch:e.target.value || 'all'})}/></div>
        <div className="f"><label>Kênh</label><select value={filters.channel} onChange={e=>set({channel:e.target.value})}><option value="all">Tất cả kênh</option><option>Tiền mặt</option><option>Chuyển khoản</option><option>Grab</option><option>Shopee</option><option>Be</option><option>Takeaway</option></select></div>
        <div className="f"><label>Ca</label><select value={filters.shift} onChange={e=>set({shift:e.target.value})}><option value="all">Tất cả ca</option><option>Sáng</option><option>Tối</option></select></div>
        <button className="btn-primary" type="button" onClick={()=>set({})}>Áp dụng</button>
      </div>
    </section>
  );
}
