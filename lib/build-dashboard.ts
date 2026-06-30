import type { DashboardFilters, DashboardPayload, DashboardWidget, KpiCard, RawWorkbook, TabId } from '@/types/dashboard';
import { tabTitles } from '@/lib/dashboard-config';
import { fmtCount, fmtMoney, fmtPct, pctChange, safeDiv, toNumber, pick, parseLocalDate, formatDateKey, formatDateLabel, monthLabel, formatMonthKey } from '@/lib/format';
import {
  groupByBranch,
  groupByChannel,
  groupCostsByBranch,
  groupCostsByGroup,
  groupCostsByMonth,
  groupSalesByTime,
  makeContext,
  makeKpi,
  totals
} from '@/lib/data-model';

type Ctx = ReturnType<typeof makeContext>;
type Status = 'good' | 'warning' | 'danger' | 'neutral';

function emptyWidget(id: string, title: string, message = 'Chưa có dữ liệu phù hợp với bộ lọc'): DashboardWidget {
  return { id, title, type: 'empty', empty: true, message };
}

function statusForPct(value: number, warning: number, danger: number, reverse = false): Status {
  if (!Number.isFinite(value)) return 'neutral';
  if (reverse) {
    if (value >= warning) return 'good';
    if (value >= danger) return 'warning';
    return 'danger';
  }
  if (value >= danger) return 'danger';
  if (value >= warning) return 'warning';
  return 'good';
}

function topRows<T>(rows: T[], n = 8): T[] { return rows.slice(0, n); }
function sum<T>(rows: T[], fn: (row: T) => number): number { return rows.reduce((s, r) => s + fn(r), 0); }
function clean(text: unknown, fallback = 'Không rõ'): string { const v = String(text ?? '').trim(); return v || fallback; }
function compactStatus(value: number, good = 0, bad = -10): Status { return value >= good ? 'good' : value <= bad ? 'danger' : 'warning'; }
function kpi(id: string, title: string, value: string, status: Status = 'neutral', delta?: string): KpiCard { return { id, title, value, status, ...(delta ? { delta } : {}) }; }

function basePayload(tab: TabId, filters: DashboardFilters, kpis: KpiCard[], widgets: DashboardWidget[], meta: Omit<DashboardPayload['meta'], 'filters'>): DashboardPayload {
  return { ok: true, tab, ...tabTitles[tab], kpis, widgets, meta: { ...meta, filters } };
}

export function buildDashboardPayload(workbook: RawWorkbook, filters: DashboardFilters): DashboardPayload {
  const ctx = makeContext(workbook, filters);
  const builders: Record<TabId, () => any> = {
    overview: () => buildOverview(ctx),
    revenue: () => buildRevenue(ctx),
    pnl: () => buildPnl(ctx),
    cost: () => buildCost(ctx),
    channel: () => buildChannel(ctx),
    menu: () => buildMenu(ctx),
    operations: () => buildOperations(ctx),
    people: () => buildPeople(ctx),
    stock: () => buildStock(ctx),
    customer: () => buildCustomer(ctx),
    expansion: () => buildExpansion(ctx)
  };
  const result = builders[filters.tab]();
  return basePayload(filters.tab, filters, result.kpis, result.widgets, {
    periodLabel: ctx.periodLabel,
    compareLabel: ctx.compareLabel,
    generatedAt: new Date().toISOString(),
    source: 'google-sheets'
  });
}

function buildOverview(ctx: Ctx) {
  const t = totals(ctx.rows, ctx.costs);
  const p = totals(ctx.previousRows, ctx.previousCosts);
  const branches = groupByBranch(ctx.rows, ctx.previousRows);
  const belowStd = branches.filter((b) => b.margin < 10 || b.growthPct < -10).length;
  const kpis = [
    makeKpi('netRevenue', 'Doanh thu thuần', t.revenue, p.revenue, 'money', compactStatus(pctChange(t.revenue, p.revenue))),
    makeKpi('netProfit', 'Lợi nhuận ròng', t.netProfit, p.netProfit, 'money', t.netProfit >= 0 ? 'good' : 'danger'),
    makeKpi('netMargin', 'Net Margin %', t.netMargin, p.netMargin, 'pct', statusForPct(t.netMargin, 15, 8, true)),
    makeKpi('portions', 'Tổng phần', t.portions || t.orders, p.portions || p.orders, 'count', compactStatus(pctChange(t.portions || t.orders, p.portions || p.orders))),
    makeKpi('aov', 'AOV', t.aov, p.aov, 'money', compactStatus(pctChange(t.aov, p.aov))),
    { id: 'underStd', title: 'Số chi nhánh dưới chuẩn', value: fmtCount(belowStd), rawValue: belowStd, delta: belowStd ? 'Cần xử lý' : 'Ổn định', status: (belowStd ? 'danger' : 'good') as Status }
  ];
  const trendData = makeTrendCompare(ctx);
  const targetDaily = ctx.targets.revenue ? ctx.targets.revenue / Math.max(trendData.length, 1) : 0;
  const channel = withShare(groupByChannel(ctx.rows), 'revenue');
  const alerts = makeAlerts(ctx);
  const widgets: DashboardWidget[] = [
    trendData.length ? {
      id: 'overviewRevenueProfit', title: 'Doanh thu & lợi nhuận toàn chuỗi', subtitle: 'Cột doanh thu, line Net Margin % / lợi nhuận', type: 'combo', className: 'span-5 row-2', data: trendData,
      datasets: [
        { name: 'Doanh thu', dataKey: 'revenue', type: 'bar', role: 'primary' },
        { name: 'Lợi nhuận', dataKey: 'profit', type: 'line', role: 'success' },
        { name: 'Margin %', dataKey: 'margin', type: 'line', axis: 'right', role: 'warning' },
        ...(ctx.filters.compareMode !== 'none' ? [{ name: 'DT kỳ trước', dataKey: 'previousRevenue', type: 'line' as const, role: 'muted' as const }] : [])
      ]
    } : emptyWidget('overviewRevenueProfit', 'Doanh thu & lợi nhuận toàn chuỗi'),
    trendData.length ? {
      id: 'overviewTarget', title: 'Doanh thu thực tế vs mục tiêu', subtitle: 'Thực tế vs mục tiêu, kỳ trước trong tooltip/line', type: 'combo', className: 'span-3 row-2', data: trendData.map((x) => ({ ...x, target: targetDaily })),
      datasets: [
        { name: 'Thực tế', dataKey: 'revenue', type: 'bar', role: 'primary' },
        ...(targetDaily ? [{ name: 'Mục tiêu', dataKey: 'target', type: 'line' as const, role: 'danger' as const }] : []),
        ...(ctx.filters.compareMode !== 'none' ? [{ name: 'Kỳ trước', dataKey: 'previousRevenue', type: 'line' as const, role: 'muted' as const }] : [])
      ]
    } : emptyWidget('overviewTarget', 'Doanh thu thực tế vs mục tiêu'),
    branches.length ? {
      id: 'overviewBranchRank', title: 'Ranking chi nhánh: doanh thu & lợi nhuận', subtitle: 'Grouped bar: chi nhánh kéo lên/kéo xuống', type: 'bar', className: 'span-4 row-2', data: topRows(branches, 8),
      datasets: [{ name: 'Doanh thu', dataKey: 'revenue', role: 'primary' }, { name: 'Lợi nhuận', dataKey: 'profit', role: 'success' }]
    } : emptyWidget('overviewBranchRank', 'Ranking chi nhánh'),
    channel.length ? {
      id: 'overviewChannelPie', title: 'Cơ cấu doanh thu theo kênh', subtitle: 'Pie chỉ cho tỷ trọng kỳ hiện tại', type: 'pie', className: 'span-3 row-3', data: channel.map((c) => ({ name: c.name, value: c.revenue }))
    } : emptyWidget('overviewChannelPie', 'Cơ cấu doanh thu theo kênh'),
    {
      id: 'overviewHealthTable', title: 'Bảng sức khỏe chi nhánh', subtitle: 'Doanh thu, lợi nhuận, margin, tăng trưởng', type: 'table', className: 'span-5 row-3', data: topRows(branches, 8).map((b) => ({ branch: b.branch, revenue: fmtMoney(b.revenue), profit: fmtMoney(b.profit), margin: fmtPct(b.margin), growth: fmtPct(b.growthPct), status: b.margin < 10 || b.growthPct < -10 ? 'danger' : b.margin < 15 ? 'warning' : 'good' })),
      columns: [{ key: 'branch', label: 'Chi nhánh' }, { key: 'revenue', label: 'Doanh thu', align: 'right' }, { key: 'profit', label: 'Lợi nhuận', align: 'right' }, { key: 'margin', label: 'Margin', align: 'right' }, { key: 'growth', label: 'Tăng trưởng', align: 'right' }]
    },
    {
      id: 'overviewAlerts', title: 'Bảng cảnh báo CEO', subtitle: 'Mức độ, chi nhánh, vấn đề, chênh lệch, hành động', type: 'alertTable', className: 'span-4 row-3', data: alerts,
      columns: [{ key: 'level', label: 'Mức' }, { key: 'branch', label: 'Chi nhánh' }, { key: 'issue', label: 'Vấn đề' }, { key: 'action', label: 'Hành động' }]
    }
  ];
  return { kpis, widgets };
}

