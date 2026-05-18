export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  let normalized = text
    .replace(/đ|vnd|vnđ|%/gi, '')
    .replace(/[^\d,.\-()]/g, '')
    .replace(/[()\-]/g, '');

  const dotCount = (normalized.match(/\./g) || []).length;
  const commaCount = (normalized.match(/,/g) || []).length;

  if (dotCount && commaCount) {
    const lastDot = normalized.lastIndexOf('.');
    const lastComma = normalized.lastIndexOf(',');
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    const decimalPart = normalized.slice(Math.max(lastDot, lastComma) + 1);
    if (decimalPart.length <= 2) {
      normalized = normalized.replace(new RegExp(`\\${thousandSep}`, 'g'), '').replace(decimalSep, '.');
    } else {
      normalized = normalized.replace(/[.,]/g, '');
    }
  } else if (commaCount || dotCount) {
    const sep = commaCount ? ',' : '.';
    const count = commaCount || dotCount;
    const parts = normalized.split(sep);
    const last = parts[parts.length - 1] || '';
    if (count > 1 || last.length === 3) {
      normalized = parts.join('');
    } else {
      normalized = parts.join('.');
    }
  }

  const n = Number(`${negative ? '-' : ''}${normalized}`);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(value: number, compact = true): string {
  if (!Number.isFinite(value)) return '0đ';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (compact && abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2).replace('.', ',')}tỷ`;
  if (compact && abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',')}tr`;
  return `${sign}${Math.round(abs).toLocaleString('vi-VN')}đ`;
}

export function fmtCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('vi-VN');
}

export function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function safeDiv(a: number, b: number): number {
  return b ? a / b : 0;
}

export function pctChange(current: number, previous: number): number {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function deltaText(current: number, previous: number, isPercentValue = false): string {
  const diff = current - previous;
  const pct = pctChange(current, previous);
  const sign = diff >= 0 ? '▲' : '▼';
  const value = isPercentValue ? `${Math.abs(diff).toFixed(1).replace('.', ',')} điểm` : fmtPct(Math.abs(pct));
  return `${sign} ${value}`;
}

export function normalizeKey(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function pick(row: Record<string, any>, aliases: string[]): any {
  const direct = aliases.find((key) => row[key] !== undefined && row[key] !== '');
  if (direct) return row[direct];
  const normalized = new Map(Object.keys(row).map((k) => [normalizeKey(k), k]));
  for (const alias of aliases) {
    const found = normalized.get(normalizeKey(alias));
    if (found && row[found] !== '') return row[found];
  }
  return '';
}

export function parseLocalDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const s = String(value || '').trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) return new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
  const m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
  return null;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateLabel(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}

export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `T${Number(m)}/${y}`;
}
