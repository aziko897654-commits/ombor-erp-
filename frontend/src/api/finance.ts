import { api } from './client';
import type { Meta } from './warehouse';

export type AccountType = 'cash' | 'bank';
export type TxType = 'income' | 'expense';
export type TxSource = 'manual' | 'payment' | 'salary' | 'advance' | 'transfer';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  openingBalance: string;
  balance: string;
}

export interface TxCategory {
  id: number;
  name: string;
  type: TxType;
  _count?: { transactions: number };
}

export interface Transaction {
  id: number;
  date: string;
  type: TxType;
  amount: string;
  source: TxSource;
  refId?: number | null;
  note?: string | null;
  account: { id: number; name: string; type: AccountType };
  category: { id: number; name: string; type: TxType };
}

export interface BalanceSummary {
  accounts: Account[];
  total: string;
  period: { from: string; to: string; label: string };
  flow: { income: string; expense: string; net: string };
}

export interface DebtRow {
  id: number;
  name: string;
  phone: string | null;
  debt: string;
}

export interface Debts {
  debtors: DebtRow[];
  creditors: DebtRow[];
}

export interface Payment {
  id: number;
  date: string;
  direction: 'in' | 'out';
  amount: string;
  note?: string | null;
  account?: { id: number; name: string };
  customer?: { id: number; name: string } | null;
  supplier?: { id: number; name: string } | null;
  order?: { id: number; number: string; total: string } | null;
  purchase?: { id: number; number: string; total: string } | null;
}

export interface Invoice {
  id: number;
  number: string;
  orderId: number;
  status: InvoiceStatus;
  /** TASK-007: derived on the server — 'partial' when 0 < paid < total */
  displayStatus: InvoiceStatus | 'partial';
  issuedAt: string;
  paidAt?: string | null;
  paidTotal?: string;
  order?: {
    id: number;
    number: string;
    total: string;
    createdAt: string;
    customer: { id: number; name: string };
  };
}

export interface MoneyTransfer {
  id: number;
  date: string;
  amount: string;
  note?: string | null;
  fromAccount: { id: number; name: string };
  toAccount: { id: number; name: string };
}

// --- Accounts ---
export const getAccounts = async () =>
  (await api.get<{ data: Account[] }>('/accounts')).data.data;
export const createAccount = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Account }>('/accounts', body)).data.data;

// --- Categories ---
export const getTxCategories = async (type?: TxType) =>
  (
    await api.get<{ data: TxCategory[] }>('/tx-categories', {
      params: type ? { type } : {},
    })
  ).data.data;
export const createTxCategory = async (body: { name: string; type: TxType }) =>
  (await api.post<{ data: TxCategory }>('/tx-categories', body)).data.data;

// --- Transactions ---
export const getTransactions = async (params: {
  page?: number;
  limit?: number;
  type?: TxType;
  accountId?: number;
  source?: TxSource;
  sort?: 'asc' | 'desc';
  sortBy?: string;
}) =>
  (
    await api.get<{ data: Transaction[]; meta: Meta }>('/transactions', {
      params,
    })
  ).data;
export const createTransaction = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Transaction }>('/transactions', body)).data.data;
export const deleteTransaction = async (id: number) =>
  (await api.delete(`/transactions/${id}`)).data.data;

// --- Balance / debts ---
export const getBalanceSummary = async (params?: { from?: string; to?: string }) =>
  (
    await api.get<{ data: BalanceSummary }>('/finance/balance', { params })
  ).data.data;
export const getDebts = async () =>
  (await api.get<{ data: Debts }>('/finance/debts')).data.data;

export interface DebtAgingRow {
  customerId: number;
  name: string;
  d0_30: string;
  d31_60: string;
  d61_90: string;
  d90plus: string;
  total: string;
}
export const getDebtAging = async () =>
  (await api.get<{ data: DebtAgingRow[] }>('/finance/debts/aging')).data.data;

// --- Payments ---
export const getPayments = async (params: {
  page?: number;
  limit?: number;
  direction?: 'in' | 'out';
  sort?: 'asc' | 'desc';
}) =>
  (await api.get<{ data: Payment[]; meta: Meta }>('/payments', { params })).data;
export const createPayment = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Payment }>('/payments', body)).data.data;
export const deletePayment = async (id: number) =>
  (await api.delete(`/payments/${id}`)).data.data;

// --- Transfers ---
export const getMoneyTransfers = async (params: {
  page?: number;
  sort?: 'asc' | 'desc';
}) =>
  (
    await api.get<{ data: MoneyTransfer[]; meta: Meta }>('/finance/transfers', {
      params,
    })
  ).data;
export const createMoneyTransfer = async (body: Record<string, unknown>) =>
  (await api.post<{ data: MoneyTransfer }>('/finance/transfers', body)).data
    .data;

// --- Invoices ---
export const getInvoices = async (params: {
  page?: number;
  status?: InvoiceStatus;
  sort?: 'asc' | 'desc';
}) =>
  (await api.get<{ data: Invoice[]; meta: Meta }>('/invoices', { params })).data;
export const createInvoice = async (orderId: number) =>
  (await api.post<{ data: Invoice }>('/invoices', { orderId })).data.data;
export const sendInvoice = async (id: number) =>
  (
    await api.patch<{ data: Invoice }>(`/invoices/${id}/status`, {
      status: 'sent',
    })
  ).data.data;
export const downloadInvoicePdf = async (id: number) => {
  const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
  return res.data as Blob;
};