function buildRevenue(ctx: Ctx) {
  const t = totals(ctx.rows); const p = totals(ctx.previousRows);
  const branches = groupByBranch(ctx.rows, ctx.previousRows);
  const trendData = makeTrendCompare(ctx);
  const channels = withShare(groupByChannel(ctx.rows), 'revenue');
  const shiftRows = groupShiftByBranch(ctx);
  const kpis = [
    makeKpi('revenue', 'Doanh thu thuần', t.revenue, p.revenue, 'money', compactStatus(pctChange(t.revenue, p.revenue))),
    makeKpi('growth', 'Tăng trưởng doanh thu %', pctChange(t.revenue, p.revenue), 0, 'pct', pctChange(t.revenue, p.revenue) >= 0 ? 'good' : 'danger'),
    makeKpi('portions', 'Tổng phần', t.portions || t.orders, p.portions || p.orders, 'count', compactStatus(pctChange(t.portions || t.orders, p.portions || p.orders))),
    makeKpi('aov', 'AOV', t.aov, p.aov, 'money', compactStatus(pctChange(t.aov, p.aov))),
    makeKpi('avgStore', 'Doanh thu TB/cửa hàng', safeDiv(t.revenue, Math.max(branches.length, 1)), 0, 'money'),
    { id: 'targetRate', title: '% đạt mục tiêu doanh thu', value: ctx.targets.revenue ? fmtPct(safeDiv(t.revenue, ctx.targets.revenue) * 100) : '—', status: (ctx.targets.revenue ? (t.revenue >= ctx.targets.revenue ? 'good' : 'warning') : 'neutral') as Status }
  ];
  const widgets: DashboardWidget[] = [
    trendData.length ? { id: 'revenuePortionAovTrend', title: 'Tổng phần + doanh thu + AOV', type: 'combo', className: 'span-5 row-2', data: addPortionVisualScale(trendData), datasets: [{ name: 'Doanh thu', dataKey: 'revenue', type: 'bar', role: 'primary' }, { name: 'Tổng phần', dataKey: 'portionsScaled', type: 'bar', role: 'success' }, { name: 'AOV', dataKey: 'aov', type: 'line', axis: 'right', role: 'warning' }] } : emptyWidget('revenuePortionAovTrend', 'Tổng phần + doanh thu + AOV'),
    branches.length ? { id: 'revenueBranchGrowth', title: 'Doanh thu theo chi nhánh kỳ này vs kỳ trước', type: 'bar', className: 'span-4 row-2', data: topRows(branches, 10), datasets: [{ name: 'Kỳ này', dataKey: 'revenue', role: 'primary' }, { name: 'Kỳ trước', dataKey: 'previousRevenue', role: 'muted' }] } : emptyWidget('revenueBranchGrowth', 'Doanh thu theo chi nhánh'),
    shiftRows.some((x) => x.morning || x.evening) ? { id: 'revenueShift', title: 'Doanh thu theo ca sáng/tối', type: 'bar', className: 'span-3 row-2', data: topRows(shiftRows, 8), datasets: [{ name: 'Sáng', dataKey: 'morning', role: 'primary' }, { name: 'Tối', dataKey: 'evening', role: 'success' }] } : emptyWidget('revenueShift', 'Doanh thu theo ca sáng/tối', 'Chưa có dữ liệu ca Sáng/Tối trong bộ lọc này.'),
    channels.length ? { id: 'revenueChannel', title: 'Doanh thu theo kênh bán', type: 'bar', className: 'span-4 row-3', data: channels, datasets: [{ name: 'Doanh thu', dataKey: 'revenue', role: 'primary' }] } : emptyWidget('revenueChannel', 'Doanh thu theo kênh'),
    channels.length ? { id: 'revenueChannelPie', title: 'Cơ cấu doanh thu theo kênh', type: 'pie', className: 'span-3 row-3', data: channels.map((c) => ({ name: c.name, value: c.revenue })) } : emptyWidget('revenueChannelPie', 'Cơ cấu doanh thu theo kênh'),
    { id: 'revenueGrowthTable', title: 'Bảng tăng trưởng doanh thu theo chi nhánh', type: 'table', className: 'span-5 row-3', data: branches.map((b) => ({ branch: b.branch, current: fmtMoney(b.revenue), previous: fmtMoney(b.previousRevenue), diff: fmtMoney(b.variance), growth: fmtPct(b.growthPct), status: b.growthPct < -10 ? 'danger' : b.growthPct < 0 ? 'warning' : 'good' })), columns: [{ key: 'branch', label: 'Chi nhánh' }, { key: 'current', label: 'Kỳ này', align: 'right' }, { key: 'previous', label: 'Kỳ trước', align: 'right' }, { key: 'diff', label: 'Chênh lệch', align: 'right' }, { key: 'growth', label: '%', align: 'right' }] }
  ];
  return { kpis, widgets };
}

function buildPnl(ctx: Ctx) {
  const t = totals(ctx.rows, ctx.costs); const p = totals(ctx.previousRows, ctx.previousCosts);
  const trend = groupSalesByTime(ctx.rows, ctx.groupMode);
  const branches = groupByBranch(ctx.rows, ctx.previousRows);
  const costGroups = groupCostsByGroup(ctx.costs, ctx.previousCosts);
  const kpis = [makeKpi('grossProfit','Lợi nhuận gộp',t.grossProfit,p.grossProfit,'money',t.grossProfit>=0?'good':'danger'),makeKpi('operatingProfit','Lợi nhuận vận hành',t.operatingProfit,p.operatingProfit,'money',t.operatingProfit>=0?'good':'danger'),makeKpi('netProfit','Lợi nhuận ròng',t.netProfit,p.netProfit,'money',t.netProfit>=0?'good':'danger'),makeKpi('grossMargin','Gross Margin %',t.grossMargin,p.grossMargin,'pct',statusForPct(t.grossMargin,35,20,true)),makeKpi('netMargin','Net Margin %',t.netMargin,p.netMargin,'pct',statusForPct(t.netMargin,15,8,true)),makeKpi('ebitda','EBITDA',t.operatingProfit,p.operatingProfit,'money',t.operatingProfit>=0?'good':'danger')];
  const widgets: DashboardWidget[] = [
    trend.length?{id:'pnlProfitTrend',title:'Xu hướng lợi nhuận',type:'line',className:'span-5 row-2',data:trend,datasets:[{name:'Lợi nhuận',dataKey:'profit',role:'success'}]}:emptyWidget('pnlProfitTrend','Xu hướng lợi nhuận'),
    trend.length?{id:'pnlRevMargin',title:'Doanh thu + Net Margin %',type:'combo',className:'span-4 row-2',data:trend,datasets:[{name:'Doanh thu',dataKey:'revenue',type:'bar',role:'primary'},{name:'Net Margin %',dataKey:'margin',type:'line',axis:'right',role:'warning'}]}:emptyWidget('pnlRevMargin','Doanh thu + Net Margin %'),
    branches.length?{id:'pnlProfitBranch',title:'Lợi nhuận theo chi nhánh',type:'bar',className:'span-3 row-2',data:branches,datasets:[{name:'Lợi nhuận',dataKey:'profit',role:'success'}]}:emptyWidget('pnlProfitBranch','Lợi nhuận theo chi nhánh'),
    branches.length?{id:'pnlMarginBranch',title:'Biên lợi nhuận theo chi nhánh',type:'bar',className:'span-3 row-3',data:branches,datasets:[{name:'Margin %',dataKey:'margin',role:'warning'}]}:emptyWidget('pnlMarginBranch','Biên lợi nhuận theo chi nhánh'),
    costGroups.length?{id:'pnlCostPie',title:'Cơ cấu chi phí trong P&L',type:'pie',className:'span-3 row-3',data:costGroups.map(g=>({name:g.name,value:g.amount}))}:emptyWidget('pnlCostPie','Cơ cấu chi phí'),
    {id:'pnlTable',title:'P&L theo chi nhánh',type:'table',className:'span-6 row-3',data:branches.map(b=>({branch:b.branch,revenue:fmtMoney(b.revenue),profit:fmtMoney(b.profit),margin:fmtPct(b.margin),growth:fmtPct(b.growthPct),status:b.margin<10?'danger':b.margin<15?'warning':'good'})),columns:[{key:'branch',label:'Chi nhánh'},{key:'revenue',label:'Doanh thu',align:'right'},{key:'profit',label:'LN',align:'right'},{key:'margin',label:'Margin',align:'right'},{key:'growth',label:'Tăng trưởng',align:'right'}]}
  ];
  return {kpis,widgets};
}

