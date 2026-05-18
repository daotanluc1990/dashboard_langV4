'use client';
import type { TabId } from '@/types/dashboard';
import { BadgeDollarSign, Bike, Home, Package, ReceiptText, Rocket, Settings, Star, TrendingUp, Users, Utensils } from 'lucide-react';

const iconMap: Record<string, any> = { Home, TrendingUp, BadgeDollarSign, ReceiptText, Bike, Utensils, Settings, Users, Package, Star, Rocket };

export function Sidebar({
  tabs,
  activeTab,
  collapsed,
  onToggle,
  onSelect
}: {
  tabs: Array<{ id: TabId; label: string; icon: string }>;
  activeTab: TabId;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">🍛</div>
        <div className="brand-text">
          <h2>Cơm Tấm Làng<br />CEO BI</h2>
          <span>DASHBOARD_DATA · NEXT</span>
        </div>
        <button className="sidebar-toggle" type="button" onClick={onToggle} title="Thu/mở sidebar" aria-label="Thu/mở sidebar">
          {collapsed ? '›' : '☰'}
        </button>
      </div>
      <nav className="nav">
        {tabs.map((t) => {
          const Icon = iconMap[t.icon] || Home;
          return (
            <button key={t.id} onClick={() => onSelect(t.id)} className={`nav-btn ${activeTab === t.id ? 'active' : ''}`} title={t.label}>
              <span className="nav-ico"><Icon size={15} strokeWidth={2.2} /></span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="side-note">11 tab đúng cấu trúc CEO: tổng quan, tăng trưởng, P&amp;L, chi phí, kênh, menu, vận hành, nhân sự, tồn kho, khách hàng, mở rộng.</div>
    </aside>
  );
}
