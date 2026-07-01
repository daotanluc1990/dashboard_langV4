'use client';
import { useEffect, useState } from 'react';
import type { DashboardFilters, PeriodKey } from '@/types/dashboard';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const timeOptions: Array<{ period: PeriodKey; label: string; description: string }> = [
  { period: 'realTime', label: 'Thời gian thực', description: 'Theo tháng dữ liệu mới nhất trong Google Sheet' },
  { period: 'last7Days', label: 'Trong vòng 7 ngày qua', description: '7 ngày gần nhất theo dữ liệu' },
  { period: 'previousWeek', label: 'Tuần trước', description: 'Tuần liền trước kỳ hiện tại' },
  { period: 'last30Days', label: 'Trong vòng 30 ngày qua', description: '30 ngày gần nhất theo dữ liệu' },
  { period: 'previousMonth', label: 'Tháng trước', description: 'Từ ngày đầu đến cuối tháng trước' },
  { period: 'last90Days', label: 'Trong vòng 90 ngày qua', description: '90 ngày gần nhất theo dữ liệu' },
  { period: 'thisYear', label: 'Năm nay', description: 'Từ đầu năm đến dữ liệu mới nhất' },
  { period: 'custom', label: 'Chọn khoảng thời gian', description: 'Dùng ngày bắt đầu và ngày kết thúc bên dưới' }
];

function dateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatInputDate(value?: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return dateFormatter.format(new Date(year, month - 1, day));
}

function localRangeForPeriod(period: PeriodKey): Pick<DashboardFilters, 'startDate' | 'endDate'> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'last7Days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { startDate: dateInputValue(start), endDate: dateInputValue(today) };
  }
  if (period === 'last30Days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { startDate: dateInputValue(start), endDate: dateInputValue(today) };
  }
  if (period === 'last90Days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    return { startDate: dateInputValue(start), endDate: dateInputValue(today) };
  }
  if (period === 'previousWeek') {
    const day = today.getDay() || 7;
    const end = new Date(today);
    end.setDate(today.getDate() - day);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
  }
  if (period === 'previousMonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
  }
  if (period === 'thisYear') {
    return { startDate: dateInputValue(new Date(today.getFullYear(), 0, 1)), endDate: dateInputValue(today) };
  }
  return { startDate: undefined, endDate: undefined };
}

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
  const [timeOpen, setTimeOpen] = useState(false);
  const set = (patch: Partial<DashboardFilters>) => setDraft((current) => ({ ...current, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(filters);
  const currentTimeOption = timeOptions.find((option) => option.period === draft.period) || timeOptions[0];
  const rangeText = draft.startDate && draft.endDate
    ? `${formatInputDate(draft.startDate)} - ${formatInputDate(draft.endDate)}`
    : currentTimeOption.description;

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  function selectPeriod(period: PeriodKey) {
    const range = localRangeForPeriod(period);
    setDraft((current) => ({ ...current, period, ...range }));
    setTimeOpen(false);
  }

  function setDate(patch: Partial<Pick<DashboardFilters, 'startDate' | 'endDate'>>) {
    setDraft((current) => ({ ...current, period: 'custom', ...patch }));
  }

  return (
    <section className="filters">
      <div className="filter-grid">
        <div className="f time-filter">
          <label>Thời gian</label>
          <button className="time-trigger" type="button" onClick={() => setTimeOpen((value) => !value)} aria-expanded={timeOpen}>
            <span>{currentTimeOption.label}</span>
            <small>{rangeText}</small>
          </button>
          {timeOpen ? (
            <div className="time-menu">
              {timeOptions.map((option) => (
                <button key={option.period} type="button" className={option.period === draft.period ? 'active' : ''} onClick={() => selectPeriod(option.period)}>
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="f"><label>Từ ngày</label><input type="date" value={draft.startDate || ''} onChange={e=>setDate({startDate:e.target.value})}/></div>
        <div className="f"><label>Đến ngày</label><input type="date" value={draft.endDate || ''} onChange={e=>setDate({endDate:e.target.value})}/></div>
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