function buildCost(ctx: Ctx) {
  const t = totals(ctx.rows, ctx.costs); const p = totals(ctx.previousRows, ctx.previousCosts);
  const byBranch = groupCostsByBranch(ctx.costs);
  const byGroup = groupCostsByGroup(ctx.costs, ctx.previousCosts);
  const byMonth = groupCostsByMonth(ctx.costs, ctx.rows);
  const topGroup = byGroup[0];
  const kpis = [
    makeKpi('costTotal','Tổng chi phí',t.costTotal,p.costTotal,'money',pctChange(t.costTotal,p.costTotal)>20?'danger':pctChange(t.costTotal,p.costTotal)>5?'warning':'neutral'),
    makeKpi('costRatio','Chi phí / Doanh thu %',safeDiv(t.costTotal,t.revenue)*100,safeDiv(p.costTotal,p.revenue)*100,'pct',statusForPct(safeDiv(t.costTotal,t.revenue)*100,25,35)),
    makeKpi('labor','Chi phí nhân sự',t.labor,p.labor,'money',statusForPct(t.laborCostPct,20,25)),
    makeKpi('operating','Chi phí vận hành khác',Math.max(t.costTotal-t.labor,0),Math.max(p.costTotal-p.labor,0),'money'),
    {id:'topGroup',title:'Nhóm chi phí lớn nhất',value:topGroup?topGroup.name:'—',delta:topGroup?`${fmtMoney(topGroup.amount)} · ${fmtPct(topGroup.share)}`:'—',status:topGroup&&topGroup.share>35?'warning':'neutral'},
    makeKpi('avgCostStore','Chi phí TB/cửa hàng',safeDiv(t.costTotal,Math.max(groupByBranch(ctx.rows).length,1)),0,'money')
  ];
  const widgets: DashboardWidget[] = [
    byMonth.length?{id:'costTrend',title:'Xu hướng tổng chi phí theo tháng',type:'line',className:'span-5 row-2',data:byMonth,datasets:[{name:'Chi phí',dataKey:'cost',role:'primary'}]}:emptyWidget('costTrend','Xu hướng tổng chi phí'),
    byBranch.length?{id:'costBranch',title:'Chi phí theo chi nhánh',type:'bar',className:'span-4 row-2',data:byBranch,datasets:[{name:'Chi phí',dataKey:'amount',role:'primary'}]}:emptyWidget('costBranch','Chi phí theo chi nhánh','Chưa có dữ liệu chi phí theo chi nhánh trong bộ lọc.'),
    byGroup.length?{id:'costGroup',title:'Chi phí theo nhóm',subtitle:'Hiện tiền + tỷ trọng %',type:'table',className:'span-3 row-2',data:byGroup.slice(0,8).map(g=>({group:g.name,amount:fmtMoney(g.amount),share:fmtPct(g.share),growth:fmtPct(g.growthPct),status:g.share>30?'warning':g.growthPct>20?'danger':'neutral'})),columns:[{key:'group',label:'Nhóm'},{key:'amount',label:'Tiền',align:'right'},{key:'share',label:'%' ,align:'right'}]}:emptyWidget('costGroup','Chi phí theo nhóm'),
    byMonth.length?{id:'costRatio',title:'Chi phí / Doanh thu % theo tháng',type:'combo',className:'span-4 row-3',data:byMonth,datasets:[{name:'Chi phí',dataKey:'cost',type:'bar',role:'primary'},{name:'Chi phí/DT %',dataKey:'ratio',type:'line',axis:'right',role:'warning'}]}:emptyWidget('costRatio','Chi phí / Doanh thu %'),
    byGroup.length?{id:'costPie',title:'Cơ cấu chi phí',type:'pie',className:'span-3 row-3',data:byGroup.map(g=>({name:g.name,value:g.amount}))}:emptyWidget('costPie','Cơ cấu chi phí'),
    {id:'costAbnormal',title:'Bảng chi phí bất thường',type:'table',className:'span-5 row-3',data:byGroup.filter(g=>g.growthPct>20||g.share>25).map(g=>({group:g.name,amount:fmtMoney(g.amount),share:fmtPct(g.share),growth:fmtPct(g.growthPct),status:g.growthPct>50?'danger':'warning'})),columns:[{key:'group',label:'Khoản mục'},{key:'amount',label:'Số tiền',align:'right'},{key:'share',label:'Tỷ trọng',align:'right'},{key:'growth',label:'Tăng/giảm',align:'right'}]}
  ];
  return { kpis, widgets };
}

function buildChannel(ctx: Ctx) {
  const channels = withShare(groupByChannel(ctx.rows), 'revenue');
  const prevChannels = withShare(groupByChannel(ctx.previousRows), 'revenue');
  const prevMap = new Map(prevChannels.map(c => [c.name, c.revenue]));
  const t = totals(ctx.rows); const p = totals(ctx.previousRows);
  const appNames = ['Grab','Shopee','Be','Xanh ngon'];
  const appRevenue = channels.filter(c=>appNames.includes(c.name)).reduce((s,c)=>s+c.revenue,0);
  const offlineRevenue = channels.filter(c=>['Tiền mặt','Chuyển khoản','Takeaway'].includes(c.name)).reduce((s,c)=>s+c.revenue,0);
  const channelEfficiency = channels.map(c=>({
    ...c,
    portions: Math.round(c.portions || c.orders || 0),
    dishes: Math.round(c.dishes || 0),
    boxes: Math.round(c.boxes || 0),
    orders: Math.round(c.orders || 0),
    aov: safeDiv(c.revenue, c.portions || c.orders),
    share: c.share,
    previousRevenue: prevMap.get(c.name) || 0,
    variance: c.revenue - (prevMap.get(c.name) || 0),
    growthPct: pctChange(c.revenue, prevMap.get(c.name) || 0)
  })).sort((a,b)=>b.revenue-a.revenue);
  const topGrowth = channelEfficiency.filter(c=>c.previousRevenue || c.revenue).sort((a,b)=>b.growthPct-a.growthPct)[0];
  const channelDatasets = channelEfficiency.map((c, i) => ({ name: c.name, dataKey: toDataKey(c.name), type: 'line' as const, role: (['primary','success','warning','danger','muted'][i % 5] as any) }));
  const channelTrend = channelRevenueByTime(ctx, channelEfficiency);
  const channelMix = channelMixStackedByTime(ctx, channelEfficiency);
  const portionTrend = addPortionVisualScale(channelPortionRevenueAovByTime(ctx));
  const kpis = [
    {id:'offlineRevenue',title:'Doanh thu Offline',value:fmtMoney(offlineRevenue),status:'neutral' as const},
    {id:'appRevenue',title:'Doanh thu Appfood',value:fmtMoney(appRevenue),status:(safeDiv(appRevenue,t.revenue)>0.55?'warning':'neutral') as Status},
    {id:'appShare',title:'Tỷ trọng Appfood %',value:fmtPct(safeDiv(appRevenue,t.revenue)*100),status:(safeDiv(appRevenue,t.revenue)>0.55?'warning':'neutral') as Status},
    makeKpi('channelPortions','Tổng phần theo kênh',channelEfficiency.reduce((s,c)=>s + Number(c.portions || 0),0),prevChannels.reduce((s,c:any)=>s + Number(c.portions || c.orders || 0),0),'count'),
    makeKpi('channelAov','AOV theo kênh',safeDiv(t.revenue, channelEfficiency.reduce((s,c)=>s + Number(c.portions || c.orders || 0),0)),safeDiv(p.revenue, prevChannels.reduce((s,c:any)=>s + Number(c.portions || c.orders || 0),0)),'money'),
    {id:'topGrowthChannel',title:'Kênh tăng trưởng tốt nhất',value:topGrowth?.name||'—',delta:topGrowth?fmtPct(topGrowth.growthPct):'—',status:(topGrowth && topGrowth.growthPct>=0?'good':'warning') as Status}
  ];
  const widgets: DashboardWidget[] = [
    channelTrend.length?{id:'channelRevenueTrend',title:'Doanh thu theo kênh',type:'line',className:'span-5 row-2',data:channelTrend,datasets:channelDatasets}:emptyWidget('channelRevenueTrend','Doanh thu theo kênh'),
    channelMix.length?{id:'channelMixStacked',title:'Cơ cấu kênh bán theo thời gian',type:'stackedBar',className:'span-4 row-2',data:channelMix,datasets:channelDatasets.map(ds=>({...ds,type:'bar' as const}))}:emptyWidget('channelMixStacked','Cơ cấu kênh bán theo thời gian'),
    channelEfficiency.length?{id:'channelNetRevenue',title:'Doanh thu thuần theo kênh',type:'bar',className:'span-3 row-2',data:channelEfficiency,datasets:[{name:'Doanh thu thuần',dataKey:'revenue',role:'primary'}]}:emptyWidget('channelNetRevenue','Doanh thu thuần theo kênh'),
    portionTrend.length?{id:'channelPortionRevenueAov',title:'Tổng phần + doanh thu + AOV',type:'combo',className:'span-4 row-3',data:portionTrend,datasets:[{name:'Doanh thu',dataKey:'revenue',type:'bar',role:'primary'},{name:'Tổng phần',dataKey:'portionsScaled',type:'bar',role:'success'},{name:'AOV',dataKey:'aov',type:'line',axis:'right',role:'warning'}]}:emptyWidget('channelPortionRevenueAov','Tổng phần + doanh thu + AOV'),
    channelEfficiency.length?{id:'channelGrowth',title:'Tăng trưởng doanh thu theo kênh',type:'bar',className:'span-3 row-3',data:channelEfficiency,datasets:[{name:'Kỳ này',dataKey:'revenue',role:'primary'},{name:'Kỳ trước',dataKey:'previousRevenue',role:'muted'}]}:emptyWidget('channelGrowth','Tăng trưởng doanh thu theo kênh'),
    {id:'channelTable',title:'Bảng hiệu quả kênh bán',type:'table',className:'span-5 row-3',data:channelEfficiency.map(c=>({channel:c.name,revenue:fmtMoney(c.revenue),portions:fmtCount(c.portions),dishes:fmtCount(c.dishes),boxes:fmtCount(c.boxes),aov:fmtMoney(c.aov),share:fmtPct(c.share),growth:fmtPct(c.growthPct),status:c.growthPct<-10?'danger':c.growthPct<0?'warning':'neutral'})),columns:[{key:'channel',label:'Kênh'},{key:'revenue',label:'Doanh thu',align:'right'},{key:'portions',label:'Tổng phần',align:'right'},{key:'dishes',label:'Dĩa',align:'right'},{key:'boxes',label:'Hộp',align:'right'},{key:'aov',label:'AOV',align:'right'},{key:'share',label:'Tỷ trọng',align:'right'},{key:'growth',label:'Tăng trưởng',align:'right'}]}
  ];
  return {kpis,widgets};
}

