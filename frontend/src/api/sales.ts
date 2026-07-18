import { api } from './client';
import type { Meta } from './warehouse';

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  createdAt?: string;
}

export interface CustomerBalance {
  ordersTotal: string;
  returnsTotal: string;
  paymentsTotal: string;
  refundsTotal: string;
  debt: string;
}

export interface PaymentRow {
  id: number;
  date: string;
  direction: 'in' | 'out';
  amount: string;
  note?: string | null;
  account?: { id: number; name: string };
  order?: { id: number; number: string } | null;
}

export type DealStage = 'new' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  id: number;
  title: string;
  customerId: number;
  customer?: { id: number; name: string };
  amount: string;
  stage: DealStage;
  managerId: number;
  manager?: { id: number; firstName: string; lastName: string };
  note?: string | null;
  updatedAt: string;
}

export type DealBoard = Record<DealStage, Deal[]>;

export type OrderStatus = 'draft' | 'confirmed' | 'shipped' | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string; unit: string };
  quantity: string;
  price: string;
  cost: string;
}

export interface Order {
  id: number;
  number: string;
  customerId: number;
  customer?: { id: number; name: string };
  warehouseId: number;
  warehouse?: { id: number; name: string };
  status: OrderStatus;
  subtotal: string;
  discount: string;
  total: string;
  createdAt: string;
  items?: OrderItem[];
  invoice?: { id: number; number: string; status: string } | null;
  returns?: Array<{ id: number; number: string; total: string; date: string }>;
  /** Stage 3: payment status (in − out, computed server-side). */
  paidTotal?: string;
  payments?: PaymentRow[];
}

export interface CustomerDetail extends Customer {
  orders: Order[];
  payments: PaymentRow[];
  balance: CustomerBalance;
}

export interface SalesReturn {
  id: number;
  number: string;
  orderId: number;
  order?: {
    id: number;
    number: string;
    customer?: { id: number; name: string };
  };
  warehouse?: { id: number; name: string };
  date: string;
  total: string;
  note?: string | null;
  items?: Array<{
    id: number;
    product: { id: number; name: string; sku: string; unit: string };
    quantity: string;
    price: string;
  }>;
}

// --- Customers ---
export const getCustomers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'asc' | 'desc';
}) =>
  (
    await api.get<{ data: Customer[]; meta: Meta }>('/customers', { params })
  ).data;
export const getCustomer = async (id: number) =>
  (await api.get<{ data: CustomerDetail }>(`/customers/${id}`)).data.data;
export const createCustomer = async (body: Partial<Customer>) =>
  (await api.post<{ data: Customer }>('/customers', body)).data.data;
export const updateCustomer = async (id: number, body: Partial<Customer>) =>
  (await api.patch<{ data: Customer }>(`/customers/${id}`, body)).data.data;
export const deleteCustomer = async (id: number) =>
  (await api.delete(`/customers/${id}`)).data.data;

// --- Deals ---
export const getDealBoard = async () =>
  (await api.get<{ data: DealBoard }>('/deals/board')).data.data;
export const createDeal = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Deal }>('/deals', body)).data.data;
export const updateDeal = async (id: number, body: Record<string, unknown>) =>
  (await api.patch<{ data: Deal }>(`/deals/${id}`, body)).data.data;

// --- Orders ---
export const getOrders = async (params: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  customerId?: number;
  sort?: 'asc' | 'desc';
  sortBy?: string;
}) => (await api.get<{ data: Order[]; meta: Meta }>('/orders', { params })).data;
export const getOrder = async (id: number) =>
  (await api.get<{ data: Order }>(`/orders/${id}`)).data.data;
export const createOrder = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Order }>('/orders', body)).data.data;
export const updateOrder = async (id: number, body: Record<string, unknown>) =>
  (await api.patch<{ data: Order }>(`/orders/${id}`, body)).data.data;
export const deleteOrder = async (id: number) =>
  (await api.delete(`/orders/${id}`)).data.data;
export const confirmOrder = async (id: number) =>
  (await api.post<{ data: Order }>(`/orders/${id}/confirm`)).data.data;
export const cancelOrder = async (id: number) =>
  (await api.post<{ data: Order }>(`/orders/${id}/cancel`)).data.data;
export const shipOrder = async (id: number) =>
  (await api.post<{ data: Order }>(`/orders/${id}/ship`)).data.data;

// FR-1.9: delivery note PDF
export const downloadDeliveryNote = async (orderId: number) => {
  const res = await api.get(`/orders/${orderId}/delivery-note`, {
    responseType: 'blob',
  });
  return res.data as Blob;
};

// --- Sales returns ---
export const getSalesReturns = async (params: {
  page?: number;
  sort?: 'asc' | 'desc';
}) =>
  (
    await api.get<{ data: SalesReturn[]; meta: Meta }>('/sales-returns', {
      params,
    })
  ).data;
export const createSalesReturn = async (body: Record<string, unknown>) =>
  (await api.post<{ data: SalesReturn }>('/sales-returns', body)).data.data;
