import { api } from './client';

export interface Meta {
  page: number;
  limit: number;
  total: number;
}

export interface Warehouse {
  id: number;
  name: string;
  address?: string | null;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  _count?: { products: number };
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: number;
  category?: Category;
  unit: string;
  costPrice: string;
  avgCost: string;
  salePrice: string;
  minStock: string;
  isActive: boolean;
  stock?: string;
  totalStock?: string;
  stockByWarehouse?: Array<{
    warehouseId: number;
    warehouseName: string;
    stock: string;
  }>;
}

export interface StockMovementRow {
  id: number;
  type: string;
  quantity: string;
  reason?: string | null;
  refType?: string | null;
  refId?: number | null;
  createdAt: string;
  warehouse: { id: number; name: string };
  user?: { id: number; firstName: string; lastName: string } | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  purchases?: Purchase[];
  stats?: {
    purchasesTotal: string;
    returnsTotal: string;
    paymentsTotal: string;
    debt: string;
  };
}

export interface PurchaseItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string; unit: string };
  quantity: string;
  costPrice: string;
}

export interface Purchase {
  id: number;
  number: string;
  supplierId: number;
  supplier?: { id: number; name: string };
  warehouseId: number;
  warehouse?: { id: number; name: string };
  date: string;
  total: string;
  note?: string | null;
  items?: PurchaseItem[];
  returns?: Array<{ id: number; number: string; total: string; date: string }>;
}

export interface PurchaseReturn {
  id: number;
  number: string;
  purchaseId: number;
  purchase?: { id: number; number: string; supplier?: { id: number; name: string } };
  warehouse?: { id: number; name: string };
  date: string;
  total: string;
  note?: string | null;
  items?: Array<{
    id: number;
    product: { id: number; name: string; sku: string; unit: string };
    quantity: string;
    costPrice: string;
  }>;
}

export interface StockTransfer {
  id: number;
  number: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  date: string;
  note?: string | null;
  items?: Array<{
    product: { id: number; name: string; sku: string; unit: string };
    quantity: string;
  }>;
}

export interface StockCountItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string; unit: string };
  systemQty: string;
  actualQty: string;
  diff: string;
}

export interface StockCount {
  id: number;
  number: string;
  warehouseId: number;
  warehouse?: { id: number; name: string };
  date: string;
  status: 'draft' | 'completed';
  note?: string | null;
  items?: StockCountItem[];
}

// --- Warehouses ---
export const getWarehouses = async (all = false) =>
  (await api.get<{ data: Warehouse[] }>(`/warehouses${all ? '?all=true' : ''}`)).data.data;
export const createWarehouse = async (body: Partial<Warehouse>) =>
  (await api.post('/warehouses', body)).data.data;
export const updateWarehouse = async (id: number, body: Partial<Warehouse>) =>
  (await api.patch(`/warehouses/${id}`, body)).data.data;

// --- Categories ---
export const getCategories = async () =>
  (await api.get<{ data: Category[] }>('/categories')).data.data;
export const createCategory = async (name: string) =>
  (await api.post('/categories', { name })).data.data;
export const updateCategory = async (id: number, name: string) =>
  (await api.patch(`/categories/${id}`, { name })).data.data;
export const deleteCategory = async (id: number) =>
  (await api.delete(`/categories/${id}`)).data.data;

// --- Products ---
export const getProducts = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  warehouseId?: number;
}) =>
  (
    await api.get<{ data: Product[]; meta: Meta }>('/products', { params })
  ).data;
export const getLowStock = async () =>
  (await api.get<{ data: Product[] }>('/products/low-stock')).data.data;
export const getProduct = async (id: number) =>
  (await api.get<{ data: Product }>(`/products/${id}`)).data.data;
export const getProductMovements = async (id: number, page = 1) =>
  (
    await api.get<{ data: StockMovementRow[]; meta: Meta }>(
      `/products/${id}/movements`,
      { params: { page } },
    )
  ).data;