function buildMenu(ctx: Ctx) {
  const rows = normalizeMenu(ctx);
  const kpis = buildMenuKpis(rows);
  if (!rows.length) return { kpis, widgets: [emptyWidget('menuMissing','Nguồn dữ liệu Menu','Bổ sung sheet MENU_SALES_DAILY để có Top món, margin món, combo/add-on và bảng món cần xử lý.')] };
  const topQty = [...rows].sort((a,b)=>b.qty-a.qty).slice(0,10);
  const topRevenue = [...rows].sort((a,b)=>b.revenue-a.revenue).slice(0,10);
  const byGroup = withShare(groupRows(rows, r=>r.group, r=>r.revenue), 'value').map(x=>({name:x.name,value:x.value,share:x.share}));
  const combo = rows.filter(r=>/combo|add|thêm|addon|add-on/i.test(`${r.group} ${r.item}`));
  const comboRows = groupRows(combo.length?combo:rows, r=>r.group || 'Nhóm món', r=>r.revenue).map(x=>({name:x.name,revenue:x.value,qty:sum((combo.length?combo:rows).filter(r=>(r.group||'Nhóm món')===x.name),r=>r.qty)}));
  const issueRows = rows.filter(r=>r.marginPct<20 || r.growthPct<0).sort((a,b)=>a.marginPct-b.marginPct).slice(0,12);
  const widgets: DashboardWidget[] = [
    {id:'menuTopQty',title:'Top món bán chạy',type:'bar',className:'span-5 row-2',data:topQty,datasets:[{name:'Số lượng',dataKey:'qty',role:'primary'}]},
    {id:'menuTopRevenue',title:'Top món theo doanh thu/lợi nhuận',type:'bar',className:'span-4 row-2',data:topRevenue,datasets:[{name:'Doanh thu',dataKey:'revenue',role:'primary'},{name:'Lợi nhuận',dataKey:'profit',role:'success'}]},
    {id:'menuMarginCombo',title:'Sản lượng + margin món',type:'combo',className:'span-3 row-2',data:topQty.slice(0,8),datasets:[{name:'Số lượng',dataKey:'qty',type:'bar',role:'primary'},{name:'Margin %',dataKey:'marginPct',type:'line',axis:'right',role:'warning'}]},
    byGroup.length?{id:'menuGroupPie',title:'Cơ cấu doanh thu nhóm món',type:'pie',className:'span-3 row-3',data:byGroup.map(g=>({name:g.name,value:g.value}))}:emptyWidget('menuGroupPie','Cơ cấu doanh thu nhóm món'),
    {id:'menuCombo',title:'Hiệu quả combo/add-on',type:'bar',className:'span-4 row-3',data:comboRows,datasets:[{name:'Doanh thu',dataKey:'revenue',role:'primary'},{name:'Số lượng',dataKey:'qty',role:'success'}]},
    {id:'menuIssueTable',title:'Bảng món cần xử lý',type:'table',className:'span-5 row-3',data:issueRows.map(r=>({item:r.item,qty:fmtCount(r.qty),revenue:fmtMoney(r.revenue),margin:fmtPct(r.marginPct),growth:fmtPct(r.growthPct),status:r.marginPct<15?'danger':r.growthPct<0?'warning':'neutral'})),columns:[{key:'item',label:'Món'},{key:'qty',label:'SL',align:'right'},{key:'revenue',label:'DT',align:'right'},{key:'margin',label:'Margin',align:'right'},{key:'growth',label:'Tăng/giảm',align:'right'}]}
  ];
  return {kpis, widgets};
}

function buildOperations(ctx: Ctx) {
  const audits = normalizeAudit(ctx); const incidents = normalizeIncidents(ctx); const checklist = normalizeChecklist(ctx);
  const avgAudit = safeDiv(sum(audits,r=>r.score), audits.filter(r=>r.score).length);
  const severe = incidents.filter(i=>i.severity === 'Cao' || i.severity === 'Nghiêm trọng').length;
  const kpis = [
    {id:'auditScore',title:'Điểm audit TB',value:avgAudit?avgAudit.toFixed(1):'—',status:(avgAudit>=90?'good':avgAudit>=80?'warning':avgAudit?'danger':'neutral') as Status},
    {id:'incidents',title:'Số lỗi vận hành',value:fmtCount(incidents.length),status:(incidents.length?'warning':'good') as Status},
    {id:'severe',title:'Lỗi nghiêm trọng',value:fmtCount(severe),status:(severe?'danger':'good') as Status},
    {id:'checklist',title:'Checklist hoàn tất',value:checklist.length?fmtPct(safeDiv(checklist.filter(x=>x.status==='Đạt').length,checklist.length)*100):'—',status:'neutral'}
  ];
  if (!audits.length && !incidents.length && !checklist.length) return {kpis, widgets:[emptyWidget('opsMissing','Nguồn dữ liệu vận hành','Bổ sung OPS_AUDIT_SOP, OPS_INCIDENT_LOG, OPS_SHIFT_CHECKLIST để phân tích SOP, lỗi và cảnh báo vận hành.')]};
  const scoreTrend = groupByKey(audits, r=>r.dateKey || r.monthKey, r=>r.score).map(x=>({label:x.name,score:x.avg}));
  const scoreBranch = groupByKey(audits, r=>r.branch, r=>r.score).map(x=>({branch:x.name,score:x.avg})).sort((a,b)=>b.score-a.score);
  const issueType = groupRows(incidents, r=>r.type, () => 1).map(x=>({name:x.name,count:x.value})).sort((a,b)=>b.count-a.count);
  const shiftIssue = groupShiftIncident(incidents);
  const widgets: DashboardWidget[] = [
    scoreTrend.length?{id:'opsAuditTrend',title:'Xu hướng điểm audit',type:'line',className:'span-5 row-2',data:scoreTrend,datasets:[{name:'Điểm audit',dataKey:'score',role:'success'}]}:emptyWidget('opsAuditTrend','Xu hướng điểm audit'),
    scoreBranch.length?{id:'opsAuditBranch',title:'Điểm audit theo chi nhánh',type:'bar',className:'span-4 row-2',data:scoreBranch,datasets:[{name:'Điểm',dataKey:'score',role:'primary'}]}:emptyWidget('opsAuditBranch','Điểm audit theo chi nhánh'),
    issueType.length?{id:'opsIssueType',title:'Lỗi theo loại',type:'bar',className:'span-3 row-2',data:issueType,datasets:[{name:'Số lỗi',dataKey:'count',role:'danger'}]}:emptyWidget('opsIssueType','Lỗi theo loại'),
    shiftIssue.length?{id:'opsIssueShift',title:'Lỗi theo ca sáng/tối',type:'bar',className:'span-4 row-3',data:shiftIssue,datasets:[{name:'Sáng',dataKey:'morning',role:'warning'},{name:'Tối',dataKey:'evening',role:'danger'}]}:emptyWidget('opsIssueShift','Lỗi theo ca'),
    issueType.length?{id:'opsIssueRate',title:'Số lỗi + tỷ lệ lỗi/1.000 phần',type:'combo',className:'span-3 row-3',data:issueType.map(x=>({...x,rate:safeDiv(x.count,totals(ctx.rows).portions || totals(ctx.rows).orders)*1000})),datasets:[{name:'Số lỗi',dataKey:'count',type:'bar',role:'danger'},{name:'Lỗi/1.000 phần',dataKey:'rate',type:'line',axis:'right',role:'warning'}]}:emptyWidget('opsIssueRate','Số lỗi + tỷ lệ lỗi'),
    {id:'opsAlertTable',title:'Bảng cảnh báo vận hành',type:'table',className:'span-5 row-3',data:incidents.slice(0,12).map(i=>({branch:i.branch,type:i.type,shift:i.shift,severity:i.severity,action:i.action,status:i.severity==='Cao'||i.severity==='Nghiêm trọng'?'danger':'warning'})),columns:[{key:'branch',label:'Chi nhánh'},{key:'type',label:'Lỗi'},{key:'shift',label:'Ca'},{key:'severity',label:'Mức'},{key:'action',label:'Hành động'}]}
  ];
  return {kpis, widgets};
}

