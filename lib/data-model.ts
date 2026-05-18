import type { DashboardFilters, RawWorkbook } from '@/types/dashboard';
import { formatDateKey, formatDateLabel, monthLabel, parseLocalDate, pick, safeDiv, toNumber, fmtMoney, fmtPct, fmtCount, pctChange, deltaText, formatMonthKey } from '@/lib/format';

export interface SaleRow {
  date: Date | null;
  dateKey: string;
  monthKey: string;
  branch: string;
  branchName: string;
  channel: string;
  shift: string;
  revenue: number;
  orders: number;
  portions: number;
  boxes: number;
  plates: number;
  cogs: number;
  labor: number;
  cash: number;
  transfer: number;
  grab: number;
  shopee: number;
  be: number;
  xanh: number;
  takeaway: number;
}

export interface CostRow {
  branch: string;
  group: string;
  monthKey: string;
  amount: number;
  status: string;
}

export interface FeedbackRow {
  date: Date | null;
  branch: string;
  rating: number;
  issue: string;
  channel: string;
  shift: string;
  sentiment: string;
  status: string;
  severity: string;
  owner: string;
  content: string;
  responseTimeHours: number;
  slaHours: number;
  slaOk: boolean;
}

export interface Context {
  filters: DashboardFilters;
  rows: SaleRow[];
  previousRows: SaleRow[];
  costs: CostRow[];
  previousCosts: CostRow[];
  feedback: FeedbackRow[];
  previousFeedback: FeedbackRow[];
  workbook: RawWorkbook;
  groupMode: 'day' | 'month' | 'year';
  periodLabel: string;
  compareLabel: string;
  stores: string[];
  targets: { revenue: number };
}

function dateRangeFromFilters(filters: DashboardFilters): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filters.period === 'today') return { start: today, end: today };
  if (filters.period === 'thisWeek') {
    const day = today.getDay() || 7;
    const start = new Date(today);
    start.setDate(today.getDate() - day + 1);
    return { start, end: today };
  }
  if (filters.period === 'thisYear') return { start: new Date(today.getFullYear(), 0, 1), end: today };
  if (filters.period === 'custom' && filters.startDate && filters.endDate) {
    return { start: parseLocalDate(filters.startDate) || today, end: parseLocalDate(filters.endDate) || today };
  }
  return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
}

function previousRange(start: Date, end: Date, mode: DashboardFilters['compareMode']): { start: Date; end: Date } | null {
  if (mode === 'none') return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (mode === 'previousPeriod') {
    const pEnd = new Date(start); pEnd.setDate(start.getDate() - 1);
    const pStart = new Date(pEnd); pStart.setDate(pEnd.getDate() - days + 1);
    return { start: pStart, end: pEnd };
  }
  if (mode === 'previousMonth') {
    return { start: new Date(start.getFullYear(), start.getMonth() - 1, start.getDate()), end: new Date(end.getFullYear(), end.getMonth() - 1, end.getDate()) };
  }
  if (mode === 'previousYear') {
    return { start: new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()), end: new Date(end.getFullYear() - 1, end.getMonth(), end.getDate()) };
  }
  return null;
}

function inferGroupMode(start: Date, end: Date, period: DashboardFilters['period']): Context['groupMode'] {
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (period === 'thisYear') return 'month';
  if (days > 730) return 'year';
  if (days > 93) return 'month';
  return 'day';
}

