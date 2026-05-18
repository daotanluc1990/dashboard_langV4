'use client';
export function Header({
  title,
  subtitle,
  loading,
  source,
  onRefresh
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  source?: string;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="top-actions">
        <span className="pill"><span className="dot" />Owner/CEO</span>
        <span className="pill">{loading ? 'Đang tải' : source === 'google-sheets' ? 'Google Sheet' : 'Sẵn sàng'}</span>
        <button className="btn-primary" type="button" onClick={onRefresh}>Đọc lại Sheet</button>
      </div>
    </header>
  );
}