function buildPeople(ctx: Ctx) {
  const times = normalizeTimesheet(ctx); const t=totals(ctx.rows,ctx.costs); const p=totals(ctx.previousRows,ctx.previousCosts);
  const hours = sum(times,r=>r.hours); const late = sum(times,r=>r.late); const absent = sum(times,r=>r.absent);
  const kpis=[makeKpi('labor','Chi phí lương',t.labor,p.labor,'money',statusForPct(t.laborCostPct,20,25)),makeKpi('laborPct','Labor Cost %',t.laborCostPct,p.laborCostPct,'pct',statusForPct(t.laborCostPct,20,25)),{id:'hours',title:'Tổng giờ công',value:hours?fmtCount(hours):'—',status:'neutral' as const},{id:'revHour',title:'Doanh thu/giờ công',value:hours?fmtMoney(safeDiv(t.revenue,hours)):'—',status:'neutral' as const},{id:'late',title:'Đi trễ',value:fmtCount(late),status:(late?'warning':'good') as Status},{id:'absent',title:'Nghỉ đột xuất',value:fmtCount(absent),status:(absent?'danger':'good') as Status}];
  const laborByMonth = groupCostsByMonth(ctx.costs,ctx.rows);
  const revHourBranch = groupRevPerHour(ctx, times);
  const hoursShift = groupHoursShift(times);
  const discipline = groupDiscipline(times);
  const widgets: DashboardWidget[] = [
    laborByMonth.length?{id:'peopleLaborCombo',title:'Chi phí lương + Labor Cost %',type:'combo',className:'span-5 row-2',data:laborByMonth,datasets:[{name:'Lương',dataKey:'cost',type:'bar',role:'primary'},{name:'Labor %',dataKey:'ratio',type:'line',axis:'right',role:'warning'}]}:emptyWidget('peopleLaborCombo','Chi phí lương + Labor Cost %'),
    revHourBranch.length?{id:'peopleRevHour',title:'Doanh thu/giờ công',type:'bar',className:'span-4 row-2',data:revHourBranch,datasets:[{name:'DT/giờ',dataKey:'revPerHour',role:'success'}]}:emptyWidget('peopleRevHour','Doanh thu/giờ công','Bổ sung HR_TIMESHEET_DAILY để tính doanh thu/giờ công.'),
    hoursShift.length?{id:'peopleHoursShift',title:'Giờ công theo ca',type:'bar',className:'span-3 row-2',data:hoursShift,datasets:[{name:'Sáng',dataKey:'morning',role:'primary'},{name:'Tối',dataKey:'evening',role:'success'}]}:emptyWidget('peopleHoursShift','Giờ công theo ca'),
    discipline.length?{id:'peopleDiscipline',title:'Đi trễ/nghỉ đột xuất',type:'bar',className:'span-4 row-3',data:discipline,datasets:[{name:'Đi trễ',dataKey:'late',role:'warning'},{name:'Nghỉ',dataKey:'absent',role:'danger'}]}:emptyWidget('peopleDiscipline','Đi trễ/nghỉ đột xuất'),
    {id:'peopleTable',title:'Bảng nhân sự cần xử lý',type:'table',className:'span-8 row-3',data:times.filter(r=>r.late||r.absent||r.score<70).slice(0,12).map(r=>({employee:r.employee,branch:r.branch,hours:fmtCount(r.hours),late:fmtCount(r.late),absent:fmtCount(r.absent),score:r.score?fmtPct(r.score):'—',status:r.absent?'danger':r.late?'warning':'neutral'})),columns:[{key:'employee',label:'Nhân sự'},{key:'branch',label:'CN'},{key:'hours',label:'Giờ',align:'right'},{key:'late',label:'Trễ',align:'right'},{key:'absent',label:'Nghỉ',align:'right'},{key:'score',label:'Hiệu suất',align:'right'}]}
  ];
  return {kpis,widgets};
}

function buildStock(ctx: Ctx) {
  const stock = normalizeStock(ctx); const t=totals(ctx.rows,ctx.costs); const p=totals(ctx.previousRows,ctx.previousCosts);
  const foodByBranch = groupByBranch(ctx.rows,ctx.previousRows).map(b=>({branch:b.branch,foodCostPct:safeDiv(b.cogs,b.revenue)*100,previousFoodCostPct:0}));
  const wasteByMaterial = groupRows(stock, r=>r.material, r=>Math.abs(r.diffValue||r.wasteValue||r.diffQty)).map(x=>({name:x.name,value:x.value})).sort((a,b)=>b.value-a.value);
  const wasteByBranch = groupRows(stock, r=>r.branch, r=>Math.abs(r.diffValue||r.wasteValue||r.diffQty)).map(x=>({branch:x.name,value:x.value})).sort((a,b)=>b.value-a.value);
  const kpis=[makeKpi('foodCost','Food Cost %',t.foodCostPct,p.foodCostPct,'pct',statusForPct(t.foodCostPct,35,42)),{id:'stockRows',title:'Dòng tồn kho',value:fmtCount(stock.length),status:'neutral' as const},{id:'diffValue',title:'Giá trị lệch tồn',value:fmtMoney(sum(stock,r=>Math.abs(r.diffValue))),status:sum(stock,r=>Math.abs(r.diffValue))?'warning':'good'},{id:'wasteValue',title:'Hao hụt/hủy hỏng',value:fmtMoney(sum(stock,r=>Math.abs(r.wasteValue))),status:sum(stock,r=>Math.abs(r.wasteValue))?'warning':'good'}];
  const widgets: DashboardWidget[] = [
    foodByBranch.length?{id:'stockFoodCost',title:'Food Cost theo chi nhánh',type:'bar',className:'span-5 row-2',data:foodByBranch,datasets:[{name:'Food Cost %',dataKey:'foodCostPct',role:'warning'}]}:emptyWidget('stockFoodCost','Food Cost theo chi nhánh'),
    wasteByMaterial.length?{id:'stockWasteMaterial',title:'Hao hụt theo nguyên vật liệu',type:'bar',className:'span-4 row-2',data:wasteByMaterial.slice(0,10),datasets:[{name:'Giá trị/SL lệch',dataKey:'value',role:'danger'}]}:emptyWidget('stockWasteMaterial','Hao hụt theo nguyên vật liệu','Bổ sung cột NVL, lệch/hư hỏng trong TON_KHO.'),
    wasteByBranch.length?{id:'stockWasteBranch',title:'Hao hụt theo chi nhánh',type:'bar',className:'span-3 row-2',data:wasteByBranch,datasets:[{name:'Hao hụt',dataKey:'value',role:'danger'}]}:emptyWidget('stockWasteBranch','Hao hụt theo chi nhánh'),
    {id:'stockDiffTable',title:'Bảng lệch tồn kho',type:'table',className:'span-6 row-3',data:stock.slice(0,15).map(r=>({material:r.material,branch:r.branch,theory:fmtCount(r.theory),actual:fmtCount(r.actual),diff:fmtCount(r.diffQty),value:fmtMoney(r.diffValue),status:Math.abs(r.diffValue)>0?'warning':'good'})),columns:[{key:'material',label:'NVL'},{key:'branch',label:'CN'},{key:'theory',label:'LT',align:'right'},{key:'actual',label:'TT',align:'right'},{key:'diff',label:'Lệch',align:'right'},{key:'value',label:'Giá trị',align:'right'}]},
    {id:'stockAlerts',title:'Cảnh báo tồn kho / hao hụt',type:'alertTable',className:'span-6 row-3',data:stock.filter(r=>Math.abs(r.diffQty)>0 || Math.abs(r.diffValue)>0 || Math.abs(r.wasteValue)>0).slice(0,10).map(r=>({level:Math.abs(r.diffValue)>500000?'Cao':'TB',branch:r.branch,issue:`${r.material}: lệch ${fmtCount(r.diffQty)}`,action:'Kiểm kê lại / soát xuất nhập',status:Math.abs(r.diffValue)>500000?'danger':'warning'})),columns:[{key:'level',label:'Mức'},{key:'branch',label:'CN'},{key:'issue',label:'Vấn đề'},{key:'action',label:'Hành động'}]}
  ];
  return {kpis,widgets};
}

