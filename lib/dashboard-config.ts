import type { TabId } from '@/types/dashboard';

export const tabs: Array<{ id: TabId; label: string; short: string; icon: string }> = [
  { id: 'overview', label: 'Tổng quan CEO', short: 'Tổng quan', icon: 'Home' },
  { id: 'revenue', label: 'Doanh thu & Tăng trưởng', short: 'Doanh thu', icon: 'TrendingUp' },
  { id: 'pnl', label: 'Lợi nhuận & P&L', short: 'P&L', icon: 'BadgeDollarSign' },
  { id: 'cost', label: 'Chi phí', short: 'Chi phí', icon: 'ReceiptText' },
  { id: 'channel', label: 'Kênh bán hàng & Appfood', short: 'Kênh bán', icon: 'Bike' },
  { id: 'menu', label: 'Sản phẩm / Menu', short: 'Menu', icon: 'Utensils' },
  { id: 'operations', label: 'Vận hành cửa hàng', short: 'Vận hành', icon: 'Settings' },
  { id: 'people', label: 'Nhân sự & Hiệu suất', short: 'Nhân sự', icon: 'Users' },
  { id: 'stock', label: 'Tồn kho / Giá vốn', short: 'Tồn kho', icon: 'Package' },
  { id: 'customer', label: 'Đánh giá & Khách hàng', short: 'Khách hàng', icon: 'Star' },
  { id: 'expansion', label: 'Mở rộng chuỗi', short: 'Mở rộng', icon: 'Rocket' }
];

export const tabTitles: Record<TabId, { title: string; subtitle: string }> = {
  overview: { title: 'Tổng quan CEO', subtitle: 'Toàn chuỗi khỏe hay yếu, có lời không, chi nhánh nào cần xử lý.' },
  revenue: { title: 'Doanh thu & Tăng trưởng', subtitle: 'Doanh thu đến từ đâu, tăng trưởng do volume, AOV, chi nhánh hay kênh.' },
  pnl: { title: 'Lợi nhuận & P&L', subtitle: 'Lời thật bao nhiêu, cửa hàng nào lời/lỗ, khoản nào ăn mòn lợi nhuận.' },
  cost: { title: 'Chi phí', subtitle: 'Tiền chi ra ở đâu, nhóm nào tăng bất thường, chi nhánh nào vượt chuẩn.' },
  channel: { title: 'Kênh bán & Appfood', subtitle: 'Doanh thu thật theo kênh, mức phụ thuộc Appfood, hiệu quả online/offline.' },
  menu: { title: 'Sản phẩm / Menu', subtitle: 'Món nào bán chạy, món nào lời tốt, combo/add-on có hiệu quả không.' },
  operations: { title: 'Vận hành cửa hàng', subtitle: 'SOP, lỗi vận hành, ca yếu và cửa hàng dưới chuẩn.' },
  people: { title: 'Nhân sự & Hiệu suất', subtitle: 'Labor cost, giờ công, năng suất và kỷ luật nhân sự.' },
  stock: { title: 'Tồn kho / Giá vốn', subtitle: 'Food cost, tồn kho lệch, hao hụt và hàng hủy/hỏng.' },
  customer: { title: 'Đánh giá & Khách hàng', subtitle: 'Rating, SLA xử lý phản ánh, lỗi lặp lại và chi nhánh ảnh hưởng thương hiệu.' },
  expansion: { title: 'Mở rộng chuỗi', subtitle: 'Sức khỏe hệ thống, công suất bếp, payback và GO/NO-GO.' }
};