function between(d: Date | null, start: Date, end: Date): boolean {
  if (!d) return false;
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function channelFromRow(row: Record<string, any>): string {
  const direct = String(pick(row, ['Kênh', 'Kênh bán', 'Channel']) || '').trim();
  if (direct) return direct;
  const vals = [
    ['Grab', toNumber(pick(row, ['Grab_TH', 'Grab', 'GrabFood']))],
    ['Shopee', toNumber(pick(row, ['Shopee_TH', 'Shopee', 'ShopeeFood']))],
    ['Be', toNumber(pick(row, ['Be_TH', 'Be']))],
    ['Xanh', toNumber(pick(row, ['Xanh_TH', 'Xanh', 'Xanh SM', 'XanhSM']))],
    ['Tiền mặt', toNumber(pick(row, ['Tiền Mặt', 'Tien Mat', 'Cash']))],
    ['Chuyển khoản', toNumber(pick(row, ['Chuyển khoản', 'Chuyen khoan', 'MoMo', 'Bank']))]
  ].sort((a, b) => Number(b[1]) - Number(a[1]));
  return Number(vals[0][1]) > 0 ? String(vals[0][0]) : 'Khác';
}

function normalizeShift(s: unknown): string {
  const text = String(s || '').toLowerCase();
  if (text.includes('sáng') || text.includes('sang') || text.includes('morning')) return 'Sáng';
  if (text.includes('tối') || text.includes('toi') || text.includes('evening') || text.includes('chiều') || text.includes('chieu')) return 'Tối';
  return s ? String(s) : 'Không rõ';
}

export function normalizeSales(workbook: RawWorkbook): SaleRow[] {
  return workbook.dashboard.map((row) => {
    const date = parseLocalDate(pick(row, ['Ngày', 'Ngay', 'Date', 'Thời gian', 'Timestamp'])) || null;
    const branch = String(pick(row, ['Mã CH', 'Ma CH', 'Branch ID', 'Chi nhánh', 'Cửa hàng']) || 'Không rõ').trim();
    const branchName = String(pick(row, ['Tên CH', 'Tên chi nhánh', 'Chi nhánh', 'Cửa hàng']) || branch).trim();
    const cash = toNumber(pick(row, ['Tiền Mặt', 'Tien Mat', 'Cash']));
    const transfer = toNumber(pick(row, ['Chuyển khoản', 'Chuyen khoan', 'MoMo', 'Bank', 'CK']));
    const grab = toNumber(pick(row, ['Grab_TH', 'Grab', 'GrabFood']));
    const shopee = toNumber(pick(row, ['Shopee_TH', 'Shopee', 'ShopeeFood']));
    const be = toNumber(pick(row, ['Be_TH', 'Be']));
    const xanh = toNumber(pick(row, ['Xanh_TH', 'Xanh', 'Xanh SM', 'XanhSM']));
    const takeaway = toNumber(pick(row, ['Takeaway', 'Mang đi']));
    const explicitRevenue = toNumber(pick(row, ['Doanh_Thu_Thực_Nhận', 'Doanh thu thuần', 'Doanh thu', 'Revenue', 'Net Revenue']));
    const revenue = explicitRevenue || cash + transfer + grab + shopee + be + takeaway;
    const boxes = toNumber(pick(row, ['Hộp', 'Hop', 'Số Hộp', 'Số hộp', 'So Hop', 'So hop', 'Boxes', 'Box']));
    const plates = toNumber(pick(row, ['Dĩa', 'Đĩa', 'Dia', 'Số Dĩa', 'Số dĩa', 'Số Đĩa', 'Số đĩa', 'So Dia', 'So dia', 'Plates', 'Plate']));
    const explicitPortions = toNumber(pick(row, ['Tổng Phần', 'Tổng phần', 'Tổng số phần', 'Tong Phan', 'Tong phan', 'Total Portions', 'Portions']));
    const portions = explicitPortions || boxes + plates;
    const orders = portions || toNumber(pick(row, ['Số đơn', 'Orders']));
    const cogs = toNumber(pick(row, ['COGS', 'Giá vốn', 'Gia von', 'Food Cost Amount']));
    const labor = toNumber(pick(row, ['Labor', 'Lương', 'Chi phí nhân sự', 'Nhan su']));
    return {
      date,
      dateKey: date ? formatDateKey(date) : '',
      monthKey: date ? formatMonthKey(date.getFullYear(), date.getMonth() + 1) : '',
      branch,
      branchName,
      channel: channelFromRow(row),
      shift: normalizeShift(pick(row, ['Ca', 'Ca bán', 'Shift'])),
      revenue,
      orders,
      portions,
      boxes,
      plates,
      cogs,
      labor,
      cash,
      transfer,
      grab,
      shopee,
      be,
      xanh,
      takeaway
    };
  }).filter((r) => r.date && (r.revenue || r.orders));
}

export function normalizeCosts(workbook: RawWorkbook): CostRow[] {
  return workbook.costs.map((row) => {
    const month = toNumber(pick(row, ['Tháng', 'Thang', 'Month']));
    const year = toNumber(pick(row, ['Năm', 'Nam', 'Year']));
    return {
      branch: String(pick(row, ['Mã CH', 'Ma CH', 'Chi nhánh', 'Cửa hàng']) || 'Không rõ').trim(),
      group: String(pick(row, ['Khoản mục', 'Khoan muc', 'Nhóm chi phí', 'Group']) || 'Khác').trim(),
      monthKey: year && month ? formatMonthKey(year, month) : '',
      amount: toNumber(pick(row, ['Số tiền (đ)', 'Số tiền', 'So tien', 'Amount'])),
      status: String(pick(row, ['Trạng thái', 'Trang thai', 'Status']) || '').trim()
    };
  }).filter((r) => r.amount && r.monthKey);
}

export function normalizeFeedback(workbook: RawWorkbook): FeedbackRow[] {
  return workbook.feedback.map((row) => {
    const rating = toNumber(pick(row, ['Rating', 'Số sao', 'Điểm', 'CSAT']));
    const responseTimeHours = toNumber(pick(row, ['Thời gian phản hồi', 'Thời gian phản hồi TB', 'FRT', 'Response Time', 'Response Hours', 'Số giờ phản hồi']));
    const slaHours = toNumber(pick(row, ['SLA giờ', 'SLA Hours', 'SLA', 'Ngưỡng SLA'])) || 24;
    const status = String(pick(row, ['Trạng thái xử lý', 'Trạng thái', 'Status']) || '').trim();
    const sentiment = String(pick(row, ['Cảm xúc', 'Sentiment', 'Phân loại']) || '').trim();
    const severity = String(pick(row, ['Mức độ', 'Severity', 'Level']) || '').trim();
    const issue = String(pick(row, ['Nhóm lỗi', 'Vấn đề', 'Keyword', 'Nội dung', 'Lý do']) || 'Khác').trim();
    return {
      date: parseLocalDate(pick(row, ['Ngày', 'Date', 'Thời gian'])),
      branch: String(pick(row, ['Mã CH', 'Chi nhánh', 'Cửa hàng', 'Branch']) || 'Không rõ').trim(),
      rating,
      issue,
      channel: String(pick(row, ['Kênh', 'Channel', 'Nguồn']) || '').trim(),
      shift: normalizeShift(pick(row, ['Ca', 'Ca bán', 'Shift'])),
      sentiment,
      status,
      severity,
      owner: String(pick(row, ['Người phụ trách', 'Phụ trách', 'Owner', 'PIC']) || '').trim(),
      content: String(pick(row, ['Nội dung phản hồi', 'Nội dung', 'Phản hồi', 'Comment', 'Feedback']) || '').trim(),
      responseTimeHours,
      slaHours,
      slaOk: responseTimeHours ? responseTimeHours <= slaHours : /đã|done|xong|closed|phản hồi/i.test(status)
    };
  }).filter((r) => r.rating || r.issue !== 'Khác' || r.content);
}

function filterSales(rows: SaleRow[], filters: DashboardFilters, start: Date, end: Date): SaleRow[] {
  return rows.filter((r) => between(r.date, start, end))
    .filter((r) => filters.branch === 'all' || r.branch === filters.branch || r.branchName === filters.branch)
    .filter((r) => filters.channel === 'all' || r.channel === filters.channel)
    .filter((r) => filters.shift === 'all' || r.shift === filters.shift);
}

function filterCosts(rows: CostRow[], filters: DashboardFilters, start: Date, end: Date): CostRow[] {
  const startKey = formatMonthKey(start.getFullYear(), start.getMonth() + 1);
  const endKey = formatMonthKey(end.getFullYear(), end.getMonth() + 1);
  return rows.filter((r) => r.monthKey >= startKey && r.monthKey <= endKey)
    .filter((r) => filters.branch === 'all' || r.branch === filters.branch);
}

function filterFeedback(rows: FeedbackRow[], filters: DashboardFilters, start: Date, end: Date): FeedbackRow[] {
  return rows.filter((r) => between(r.date, start, end))
    .filter((r) => filters.branch === 'all' || r.branch === filters.branch)
    .filter((r) => filters.channel === 'all' || !r.channel || r.channel === filters.channel);
}

export function makeContext(workbook: RawWorkbook, filters: DashboardFilters): Context {
  const allSales = normalizeSales(workbook);
  const allCosts = normalizeCosts(workbook);
  const allFeedback = normalizeFeedback(workbook);
  const range = dateRangeFromFilters(filters);
  const pRange = previousRange(range.start, range.end, filters.compareMode);
  const rows = filterSales(allSales, filters, range.start, range.end);
  const previousRows = pRange ? filterSales(allSales, filters, pRange.start, pRange.end) : [];
  const costs = filterCosts(allCosts, filters, range.start, range.end);
  const previousCosts = pRange ? filterCosts(allCosts, filters, pRange.start, pRange.end) : [];
  const feedback = filterFeedback(allFeedback, filters, range.start, range.end);
  const previousFeedback = pRange ? filterFeedback(allFeedback, filters, pRange.start, pRange.end) : [];
  const stores = Array.from(new Set(allSales.map((r) => r.branchName || r.branch).filter(Boolean)));
  const revenueTarget = workbook.targets.reduce((sum, row) => sum + toNumber(pick(row, ['Mục tiêu doanh thu', 'Doanh thu mục tiêu', 'Revenue Target', 'Target'])), 0);
  return {
    filters,
    rows,
    previousRows,
    costs,
    previousCosts,
    feedback,
    previousFeedback,
    workbook,
    groupMode: inferGroupMode(range.start, range.end, filters.period),
    periodLabel: `${formatDateKey(range.start)} → ${formatDateKey(range.end)}`,
    compareLabel: filters.compareMode === 'none' ? 'Không so sánh' : 'Có so sánh',
    stores,
    targets: { revenue: revenueTarget }
  };
}

export function totals(rows: SaleRow[], costs: CostRow[] = []) {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const orders = rows.reduce((s, r) => s + r.orders, 0);
  const cogsFromRows = rows.reduce((s, r) => s + r.cogs, 0);
  const laborFromRows = rows.reduce((s, r) => s + r.labor, 0);
  const costTotal = costs.reduce((s, r) => s + r.amount, 0);
  const cogs = cogsFromRows;
  const labor = laborFromRows || costs.filter((c) => /lương|nhân sự|nhan su/i.test(c.group)).reduce((s, r) => s + r.amount, 0);
  const netProfit = revenue - (cogs || 0) - (costTotal || 0);
  return {
    revenue,
    orders,
    aov: safeDiv(revenue, orders),
    cogs,
    labor,
    costTotal,
    grossProfit: revenue - cogs,
    operatingProfit: revenue - cogs - costTotal + labor,
    netProfit,
    grossMargin: safeDiv(revenue - cogs, revenue) * 100,
    netMargin: safeDiv(netProfit, revenue) * 100,
    foodCostPct: safeDiv(cogs, revenue) * 100,
    laborCostPct: safeDiv(labor, revenue) * 100
  };
}

export function groupSalesByTime(rows: SaleRow[], mode: Context['groupMode']) {
  const map = new Map<string, any>();
  for (const r of rows) {
    if (!r.date) continue;
    const key = mode === 'year' ? String(r.date.getFullYear()) : mode === 'month' ? r.monthKey : r.dateKey;
    const label = mode === 'year' ? key : mode === 'month' ? monthLabel(key) : formatDateLabel(r.date);
    const item = map.get(key) || { key, label, revenue: 0, orders: 0, cogs: 0, labor: 0 };
    item.revenue += r.revenue; item.orders += r.orders; item.cogs += r.cogs; item.labor += r.labor;
    map.set(key, item);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).map((x) => ({ ...x, aov: safeDiv(x.revenue, x.orders), profit: x.revenue - x.cogs - x.labor, margin: safeDiv(x.revenue - x.cogs - x.labor, x.revenue) * 100 }));
}

export function groupByBranch(rows: SaleRow[], prevRows: SaleRow[] = []) {
  const prev = new Map<string, number>();
  for (const r of prevRows) prev.set(r.branchName, (prev.get(r.branchName) || 0) + r.revenue);
  const map = new Map<string, any>();
  for (const r of rows) {
    const key = r.branchName || r.branch;
    const item = map.get(key) || { branch: key, revenue: 0, orders: 0, cogs: 0, labor: 0 };
    item.revenue += r.revenue; item.orders += r.orders; item.cogs += r.cogs; item.labor += r.labor;
    map.set(key, item);
  }
  return Array.from(map.values()).map((x) => {
    const profit = x.revenue - x.cogs - x.labor;
    const previousRevenue = prev.get(x.branch) || 0;
    return { ...x, profit, margin: safeDiv(profit, x.revenue) * 100, previousRevenue, growthPct: pctChange(x.revenue, previousRevenue), variance: x.revenue - previousRevenue };
  }).sort((a, b) => b.revenue - a.revenue);
}

export function groupByChannel(rows: SaleRow[]) {
  const groups = ['Tiền mặt', 'Chuyển khoản', 'Grab', 'Shopee', 'Be', 'Xanh', 'Takeaway'];
  const totalsByExplicit = new Map<string, any>();
  for (const r of rows) {
    const entries = [
      ['Tiền mặt', r.cash], ['Chuyển khoản', r.transfer], ['Grab', r.grab], ['Shopee', r.shopee], ['Be', r.be], ['Xanh', r.xanh], ['Takeaway', r.takeaway]
    ];
    const hasBreakdown = entries.some(([, v]) => Number(v) > 0);
    if (hasBreakdown) {
      for (const [name, value] of entries) {
        const n = Number(value || 0); if (!n) continue;
        const item = totalsByExplicit.get(String(name)) || { name, revenue: 0, orders: 0 };
        item.revenue += n;
        item.orders += r.orders * safeDiv(n, r.revenue || n);
        totalsByExplicit.set(String(name), item);
      }
    } else {
      const name = r.channel || 'Khác';
      const item = totalsByExplicit.get(name) || { name, revenue: 0, orders: 0 };
      item.revenue += r.revenue; item.orders += r.orders;
      totalsByExplicit.set(name, item);
    }
  }
  return groups.concat('Khác').map((name) => totalsByExplicit.get(name)).filter(Boolean).map((x) => ({ ...x, aov: safeDiv(x.revenue, x.orders), share: 0 }));
}

export function groupCostsByGroup(rows: CostRow[], prev: CostRow[] = []) {
  const prevMap = new Map<string, number>();
  for (const r of prev) prevMap.set(r.group, (prevMap.get(r.group) || 0) + r.amount);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.group, (map.get(r.group) || 0) + r.amount);
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  return Array.from(map.entries()).map(([name, amount]) => ({ name, amount, share: safeDiv(amount, total) * 100, previous: prevMap.get(name) || 0, growthPct: pctChange(amount, prevMap.get(name) || 0) })).sort((a, b) => b.amount - a.amount);
}