function buildCustomer(ctx: Ctx) {
  const ratingAvg = safeDiv(sum(ctx.feedback,r=>r.rating), ctx.feedback.filter(r=>r.rating).length);
  const totalFeedback = ctx.feedback.length;
  const negativeRows = ctx.feedback.filter(r => (r.rating && r.rating < 4) || /xấu|tiêu cực|bad|negative/i.test(r.sentiment));
  const unresolved = ctx.feedback.filter(r => !/đã|done|closed|xong|phản hồi/i.test(r.status));
  const responseRows = ctx.feedback.filter(r => r.responseTimeHours);
  const avgResponse = safeDiv(sum(responseRows, r=>r.responseTimeHours), responseRows.length);
  const slaRows = ctx.feedback.filter(r => r.responseTimeHours || r.status);
  const slaRate = safeDiv(slaRows.filter(r=>r.slaOk).length, slaRows.length) * 100;
  const byIssue = groupRows(ctx.feedback, r=>r.issue, () => 1).map(x=>({name:x.name,count:x.value})).sort((a,b)=>b.count-a.count);
  const ratingTrend = groupFeedbackTrend(ctx);
  const complaintTrend = ratingTrend.map(x=>({label:x.label,feedback:x.count,rating:x.rating}));
  const channelReview = groupFeedbackChannel(ctx.feedback);
  const branchCsat = groupFeedbackBranchCompare(ctx.feedback, ctx.previousFeedback);
  const patternRows = groupFeedbackBranchShift(ctx.feedback);
  const slaTrend = groupFeedbackSlaTrend(ctx.feedback);
  const severeRows = ctx.feedback.filter(r => r.rating < 4 || /cao|nghiêm|nghiem|critical|high/i.test(r.severity) || !r.slaOk || !/đã|done|closed|xong|phản hồi/i.test(r.status)).slice(0, 14);
  const kpis = [
    {id:'rating',title:'Rating trung bình',value:ratingAvg?ratingAvg.toFixed(1):'—',status:(ratingAvg>=4.5?'good':ratingAvg>=4?'warning':ratingAvg?'danger':'neutral') as Status},
    {id:'feedback',title:'Tổng số đánh giá',value:fmtCount(totalFeedback),status:'neutral' as const},
    {id:'negativePct',title:'% đánh giá tiêu cực',value:fmtPct(safeDiv(negativeRows.length,totalFeedback)*100),status:(safeDiv(negativeRows.length,totalFeedback)>0.12?'danger':safeDiv(negativeRows.length,totalFeedback)>0.06?'warning':'good') as Status},
    {id:'unresolved',title:'Phản ánh chưa xử lý',value:fmtCount(unresolved.length),status:(unresolved.length?'danger':'good') as Status},
    {id:'responseRate',title:'Tỷ lệ phản hồi KH',value:fmtPct(safeDiv(ctx.feedback.length-unresolved.length,totalFeedback)*100),status:(safeDiv(ctx.feedback.length-unresolved.length,totalFeedback)>=0.9?'good':'warning') as Status},
    {id:'frt',title:'Thời gian phản hồi TB',value:avgResponse?`${avgResponse.toFixed(1).replace('.', ',')}h`:'—',status:(avgResponse&&avgResponse>24?'danger':avgResponse&&avgResponse>12?'warning':'neutral') as Status},
    {id:'sla',title:'Tỷ lệ xử lý đúng SLA',value:slaRows.length?fmtPct(slaRate):'—',status:(slaRate>=90?'good':slaRate>=75?'warning':slaRows.length?'danger':'neutral') as Status}
  ];
  const widgets: DashboardWidget[] = [
    complaintTrend.length?{id:'customerRatingTrend',title:'Rating + số đánh giá theo thời gian',subtitle:'Cột số đánh giá, line rating',type:'combo',className:'span-5 row-2',data:complaintTrend,datasets:[{name:'Số đánh giá',dataKey:'feedback',type:'bar',role:'primary'},{name:'Rating',dataKey:'rating',type:'line',axis:'right',role:'success'}]}:emptyWidget('customerRatingTrend','Rating + số đánh giá theo thời gian'),
    channelReview.length?{id:'customerChannelRating',title:'Đánh giá theo kênh',subtitle:'Cột số đánh giá, line rating theo kênh',type:'combo',className:'span-4 row-2',data:channelReview,datasets:[{name:'Số đánh giá',dataKey:'count',type:'bar',role:'primary'},{name:'Rating',dataKey:'rating',type:'line',axis:'right',role:'success'}]}:emptyWidget('customerChannelRating','Đánh giá theo kênh'),
    branchCsat.length?{id:'customerBranchCsat',title:'Ranking chi nhánh theo CSAT',subtitle:'Kỳ này vs kỳ trước',type:'bar',className:'span-3 row-2',data:branchCsat,datasets:[{name:'Kỳ này',dataKey:'rating',role:'success'},{name:'Kỳ trước',dataKey:'previousRating',role:'muted'}]}:emptyWidget('customerBranchCsat','Ranking chi nhánh theo CSAT'),
    byIssue.length?{id:'customerTopIssues',title:'Top nguyên nhân phàn nàn',subtitle:'Grouped bar giảm dần theo nhóm lỗi',type:'bar',className:'span-4 row-3',data:byIssue.slice(0,8),datasets:[{name:'Số phản ánh',dataKey:'count',role:'danger'}]}:emptyWidget('customerTopIssues','Top nguyên nhân phàn nàn'),
    patternRows.length?{id:'customerPatternTable',title:'Chi nhánh × ca/ngày',subtitle:'Table màu nhận diện pattern vận hành',type:'table',className:'span-4 row-3',data:patternRows.slice(0,12).map(r=>({branch:r.branch,shift:r.shift,rating:r.rating?r.rating.toFixed(1):'—',issues:fmtCount(r.count),status:r.rating&&r.rating<4?'danger':r.count>=3?'warning':'neutral'})),columns:[{key:'branch',label:'Chi nhánh'},{key:'shift',label:'Ca/ngày'},{key:'rating',label:'Rating',align:'right'},{key:'issues',label:'Phản ánh',align:'right'}]}:emptyWidget('customerPatternTable','Chi nhánh × ca/ngày'),
    slaTrend.length?{id:'customerSla',title:'SLA xử lý phản ánh',subtitle:'Cột số phản ánh, line % đúng SLA',type:'combo',className:'span-4 row-4',data:slaTrend,datasets:[{name:'Số phản ánh',dataKey:'count',type:'bar',role:'primary'},{name:'% đúng SLA',dataKey:'slaRate',type:'line',axis:'right',role:'success'}]}:emptyWidget('customerSla','SLA xử lý phản ánh'),
    {id:'customerSevereTable',title:'Bảng phản ánh nghiêm trọng & hành động',subtitle:'Ngày, mức độ, chi nhánh, kênh, ca, lỗi, SLA, phụ trách',type:'table',className:'span-8 row-4',data:severeRows.map(r=>({date:r.date?formatDateLabel(r.date):'—',level:r.severity||((r.rating&&r.rating<4)||!r.slaOk?'Cao':'TB'),branch:r.branch,channel:r.channel||'—',shift:r.shift||'—',issue:r.issue,owner:r.owner||'—',sla:r.responseTimeHours?`${r.responseTimeHours}h/${r.slaHours}h`:'—',status:((r.rating&&r.rating<4)||!r.slaOk?'danger':'warning')})),columns:[{key:'date',label:'Ngày'},{key:'level',label:'Mức'},{key:'branch',label:'CN'},{key:'channel',label:'Kênh'},{key:'shift',label:'Ca'},{key:'issue',label:'Lỗi'},{key:'sla',label:'SLA'},{key:'owner',label:'Phụ trách'}]}
  ];
  return {kpis,widgets};
}

function buildExpansion(ctx: Ctx) {
  const t=totals(ctx.rows,ctx.costs); const branches=groupByBranch(ctx.rows,ctx.previousRows); const capacity=normalizeCapacity(ctx); const checklist=normalizeOpeningChecklist(ctx); const payback=normalizePayback(ctx);
  const avgReady = safeDiv(sum(checklist,r=>r.score),checklist.filter(r=>r.score).length);
  const kpis=[{id:'stores',title:'Số cửa hàng',value:fmtCount(branches.length),status:'neutral' as const},makeKpi('avgRev','Doanh thu/cửa hàng',safeDiv(t.revenue,Math.max(branches.length,1)),0,'money'),makeKpi('avgProfit','Lợi nhuận/cửa hàng',safeDiv(t.netProfit,Math.max(branches.length,1)),0,'money'),{id:'capacity',title:'Công suất BTT',value:capacity.length?fmtPct(safeDiv(sum(capacity,r=>r.used),sum(capacity,r=>r.capacity))*100):'—',status:'neutral' as const},{id:'ready',title:'Điểm sẵn sàng',value:avgReady?fmtPct(avgReady):'—',status:(avgReady>=80?'good':avgReady?'warning':'neutral') as Status}];
  const statusRows = branches.map(b=>({name:b.margin>15?'Tốt':b.margin>8?'Cảnh báo':'Nguy hiểm',value:1}));
  const statusPie = groupRows(statusRows,r=>r.name,r=>r.value).map(x=>({name:x.name,value:x.value}));
  const widgets=[
    branches.length?{id:'expRevenueStore',title:'Doanh thu/cửa hàng theo hiệu quả',type:'bar' as const,className:'span-5 row-2',data:branches,datasets:[{name:'Doanh thu',dataKey:'revenue',role:'primary' as const},{name:'Lợi nhuận',dataKey:'profit',role:'success' as const}]}:emptyWidget('expRevenueStore','Hiệu quả từng cửa hàng'),
    capacity.length?{id:'expCapacity',title:'Công suất bếp trung tâm',type:'combo' as const,className:'span-4 row-2',data:capacity,datasets:[{name:'Sản lượng',dataKey:'used',type:'bar' as const,role:'primary' as const},{name:'% công suất',dataKey:'rate',type:'line' as const,axis:'right' as const,role:'warning' as const}]}:emptyWidget('expCapacity','Công suất bếp trung tâm','Bổ sung EXP_KITCHEN_CAPACITY để biết bếp còn tải được bao nhiêu cửa hàng.'),
    statusPie.length?{id:'expStatusPie',title:'Cơ cấu cửa hàng theo trạng thái',type:'pie' as const,className:'span-3 row-2',data:statusPie}:emptyWidget('expStatusPie','Cơ cấu cửa hàng theo trạng thái'),
    {id:'expGoNoGo',title:'Bảng GO / NO-GO mở rộng',type:'table' as const,className:'span-8 row-3',data:(checklist.length?checklist:branches.map(b=>({name:b.branch,score:b.margin>15?85:b.margin>8?65:45,payback:payback.find(p=>p.name===b.branch)?.months||0,decision:b.margin>15?'GO':'NO-GO'}))).map((r:any)=>({name:r.name,score:fmtPct(r.score),payback:r.payback?`${r.payback} tháng`:'—',decision:r.decision|| (r.score>=75?'GO':r.score>=60?'WAIT':'NO-GO'),status:(r.decision==='GO'||r.score>=75)?'good':(r.score>=60?'warning':'danger')})),columns:[{key:'name',label:'Điểm/CH'},{key:'score',label:'Sẵn sàng',align:'right' as const},{key:'payback',label:'Payback',align:'right' as const},{key:'decision',label:'Quyết định'}]},
    emptyWidget('expData','Nguồn dữ liệu mở rộng','Để phân tích nâng cao, bổ sung EXP_KITCHEN_CAPACITY, EXP_OPENING_CHECKLIST, EXP_PAYBACK và STORE_LOCATION.')
  ];
  return {kpis,widgets};
}

