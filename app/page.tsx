'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardFilters, DashboardPayload, TabId } from '@/types/dashboard';
import { tabs, tabTitles } from '@/lib/dashboard-config';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/layout/FilterBar';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { AiAssistant } from '@/components/ai/AiAssistant';

const initialFilters: DashboardFilters = {
  tab: 'overview',
  period: 'realTime',
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
  const requestSeq = useRef(0);
  const cacheRef = useRef(cache);
  const prefetchingRef = useRef(new Set<string>());

  const cacheKey = useMemo(() => JSON.stringify(filters), [filters]);

  function writeCache(key: string, value: DashboardPayload) {
    setCache((prev) => {
      const next = new Map(prev).set(key, value);
      cacheRef.current = next;
      return next;
    });
  }

  async function load(targetFilters = filters, force = false) {
    const currentKey = JSON.stringify(targetFilters);
    const seq = ++requestSeq.current;
    const cached = cacheRef.current.get(currentKey);
    if (!force && cached) {
      setPayload(cached);
      setLoading(false);
      prefetchTabs(targetFilters);
      return;
    }
    setLoading(true); setError('');
    if (payload?.tab && payload.tab !== targetFilters.tab) {
      setPayload(null);
    }
    try {
      const params = new URLSearchParams(Object.entries(targetFilters).filter(([, v]) => v != null) as any);
      if (force) params.set('force', '1');
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Không tải được dashboard');
      if (seq !== requestSeq.current) return;
      setPayload(json);
      writeCache(currentKey, json);
      prefetchTabs(targetFilters);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  function prefetchTabs(baseFilters: DashboardFilters) {
    const jobs = tabs
      .map((tab) => ({ ...baseFilters, tab: tab.id }))
      .filter((target) => target.tab !== baseFilters.tab)
      .filter((target) => {
        const key = JSON.stringify(target);
        return !cacheRef.current.has(key) && !prefetchingRef.current.has(key);
      });

    jobs.forEach((target) => {
      const key = JSON.stringify(target);
      prefetchingRef.current.add(key);
      const params = new URLSearchParams(Object.entries(target).filter(([, v]) => v != null) as any);
      fetch(`/api/dashboard?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.ok) writeCache(key, json);
        })
        .catch(() => undefined)
        .finally(() => {
          prefetchingRef.current.delete(key);
        });
    });
  }

  useEffect(() => { load(filters, false); }, [cacheKey]);

  function selectTab(tab: TabId) {
    setFilters((f) => ({ ...f, tab }));
  }

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar tabs={tabs} activeTab={filters.tab} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} onSelect={selectTab} />
      <main className="main">
        <Header title={tabTitles[filters.tab].title} subtitle={tabTitles[filters.tab].subtitle} loading={loading} source={payload?.meta.source} onRefresh={() => load(filters, true)} />
        <FilterBar filters={filters} loading={loading} onChange={setFilters} />
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
