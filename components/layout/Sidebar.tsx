'use client';
import type { TabId } from '@/types/dashboard';
import { BadgeDollarSign, Bike, ChevronRight, Home, Menu, Package, ReceiptText, Rocket, Settings, Star, TrendingUp, Users, Utensils } from 'lucide-react';

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
        <div className="brand-mark" aria-hidden="true">CTL</div>
        <div className="brand-text">
          <h2>Cơm Tấm Làng<br />CEO BI</h2>
          <span>Premium Food Analytics</span>
        </div>
        <button className="sidebar-toggle" type="button" onClick={onToggle} title="Thu/mở sidebar" aria-label="Thu/mở sidebar">
          {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
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
      <div className="side-note">Thiết kế Premium Food BI: tươi, sáng, scan nhanh KPI mỗi sáng nhưng vẫn giữ đầy đủ 11 góc nhìn CEO.</div>
    </aside>
  );
}