function makeAlerts(ctx: Ctx) {
  const t=totals(ctx.rows,ctx.costs); const branches=groupByBranch(ctx.rows,ctx.previousRows); const alerts:any[]=[];
  if(t.foodCostPct>35) alerts.push({level:t.foodCostPct>42?'Cao':'TB',branch:'Toàn chuỗi',issue:`Food Cost ${fmtPct(t.foodCostPct)}`,action:'Soát định lượng/giá vốn',status:t.foodCostPct>42?'danger':'warning'});
  if(t.laborCostPct>22) alerts.push({level:t.laborCostPct>28?'Cao':'TB',branch:'Toàn chuỗi',issue:`Labor Cost ${fmtPct(t.laborCostPct)}`,action:'Soát lịch và giờ công',status:t.laborCostPct>28?'danger':'warning'});
  branches.filter(b=>b.growthPct<-10).slice(0,3).forEach(b=>alerts.push({level:'Cao',branch:b.branch,issue:`Doanh thu giảm ${fmtPct(Math.abs(b.growthPct))}`,action:'Audit chi nhánh/ca/kênh',status:'danger'}));
  branches.filter(b=>b.margin<10).slice(0,3).forEach(b=>alerts.push({level:'Cao',branch:b.branch,issue:`Margin thấp ${fmtPct(b.margin)}`,action:'Soát P&L',status:'danger'}));
  return alerts.length?alerts:[{level:'OK',branch:'Toàn chuỗi',issue:'Không có cảnh báo nghiêm trọng',action:'Tiếp tục theo dõi',status:'good'}];
}

function makeTrendCompare(ctx: Ctx) {
  const trend = groupSalesByTime(ctx.rows, ctx.groupMode);
  const prevTrend = groupSalesByTime(ctx.previousRows, ctx.groupMode);
  const prevByIndex = new Map(prevTrend.map((x, i) => [i, x.revenue]));
  return trend.map((x, i) => ({ ...x, previousRevenue: prevByIndex.get(i) || 0 }));
}

function withShare<T extends Record<string, any>>(rows: T[], key: string): Array<T & { share: number }> {
  const total = rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  return rows.map((r) => ({ ...r, share: safeDiv(Number(r[key] || 0), total) * 100 }));
}

function toDataKey(name: string): string {
  return String(name || 'khac')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'khac';
}

function channelRevenueByTime(ctx: Ctx, channels: Array<{ name: string }>) {
  const mode = ctx.groupMode;
  const channelKeys = channels.map((c) => ({ name: c.name, key: toDataKey(c.name) }));
  const map = new Map<string, any>();
  for (const r of ctx.rows) {
    if (!r.date) continue;
    const key = mode === 'year' ? String(r.date.getFullYear()) : mode === 'month' ? r.monthKey : r.dateKey;
    const label = mode === 'year' ? key : mode === 'month' ? monthLabel(key) : formatDateLabel(r.date);
    const item = map.get(key) || { key, label };
    const entries: Array<[string, number]> = [
      ['Tiền mặt', r.cash],
      ['Chuyển khoản', r.transfer],
      ['Grab', r.grab],
      ['Shopee', r.shopee],
      ['Be', r.be],
      ['Xanh ngon', r.xanh],
      ['Takeaway', r.takeaway]
    ];
    const hasBreakdown = entries.some(([, v]) => Number(v) > 0);
    if (hasBreakdown) {
      for (const [name, value] of entries) {
        const dk = toDataKey(name);
        item[dk] = (item[dk] || 0) + Number(value || 0);
      }
    } else {
      const dk = toDataKey(r.channel || 'Khác');
      item[dk] = (item[dk] || 0) + r.revenue;
    }
    map.set(key, item);
  }
  const rows = Array.from(map.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return rows.map((row) => {
    channelKeys.forEach(({ key }) => { if (row[key] == null) row[key] = 0; });
    return row;
  });
}


function addPortionVisualScale<T extends Record<string, any>>(rows: T[]): Array<T & { portionsScaled: number; portionsScale: number }> {
  const maxRevenue = Math.max(...rows.map((r) => Number(r.revenue || 0)), 0);
  const maxPortions = Math.max(...rows.map((r) => Number(r.portions || r.orders || 0)), 0);
  const scale = maxRevenue > 0 && maxPortions > 0 ? (maxRevenue / maxPortions) * 0.82 : 1;
  return rows.map((r) => {
    const portions = Number(r.portions || r.orders || 0);
    return {
      ...r,
      portions,
      portionsScaled: portions * scale,
      portionsScale: scale
    };
  });
}

function channelPortionRevenueAovByTime(ctx: Ctx) {
  return groupSalesByTime(ctx.rows, ctx.groupMode).map((x) => ({
    ...x,
    portions: x.portions || x.orders,
    aov: safeDiv(x.revenue, x.portions || x.orders)
  }));
}

function channelMixStackedByTime(ctx: Ctx, channels: Array<{ name: string }>) {
  const revenueRows = channelRevenueByTime(ctx, channels);
  return revenueRows.map((row) => {
    const total = channels.reduce((s, c) => s + Number(row[toDataKey(c.name)] || 0), 0);
    const out: any = { key: row.key, label: row.label };
    channels.forEach((c) => {
      out[toDataKey(c.name)] = safeDiv(Number(row[toDataKey(c.name)] || 0), total) * 100;
    });
    return out;
  });
}

function groupShiftByBranch(ctx: Ctx) {
  const map = new Map<string, any>();
  for (const r of ctx.rows) {
    const key = r.branchName || r.branch;
    const item = map.get(key) || { branch: key, morning: 0, evening: 0 };
    if (r.shift === 'Sáng') item.morning += r.revenue; else if (r.shift === 'Tối') item.evening += r.revenue;
    map.set(key, item);
  }
  return Array.from(map.values()).sort((a,b)=>(b.morning+b.evening)-(a.morning+a.evening));
}

function groupRows<T>(rows: T[], nameFn: (row: T) => string, valueFn: (row: T) => number) {
  const map = new Map<string, number>();
  rows.forEach((r) => { const name = clean(nameFn(r)); map.set(name, (map.get(name)||0) + valueFn(r)); });
  return Array.from(map.entries()).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}

function groupByKey<T>(rows: T[], keyFn: (row: T) => string, valueFn: (row: T) => number) {
  const map = new Map<string, {sum:number; count:number}>();
  rows.forEach((r)=>{ const key=clean(keyFn(r)); const value=valueFn(r); if(!Number.isFinite(value)||!value) return; const item=map.get(key)||{sum:0,count:0}; item.sum+=value; item.count+=1; map.set(key,item); });
  return Array.from(map.entries()).map(([name,x])=>({name, value:x.sum, avg:safeDiv(x.sum,x.count), count:x.count}));
}

function normalizeMenu(ctx: Ctx) {
  return ctx.workbook.menuSales.map((row) => {
    const item = clean(pick(row,['Món','Tên món','Sản phẩm','Menu Item','Item']));
    const group = clean(pick(row,['Nhóm món','Nhóm','Category','Group']),'Khác');
    const qty = toNumber(pick(row,['Số lượng','SL','Quantity','Qty','Số phần']));
    const revenue = toNumber(pick(row,['Doanh thu','Revenue','Net Revenue','Doanh thu thuần']));
    const cost = toNumber(pick(row,['Giá vốn','COGS','Food Cost','Cost']));
    const profit = toNumber(pick(row,['Lợi nhuận','Profit','Gross Profit'])) || revenue - cost;
    const previousRevenue = toNumber(pick(row,['Doanh thu kỳ trước','Previous Revenue','Kỳ trước']));
    return { item, group, qty, revenue, cost, profit, marginPct: safeDiv(profit,revenue)*100, previousRevenue, growthPct: pctChange(revenue, previousRevenue) };
  }).filter(r=>r.item && (r.qty||r.revenue));
}

function buildMenuKpis(rows: ReturnType<typeof normalizeMenu>): KpiCard[] {
  const revenue = sum(rows,r=>r.revenue); const qty = sum(rows,r=>r.qty); const profit=sum(rows,r=>r.profit);
  const top = [...rows].sort((a,b)=>b.revenue-a.revenue)[0]; const low = rows.filter(r=>r.marginPct<20).length;
  return [
    {id:'menuRevenue',title:'Doanh thu menu',value:fmtMoney(revenue),status:'neutral'},
    {id:'menuQty',title:'Sản lượng bán',value:fmtCount(qty),status:'neutral'},
    {id:'menuProfit',title:'LN gộp món',value:fmtMoney(profit),status:(profit>=0?'good':'danger') as Status},
    {id:'menuMargin',title:'Margin TB món',value:fmtPct(safeDiv(profit,revenue)*100),status:statusForPct(safeDiv(profit,revenue)*100,35,20,true)},
    {id:'topItem',title:'Món doanh thu cao nhất',value:top?.item || '—',delta:top?fmtMoney(top.revenue):'—',status:'neutral'},
    {id:'lowMargin',title:'Món margin thấp',value:fmtCount(low),status:(low?'warning':'good') as Status}
  ];
}

function normalizeAudit(ctx: Ctx) {
  return ctx.workbook.opsAudit.map(row=>{ const date=parseLocalDate(pick(row,['Ngày','Date','Thời gian'])); const month=toNumber(pick(row,['Tháng','Month'])); const year=toNumber(pick(row,['Năm','Year'])); return {date,dateKey:date?formatDateLabel(date):'',monthKey:date?formatMonthKey(date.getFullYear(),date.getMonth()+1):(year&&month?monthLabel(formatMonthKey(year,month)):''),branch:clean(pick(row,['Mã CH','Chi nhánh','Cửa hàng','Branch'])),score:toNumber(pick(row,['Điểm','Điểm audit','Audit Score','Score']))}; }).filter(r=>r.score);
}
function normalizeIncidents(ctx: Ctx) {
  return ctx.workbook.opsIncidents.map(row=>({branch:clean(pick(row,['Mã CH','Chi nhánh','Cửa hàng','Branch'])),type:clean(pick(row,['Loại lỗi','Nhóm lỗi','Vấn đề','Issue','Type']),'Khác'),shift:clean(pick(row,['Ca','Shift']),'Không rõ'),severity:clean(pick(row,['Mức độ','Severity','Level']),'TB'),action:clean(pick(row,['Hành động','Action','Đề xuất']),'Xử lý/kiểm tra lại')})).filter(r=>r.type!=='Khác'||r.branch!=='Không rõ');
}
function normalizeChecklist(ctx: Ctx) { return ctx.workbook.opsChecklist.map(row=>({branch:clean(pick(row,['Mã CH','Chi nhánh','Cửa hàng'])),status:String(pick(row,['Trạng thái','Status','Kết quả'])||'').match(/đạt|done|ok/i)?'Đạt':'Chưa đạt'})); }
function groupShiftIncident(rows: ReturnType<typeof normalizeIncidents>) { const map=new Map<string,any>(); rows.forEach(r=>{const key=r.branch; const item=map.get(key)||{branch:key,morning:0,evening:0}; if(/sáng|sang|morning/i.test(r.shift)) item.morning++; else item.evening++; map.set(key,item);}); return Array.from(map.values()); }

function normalizeTimesheet(ctx: Ctx) {
  return ctx.workbook.timesheet.map(row=>({employee:clean(pick(row,['Nhân viên','Tên nhân viên','Employee','Name'])),branch:clean(pick(row,['Mã CH','Chi nhánh','Cửa hàng'])),shift:clean(pick(row,['Ca','Shift']),'Không rõ'),hours:toNumber(pick(row,['Giờ công','Số giờ','Hours','Working Hours'])),late:toNumber(pick(row,['Đi trễ','Trễ','Late'])),absent:toNumber(pick(row,['Nghỉ','Nghỉ đột xuất','Absent'])),score:toNumber(pick(row,['Hiệu suất','Điểm','Score']))})).filter(r=>r.hours||r.late||r.absent||r.score);
}
function groupRevPerHour(ctx: Ctx, times: ReturnType<typeof normalizeTimesheet>) { const hours=new Map<string,number>(); times.forEach(r=>hours.set(r.branch,(hours.get(r.branch)||0)+r.hours)); const rev=new Map<string,number>(); ctx.rows.forEach(r=>rev.set(r.branchName||r.branch,(rev.get(r.branchName||r.branch)||0)+r.revenue)); return Array.from(hours.entries()).map(([branch,h])=>({branch,hours:h,revenue:rev.get(branch)||0,revPerHour:safeDiv(rev.get(branch)||0,h)})).sort((a,b)=>b.revPerHour-a.revPerHour); }
function groupHoursShift(times: ReturnType<typeof normalizeTimesheet>) { const map=new Map<string,any>(); times.forEach(r=>{const item=map.get(r.branch)||{branch:r.branch,morning:0,evening:0}; if(/sáng|sang|morning/i.test(r.shift)) item.morning+=r.hours; else item.evening+=r.hours; map.set(r.branch,item);}); return Array.from(map.values()); }
function groupDiscipline(times: ReturnType<typeof normalizeTimesheet>) { const map=new Map<string,any>(); times.forEach(r=>{const item=map.get(r.branch)||{branch:r.branch,late:0,absent:0}; item.late+=r.late; item.absent+=r.absent; map.set(r.branch,item);}); return Array.from(map.values()).filter(x=>x.late||x.absent); }

function normalizeStock(ctx: Ctx) {
  return ctx.workbook.stock.map(row=>{ const theory=toNumber(pick(row,['Tồn lý thuyết','Ton ly thuyet','Lý thuyết','Theory'])); const actual=toNumber(pick(row,['Tồn thực tế','Ton thuc te','Thực tế','Actual'])); const diff=toNumber(pick(row,['Lệch','Chênh lệch','Diff'])) || actual - theory; const diffValue=toNumber(pick(row,['Giá trị lệch','Value Diff','Giá trị hao hụt'])); return {branch:clean(pick(row,['Mã CH','Chi nhánh','Cửa hàng'])),material:clean(pick(row,['NVL','Nguyên vật liệu','Mặt hàng','Item','Material'])),theory,actual,diffQty:diff,diffValue,wasteValue:toNumber(pick(row,['Hao hụt','Hư hỏng','Hủy hỏng','Waste Value']))}; }).filter(r=>r.material!=='Không rõ'||r.diffQty||r.diffValue||r.wasteValue);
}

function groupFeedbackTrend(ctx: Ctx) { const map=new Map<string,{sum:number;count:number;complaints:number}>(); ctx.feedback.forEach(r=>{const d=r.date; const key=d?formatDateKey(d):'Không ngày'; const label=d?formatDateLabel(d):key; const item=map.get(key)||{sum:0,count:0,complaints:0}; if(r.rating){item.sum+=r.rating; item.count++;} item.complaints++; map.set(key,item);}); return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([key,x])=>({key,label:key.length===10?key.slice(8,10)+'/'+key.slice(5,7):key,rating:safeDiv(x.sum,x.count),count:x.complaints})); }
function groupFeedbackBranch(ctx: Ctx) { const map=new Map<string,{sum:number;count:number}>(); ctx.feedback.forEach(r=>{if(!r.rating)return; const item=map.get(r.branch)||{sum:0,count:0}; item.sum+=r.rating; item.count++; map.set(r.branch,item);}); return Array.from(map.entries()).map(([branch,x])=>({branch,rating:safeDiv(x.sum,x.count)})).sort((a,b)=>b.rating-a.rating); }

