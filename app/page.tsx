'use client';
import { useEffect, useMemo, useState } from 'react';
import type { DashboardFilters, DashboardPayload, TabId } from '@/types/dashboard';
import { tabs, tabTitles } from '@/lib/dashboard-config';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/layout/FilterBar';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { AiAssistant } from '@/components/ai/AiAssistant';

const initialFilters: DashboardFilters = {
  tab: 'overview',
  period: 'thisMonth',
  compareMode: 'none',
  branch: 'all',
  channel: 'all',
  shift: 'all'
};

export default function Page() {
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [cache, setCache] = useState<Map<string, DashboardPayload>>(new Map());

  const cacheKey = useMemo(() => JSON.stringify(filters), [filters]);

  async function load(force = false) {
    const cached = cache.get(cacheKey);
    if (!force && cached) {
      setPayload(cached);
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v != null) as any);
      if (force) params.set('force', '1');
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Không tải được dashboard');
      setPayload(json);
      setCache((prev) => new Map(prev).set(cacheKey, json));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(false); }, [cacheKey]);

  function selectTab(tab: TabId) {
    setFilters((f) => ({ ...f, tab }));
  }

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar tabs={tabs} activeTab={filters.tab} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} onSelect={selectTab} />
      <main className="main">
        <Header title={tabTitles[filters.tab].title} subtitle={tabTitles[filters.tab].subtitle} loading={loading} source={payload?.meta.source} onRefresh={() => load(true)} />
        <FilterBar filters={filters} onChange={setFilters} />
        <section className={`status ${error ? 'error' : payload ? 'ok' : ''}`}>
          {loading ? 'Đang tải dữ liệu Google Sheet...' : error ? error : ''}
        </section>
        {error ? <div className="error-box">{error}</div> : <DashboardGrid payload={payload} loading={loading} />}
        <div className="footer-note">Next.js preview · dữ liệu đọc server-side từ Google Sheet · UI mô phỏng Apps Script v7.6 production</div>
        <AiAssistant filters={filters} payload={payload} />
      </main>
    </div>
  );
}
