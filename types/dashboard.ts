export type TabId =
  | 'overview'
  | 'revenue'
  | 'pnl'
  | 'cost'
  | 'channel'
  | 'menu'
  | 'operations'
  | 'people'
  | 'stock'
  | 'customer'
  | 'expansion';

export type PeriodKey = 'latestMonth' | 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'custom';
export type CompareMode = 'none' | 'previousPeriod' | 'previousMonth' | 'previousYear';

export interface DashboardFilters {
  tab: TabId;
  period: PeriodKey;
  startDate?: string;
  endDate?: string;
  compareMode: CompareMode;
  branch: string;
  channel: string;
  shift: string;
}

export interface KpiCard {
  id: string;
  title: string;
  value: string;
  rawValue?: number;
  delta?: string;
  deltaRaw?: number;
  status?: 'good' | 'warning' | 'danger' | 'neutral';
  hint?: string;
}

export interface ChartDataset {
  name: string;
  dataKey: string;
  type?: 'bar' | 'line';
  axis?: 'left' | 'right';
  role?: 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'blue';
}

export interface DashboardWidget {
  id: string;
  title: string;
  subtitle?: string;
  type: 'line' | 'bar' | 'combo' | 'stacked' | 'pie' | 'table' | 'alertTable' | 'empty';
  className?: string;
  data?: Array<Record<string, any>>;
  datasets?: ChartDataset[];
  columns?: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center'; statusKey?: string }>;
  empty?: boolean;
  message?: string;
  summary?: Record<string, any>;
}

export interface DashboardPayload {
  ok: boolean;
  tab: TabId;
  title: string;
  subtitle?: string;
  kpis: KpiCard[];
  widgets: DashboardWidget[];
  meta: {
    periodLabel: string;
    compareLabel: string;
    generatedAt: string;
    source: 'google-sheets' | 'empty' | 'error';
    filters: DashboardFilters;
  };
  error?: string;
}

export interface RawWorkbook {
  dashboard: Array<Record<string, any>>;
  costs: Array<Record<string, any>>;
  stock: Array<Record<string, any>>;
  feedback: Array<Record<string, any>>;
  targets: Array<Record<string, any>>;
  stores: Array<Record<string, any>>;
  menuSales: Array<Record<string, any>>;
  employees: Array<Record<string, any>>;
  timesheet: Array<Record<string, any>>;
  opsAudit: Array<Record<string, any>>;
  opsIncidents: Array<Record<string, any>>;
  opsChecklist: Array<Record<string, any>>;
  expansionCapacity: Array<Record<string, any>>;
  expansionChecklist: Array<Record<string, any>>;
  expansionPayback: Array<Record<string, any>>;
  storeLocation: Array<Record<string, any>>;
}