function groupFeedbackChannel(rows: Ctx['feedback']) {
  const map = new Map<string, { sum: number; countRating: number; count: number }>();
  rows.forEach((r) => {
    const key = clean(r.channel || 'Không rõ');
    const item = map.get(key) || { sum: 0, countRating: 0, count: 0 };
    item.count += 1;
    if (r.rating) { item.sum += r.rating; item.countRating += 1; }
    map.set(key, item);
  });
  return Array.from(map.entries()).map(([channel, x]) => ({ channel, name: channel, count: x.count, rating: safeDiv(x.sum, x.countRating) })).sort((a,b)=>b.count-a.count);
}

function groupFeedbackBranchCompare(current: Ctx['feedback'], previous: Ctx['feedback']) {
  const make = (rows: Ctx['feedback']) => {
    const map = new Map<string, { sum: number; count: number }>();
    rows.forEach((r) => {
      if (!r.rating) return;
      const item = map.get(r.branch) || { sum: 0, count: 0 };
      item.sum += r.rating; item.count += 1; map.set(r.branch, item);
    });
    return map;
  };
  const cur = make(current);
  const prev = make(previous);
  return Array.from(cur.entries()).map(([branch, x]) => {
    const px = prev.get(branch);
    return { branch, rating: safeDiv(x.sum, x.count), previousRating: px ? safeDiv(px.sum, px.count) : 0, count: x.count };
  }).sort((a,b)=>a.rating-b.rating || b.count-a.count);
}

function groupFeedbackBranchShift(rows: Ctx['feedback']) {
  const map = new Map<string, { branch: string; shift: string; sum: number; countRating: number; count: number }>();
  rows.forEach((r) => {
    const shift = clean(r.shift || 'Không rõ');
    const key = `${r.branch}__${shift}`;
    const item = map.get(key) || { branch: r.branch, shift, sum: 0, countRating: 0, count: 0 };
    item.count += 1;
    if (r.rating) { item.sum += r.rating; item.countRating += 1; }
    map.set(key, item);
  });
  return Array.from(map.values()).map((x) => ({ branch: x.branch, shift: x.shift, rating: safeDiv(x.sum, x.countRating), count: x.count })).sort((a,b)=>a.rating-b.rating || b.count-a.count);
}

function groupFeedbackSlaTrend(rows: Ctx['feedback']) {
  const map = new Map<string, { label: string; count: number; ok: number }>();
  rows.forEach((r) => {
    const key = r.date ? formatDateKey(r.date) : 'Không ngày';
    const label = r.date ? formatDateLabel(r.date) : key;
    const item = map.get(key) || { label, count: 0, ok: 0 };
    item.count += 1;
    if (r.slaOk) item.ok += 1;
    map.set(key, item);
  });
  return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([, x]) => ({ label: x.label, count: x.count, slaRate: safeDiv(x.ok, x.count) * 100 }));
}


function normalizeCapacity(ctx: Ctx) { return ctx.workbook.expansionCapacity.map(row=>{const used=toNumber(pick(row,['Sản lượng','Đã dùng','Used','Output'])); const capacity=toNumber(pick(row,['Công suất','Capacity','Tối đa'])); const name=clean(pick(row,['Bếp','Tên','Khu vực','Name']),'Bếp trung tâm'); return {name,used,capacity,rate:safeDiv(used,capacity)*100};}).filter(r=>r.used||r.capacity); }
function normalizeOpeningChecklist(ctx: Ctx) { return ctx.workbook.expansionChecklist.map(row=>({name:clean(pick(row,['Mặt bằng','Chi nhánh','Tên điểm','Location','Name'])),score:toNumber(pick(row,['Điểm sẵn sàng','Score','Ready Score'])),decision:clean(pick(row,['Quyết định','Decision']),'')})).filter(r=>r.name!=='Không rõ'||r.score); }
function normalizePayback(ctx: Ctx) { return ctx.workbook.expansionPayback.map(row=>({name:clean(pick(row,['Mặt bằng','Chi nhánh','Tên điểm','Location','Name'])),months:toNumber(pick(row,['Payback','Payback tháng','Tháng hoàn vốn']))})).filter(r=>r.name!=='Không rõ'||r.months); }
