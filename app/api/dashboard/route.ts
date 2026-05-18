import { NextRequest, NextResponse } from 'next/server';
import type { DashboardFilters, TabId, PeriodKey, CompareMode } from '@/types/dashboard';
import { loadWorkbook } from '@/lib/google-sheets';
import { buildDashboardPayload } from '@/lib/build-dashboard';

export const dynamic = 'force-dynamic';

function asTab(value: string | null): TabId {
  const tabs: TabId[] = ['overview','revenue','pnl','cost','channel','menu','operations','people','stock','customer','expansion'];
  return tabs.includes(value as TabId) ? value as TabId : 'overview';
}
function asPeriod(value: string | null): PeriodKey {
  const periods: PeriodKey[] = ['today','thisWeek','thisMonth','thisYear','custom'];
  return periods.includes(value as PeriodKey) ? value as PeriodKey : 'thisMonth';
}
function asCompare(value: string | null): CompareMode {
  const modes: CompareMode[] = ['none','previousPeriod','previousMonth','previousYear'];
  return modes.includes(value as CompareMode) ? value as CompareMode : 'none';
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filters: DashboardFilters = {
      tab: asTab(sp.get('tab')),
      period: asPeriod(sp.get('period')),
      startDate: sp.get('startDate') || undefined,
      endDate: sp.get('endDate') || undefined,
      compareMode: asCompare(sp.get('compareMode')),
      branch: sp.get('branch') || 'all',
      channel: sp.get('channel') || 'all',
      shift: sp.get('shift') || 'all'
    };
    const force = sp.get('force') === '1';
    const workbook = await loadWorkbook(force);
    const payload = buildDashboardPayload(workbook, filters);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
