import { sheets } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';
import type { RawWorkbook } from '@/types/dashboard';

const RANGE_MAP: Record<keyof RawWorkbook, string> = {
  dashboard: 'DASHBOARD_DATA!A:ZZ',
  costs: 'CHI_PHI_!A:ZZ',
  stock: 'TON_KHO!A:ZZ',
  feedback: 'DANH_GIA_KHACH_HANG!A:ZZ',
  targets: 'THIET_LAP_MUC_TIEU!A:ZZ',
  stores: 'CUA_HANG!A:ZZ',
  menuSales: 'MENU_SALES_DAILY!A:ZZ',
  employees: 'HR_EMPLOYEE_MASTER!A:ZZ',
  timesheet: 'HR_TIMESHEET_DAILY!A:ZZ',
  opsAudit: 'OPS_AUDIT_SOP!A:ZZ',
  opsIncidents: 'OPS_INCIDENT_LOG!A:ZZ',
  opsChecklist: 'OPS_SHIFT_CHECKLIST!A:ZZ',
  expansionCapacity: 'EXP_KITCHEN_CAPACITY!A:ZZ',
  expansionChecklist: 'EXP_OPENING_CHECKLIST!A:ZZ',
  expansionPayback: 'EXP_PAYBACK!A:ZZ',
  storeLocation: 'STORE_LOCATION!A:ZZ'
};

const SHEET_ALIASES: Partial<Record<keyof RawWorkbook, string[]>> = {
  dashboard: ['DASHBOARD_DATA', 'Dashboard Data', 'Dashboard_Data', 'DATA', 'DATA_DASHBOARD', 'BAN_HANG', 'DOANH_THU', 'SALES', 'SALE_DATA'],
  menuSales: ['MENU_SALES_DAILY', 'MENU SALES DAILY', 'MENU_SALES', 'MENU SALES', 'BAN_MON', 'MON_BAN', 'SALES_MENU']
};

type CacheEntry = { expires: number; value: RawWorkbook };
let workbookCache: CacheEntry | null = null;

function hasPrimaryDashboardData(workbook: RawWorkbook): boolean {
  return Boolean(workbook.dashboard?.length || workbook.menuSales?.length);
}

async function createSheetsClient() {
  assertEnv();
  const auth = new GoogleAuth({
    credentials: getGoogleCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return sheets({ version: 'v4', auth });
}

function getGoogleCredentials() {
  const jsonBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (jsonBase64) {
    return JSON.parse(Buffer.from(jsonBase64.trim(), 'base64').toString('utf8'));
  }
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return JSON.parse(json.trim());
  }
  return {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: getPrivateKey()
  };
}

function getPrivateKey(): string {
  const raw = process.env.GOOGLE_PRIVATE_KEY || '';
  const value = raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');
  if (value.trim().startsWith('{')) {
    return JSON.parse(value).private_key;
  }
  return value;
}

function assertEnv() {
  const hasJsonCredentials = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const required = hasJsonCredentials ? ['GOOGLE_SHEET_ID'] : ['GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  }
}

function rowsToObjects(values: any[][] | undefined): Array<Record<string, any>> {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h || '').trim());
  return values
    .slice(1)
    .map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] ?? '';
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => String(v ?? '').trim() !== ''));
}

export async function loadWorkbook(force = false): Promise<RawWorkbook> {
  const ttl = Number(process.env.DASHBOARD_CACHE_SECONDS || 300) * 1000;
  const now = Date.now();
  if (!force && workbookCache && workbookCache.expires > now && hasPrimaryDashboardData(workbookCache.value)) return workbookCache.value;

  assertEnv();

  let client: ReturnType<typeof sheets>;
  let spreadsheet;
  try {
    client = await createSheetsClient();
    spreadsheet = await client.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      fields: 'sheets.properties.title'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Không kết nối được Google Sheets/OAuth. Kiểm tra mạng, firewall/proxy, Service Account và quyền share Sheet. Chi tiết: ${message}`);
  }

  const titles = (spreadsheet.data.sheets || []).map((s) => s.properties?.title).filter(Boolean) as string[];
  const normalizedTitleMap = new Map(titles.map((title) => [title.trim().toLowerCase(), title]));
  const entries = Object.entries(RANGE_MAP) as Array<[keyof RawWorkbook, string]>;
  const existingEntries = entries.flatMap(([key, range]) => {
    const configuredTitle = range.split('!')[0];
    const aliases = [configuredTitle, ...(SHEET_ALIASES[key] || [])];
    const foundTitle = aliases.map((title) => normalizedTitleMap.get(title.trim().toLowerCase())).find(Boolean);
    return foundTitle ? [[key, `${foundTitle}!A:ZZ`] as [keyof RawWorkbook, string]] : [];
  });

  const workbook = {} as RawWorkbook;
  entries.forEach(([key]) => {
    workbook[key] = [] as any;
  });

  if (existingEntries.length) {
    let res;
    try {
      res = await client.spreadsheets.values.batchGet({
        spreadsheetId: process.env.GOOGLE_SHEET_ID!,
        ranges: existingEntries.map(([, range]) => range),
        valueRenderOption: 'FORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Không đọc được dữ liệu Google Sheet. Kiểm tra quyền Viewer của Service Account và tên sheet. Chi tiết: ${message}`);
    }

    const valueRanges = res.data.valueRanges || [];
    existingEntries.forEach(([key], idx) => {
      workbook[key] = rowsToObjects(valueRanges[idx]?.values as any[][] | undefined) as any;
    });
  }

  workbookCache = { expires: now + ttl, value: workbook };
  return workbook;
}

export async function inspectGoogleWorkbook() {
  const client = await createSheetsClient();
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    fields: 'sheets.properties.title'
  });
  const titles = (spreadsheet.data.sheets || []).map((s) => s.properties?.title).filter(Boolean) as string[];
  const ranges = titles.map((title) => `${title}!A1:ZZ5`);
  const res = await client.spreadsheets.values.batchGet({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  });
  return (res.data.valueRanges || []).map((range, index) => {
    const values = range.values || [];
    return {
      title: titles[index],
      rowsInSample: values.length,
      headers: values[0] || [],
      firstRows: values.slice(1, 3)
    };
  });
}
