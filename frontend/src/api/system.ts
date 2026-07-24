import { api } from './client';
import type { Meta } from './warehouse';

// --- Dashboard (FR-5) ---
export interface KpiValue {
  value: string;
  change: number | null;
}

export interface DashboardSummary {
  period: { from: string; to: string; label: string };
  previousPeriod: { from: string; to: string; label: string };
  kpi: {
    income: KpiValue;
    expense: KpiValue;
    profit: KpiValue;
    cash: KpiValue;
  };
  cards: {
    receivables: string;
    payables: string;
    grossProfit: string;
    stockValue: string;
    openDealsCount: number;
    openDealsTotal: string;
    activeEmployees: number;
    lowStockCount: number;
  };
}

export interface DashboardCharts {
  monthly: Array<{ month: string; income: string; expense: string }>;
  funnel: Array<{ stage: string; count: number; total: string }>;
  topProducts: Array<{
    productId: number;
    name: string;
    quantity: string;
    revenue: string;
  }>;
  topCustomers: Array<{
    customerId: number;
    name: string;
    orders: number;
    revenue: string;
  }>;
  recentActions: Array<{
    id: number;
    action: string;
    entity: string;
    entityId?: number | null;
    user: string;
    createdAt: string;
  }>;
}

export const getDashboardSummary = async (params?: {
  from?: string;
  to?: string;
}) =>
  (
    await api.get<{ data: DashboardSummary }>('/dashboard/summary', { params })
  ).data.data;
export const getDashboardCharts = async (params?: {
  from?: string;
  to?: string;
}) =>
  (
    await api.get<{ data: DashboardCharts }>('/dashboard/charts', { params })
  ).data.data;

// --- Notifications (FR-7) ---
export interface Notification {
  id: number;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const getNotifications = async () =>
  (
    await api.get<{
      data: Notification[];
      meta: Meta & { unread: number };
    }>('/notifications', { params: { limit: 15 } })
  ).data;
export const markNotificationsRead = async (body: {
  ids?: number[];
  all?: boolean;
}) => (await api.patch('/notifications/read', body)).data.data;

// --- Global search (FR-10.1) ---
export interface SearchResults {
  customers: Array<{ id: number; name: string; phone?: string | null }>;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    barcode?: string | null;
  }>;
  orders: Array<{
    id: number;
    number: string;
    status: string;
    customer?: { name: string };
  }>;
  suppliers: Array<{ id: number; name: string; phone?: string | null }>;
}

export const globalSearch = async (q: string) =>
  (await api.get<{ data: SearchResults }>('/search', { params: { q } })).data
    .data;

// --- Reports (FR-6) ---
export interface ReportSection {
  title: string;
  columns: Array<{
    key: string;
    label: string;
    align?: 'left' | 'right';
    money?: boolean;
  }>;
  rows: Array<Record<string, string | number | null>>;
}

export interface Report {
  slug: string;
  title: string;
  period?: { start: string; end: string };
  sections: ReportSection[];
}

export const getReport = async (
  slug: string,
  params: Record<string, string | undefined>,
) => (await api.get<{ data: Report }>(`/reports/${slug}`, { params })).data.data;

export const downloadReport = async (
  slug: string,
  format: 'xlsx' | 'pdf',
  params: Record<string, string | undefined>,
) => {
  const res = await api.get(`/reports/${slug}`, {
    params: { ...params, format },
    responseType: 'blob',
  });
  return res.data as Blob;
};

// --- Audit (FR-10.2) ---
export interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entityId?: number | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string };
}

export const getAuditLog = async (params: {
  page?: number;
  userId?: number;
  action?: string;
  from?: string;
  to?: string;
}) =>
  (await api.get<{ data: AuditRow[]; meta: Meta }>('/audit', { params })).data;

// --- Users (FR-0.3) ---
export interface AppUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'accountant' | 'warehouse' | 'sales' | 'hr';
  isActive: boolean;
  createdAt: string;
}

export const getUsers = async (params: {
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
}) =>
  (await api.get<{ data: AppUser[]; meta: Meta }>('/users', { params })).data;
export const createUser = async (body: Record<string, unknown>) =>
  (await api.post<{ data: AppUser }>('/users', body)).data.data;
export const updateUser = async (id: number, body: Record<string, unknown>) =>
  (await api.patch<{ data: AppUser }>(`/users/${id}`, body)).data.data;

// --- Settings (FR-9) ---
export interface AppSettings {
  companyName: string;
  address?: string | null;
  phone?: string | null;
  inn?: string | null;
  bankDetails?: string | null;
  invoiceFooter?: string | null;
  logoPath?: string | null;
  allowNegativeBalance: boolean;
}

export const getSettings = async () =>
  (await api.get<{ data: AppSettings }>('/settings')).data.data;
/** Public brand info (company name + logo) — no auth required. */
export const getPublicSettings = async () =>
  (
    await api.get<{ data: { companyName: string; logoPath: string | null } }>(
      '/settings/public',
    )
  ).data.data;
export const updateSettings = async (body: Partial<AppSettings>) =>
  (await api.patch<{ data: AppSettings }>('/settings', body)).data.data;
export const uploadLogo = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return (
    await api.post<{ data: AppSettings }>('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data.data;
};