export function groupCostsByBranch(rows: CostRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.branch, (map.get(r.branch) || 0) + r.amount);
  return Array.from(map.entries()).map(([branch, amount]) => ({ branch, amount })).sort((a, b) => b.amount - a.amount);
}

export function groupCostsByMonth(costs: CostRow[], sales: SaleRow[]) {
  const cMap = new Map<string, number>();
  for (const c of costs) cMap.set(c.monthKey, (cMap.get(c.monthKey) || 0) + c.amount);
  const sMap = new Map<string, number>();
  for (const r of sales) sMap.set(r.monthKey, (sMap.get(r.monthKey) || 0) + r.revenue);
  return Array.from(new Set([...cMap.keys(), ...sMap.keys()])).sort().map((key) => ({ key, label: monthLabel(key), cost: cMap.get(key) || 0, revenue: sMap.get(key) || 0, ratio: safeDiv(cMap.get(key) || 0, sMap.get(key) || 0) * 100 }));
}

export function makeKpi(id: string, title: string, current: number, previous: number, format: 'money' | 'count' | 'pct', status: 'good' | 'warning' | 'danger' | 'neutral' = 'neutral') {
  const value = format === 'money' ? fmtMoney(current) : format === 'pct' ? fmtPct(current) : fmtCount(current);
  return { id, title, value, rawValue: current, delta: previous ? deltaText(current, previous, format === 'pct') : '—', deltaRaw: pctChange(current, previous), status };
}