export const createProduct = async (body: Record<string, unknown>) =>
  (await api.post('/products', body)).data.data;
export const updateProduct = async (id: number, body: Record<string, unknown>) =>
  (await api.patch(`/products/${id}`, body)).data.data;

// --- Suppliers ---
export const getSuppliers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) =>
  (
    await api.get<{ data: Supplier[]; meta: Meta }>('/suppliers', { params })
  ).data;
export const getSupplier = async (id: number) =>
  (await api.get<{ data: Supplier }>(`/suppliers/${id}`)).data.data;
export const createSupplier = async (body: Partial<Supplier>) =>
  (await api.post('/suppliers', body)).data.data;
export const updateSupplier = async (id: number, body: Partial<Supplier>) =>
  (await api.patch(`/suppliers/${id}`, body)).data.data;

// --- Purchases ---
export const getPurchases = async (params: {
  page?: number;
  limit?: number;
  supplierId?: number;
}) =>
  (
    await api.get<{ data: Purchase[]; meta: Meta }>('/purchases', { params })
  ).data;
export const getPurchase = async (id: number) =>
  (await api.get<{ data: Purchase }>(`/purchases/${id}`)).data.data;
export const createPurchase = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Purchase }>('/purchases', body)).data.data;

// --- Purchase returns ---
export const getPurchaseReturns = async (params: { page?: number }) =>
  (
    await api.get<{ data: PurchaseReturn[]; meta: Meta }>('/purchase-returns', {
      params,
    })
  ).data;
export const createPurchaseReturn = async (body: Record<string, unknown>) =>
  (await api.post<{ data: PurchaseReturn }>('/purchase-returns', body)).data.data;

// --- Stock operations ---
export const writeoff = async (body: Record<string, unknown>) =>
  (await api.post('/stock/writeoff', body)).data.data;
export const getTransfers = async (params: { page?: number }) =>
  (
    await api.get<{ data: StockTransfer[]; meta: Meta }>('/stock/transfers', {
      params,
    })
  ).data;
export const createTransfer = async (body: Record<string, unknown>) =>
  (await api.post<{ data: StockTransfer }>('/stock/transfers', body)).data.data;
export const getStockCounts = async (params: { page?: number }) =>
  (
    await api.get<{ data: StockCount[]; meta: Meta }>('/stock/counts', { params })
  ).data;
export const getStockCount = async (id: number) =>
  (await api.get<{ data: StockCount }>(`/stock/counts/${id}`)).data.data;
export const createStockCount = async (body: Record<string, unknown>) =>
  (await api.post<{ data: StockCount }>('/stock/counts', body)).data.data;
export const updateStockCount = async (id: number, body: Record<string, unknown>) =>
  (await api.patch<{ data: StockCount }>(`/stock/counts/${id}`, body)).data.data;
export const completeStockCount = async (id: number) =>
  (await api.post<{ data: StockCount }>(`/stock/counts/${id}/complete`)).data.data;

// --- Imports ---
export interface ImportPreview {
  valid: Array<Record<string, unknown>>;
  errors: Array<{ row: number; message: string }>;
  duplicates: Array<{ row: number; reason: string }>;
  summary: { total: number; valid: number; errors: number; duplicates: number };
}

export const downloadTemplate = async (type: string) => {
  const res = await api.get(`/imports/template`, {
    params: { type },
    responseType: 'blob',
  });
  return res.data as Blob;
};
export const previewImport = async (type: string, file: File) => {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  return (
    await api.post<{ data: ImportPreview }>('/imports/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data.data;
};
export const commitImport = async (
  type: string,
  rows: Array<Record<string, unknown>>,
) =>
  (
    await api.post<{
      data: { imported: number; skippedErrors: number; skippedDuplicates: number };
    }>('/imports/commit', { type, rows })
  ).data.data;
