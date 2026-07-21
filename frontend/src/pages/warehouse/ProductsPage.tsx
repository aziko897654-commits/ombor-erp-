import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  Tags,
  TrendingDown,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createProduct,
  getCategories,
  getLowStock,
  getProducts,
  getWarehouses,
  updateProduct,
  writeoff,
  type Product,
} from '@/api/warehouse';
import { CategoriesDialog } from '@/pages/warehouse/CategoriesDialog';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/ui/category-badge';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/ui/export-menu';
import { TableSkeleton } from '@/components/ui/skeleton';
import { nextSort, type ColumnSort } from '@/components/ui/sortable-head';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { apiErrorMessage, formatMoney, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const UNITS = ['dona', 'kg', 'litr', 'metr'];

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  categoryId: '',
  unit: 'dona',
  costPrice: '',
  salePrice: '',
  minStock: '0',
};

export function ProductsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'warehouse';
  const queryClient = useQueryClient();

  // deep-linked from the low-stock notification / dashboard card /
  // warehouse row click (?warehouse=id)
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState(
    searchParams.get('warehouse') ?? '',
  );

  const changeWarehouse = (value: string) => {
    setWarehouseId(value);
    setPage(1);
    // keep the URL shareable, mirroring the lowStock param
    const next = new URLSearchParams(searchParams);
    if (value) next.set('warehouse', value);
    else next.delete('warehouse');
    setSearchParams(next, { replace: true });
  };
  const [sort, setSort] = useState<ColumnSort>({ by: 'name', dir: 'asc' });
  const [lowStockOnly, setLowStockOnly] = useState(
    searchParams.get('lowStock') === '1',
  );

  const toggleLowStock = (value: boolean) => {
    setLowStockOnly(value);
    setPage(1);
    // keep the URL in sync so the filter survives refresh/share
    const next = new URLSearchParams(searchParams);
    if (value) next.set('lowStock', '1');
    else next.delete('lowStock');
    setSearchParams(next, { replace: true });
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [writeoffFor, setWriteoffFor] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
    enabled: canEdit,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: canEdit,
  });
  const { data: list, isLoading } = useQuery({
    queryKey: ['products', page, limit, search, warehouseId, sort],
    queryFn: () =>
      getProducts({
        page,
        limit,
        search: search || undefined,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        sort: sort.dir,
        sortBy: sort.by,
      }),
    enabled: !lowStockOnly,
  });

  const onSort = (key: string) => {
    setSort((s) => nextSort(s, key));
    setPage(1);
  };
  const { data: lowStock } = useQuery({
    queryKey: ['products-low-stock'],
    queryFn: getLowStock,
    enabled: canEdit && lowStockOnly,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing ? updateProduct(editing.id, payload) : createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      closeDialog();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? '',
      categoryId: String(p.categoryId),
      unit: p.unit,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      minStock: p.minStock,
    });
    setError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    saveMutation.mutate({
      name: form.name,
      sku: form.sku,
      barcode: form.barcode || undefined,
      categoryId: Number(form.categoryId),
      unit: form.unit,
      costPrice: Number(form.costPrice),
      salePrice: Number(form.salePrice),
      minStock: Number(form.minStock || 0),
    });
  };

  const rows = lowStockOnly ? (lowStock ?? []) : (list?.data ?? []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('products.title')}</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tags className="h-4 w-4" /> {t('products.categories')}
            </Button>
            <Button data-new-record onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t('products.new')}
            </Button>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          className="w-64"
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {canEdit && (
          <>
            <Select
              className="w-48"
              value={warehouseId}
              onChange={(e) => changeWarehouse(e.target.value)}
            >
              <option value="">{t('common.all')} omborlar</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <Button
              variant={lowStockOnly ? 'default' : 'outline'}
              onClick={() => toggleLowStock(!lowStockOnly)}
            >
              <AlertTriangle className="h-4 w-4" /> {t('products.lowStockOnly')}
            </Button>
            <div className="ml-auto">
              <ExportMenu slug="stock" />
            </div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5"><SortBtn label={t('common.name')} k="name" sort={sort} onSort={onSort} /></th>
              <th className="px-3 py-2.5"><SortBtn label={t('products.sku')} k="sku" sort={sort} onSort={onSort} /></th>
              <th className="px-3 py-2.5"><SortBtn label={t('products.category')} k="category" sort={sort} onSort={onSort} /></th>
              <th className="px-3 py-2.5">{t('products.unit')}</th>
              <th className="px-3 py-2.5">{t('products.warehousesCol')}</th>
              <th className="px-3 py-2.5 text-right">{t('products.stock')}</th>
              <th className="px-3 py-2.5 text-right"><SortBtn label={t('products.avgCost')} k="avgCost" sort={sort} onSort={onSort} /></th>
              <th className="px-3 py-2.5 text-right"><SortBtn label={t('products.salePrice')} k="salePrice" sort={sort} onSort={onSort} /></th>
              {canEdit && <th className="px-3 py-2.5">{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && !lowStockOnly ? (
              <TableSkeleton rows={8} cols={9} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-0">
                  <EmptyState
                    filtered={!!search || !!warehouseId || lowStockOnly}
                    onAction={
                      search || warehouseId || lowStockOnly
                        ? () => {
                            setSearch('');
                            changeWarehouse('');
                            toggleLowStock(false);
                            setPage(1);
                          }
                        : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const stockNum = Number(p.stock ?? 0);
                const low = stockNum <= Number(p.minStock);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      {canEdit ? (
                        <Link to={`/products/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{p.name}</span>
                      )}
                      {!p.isActive && (
                        <Badge variant="outline" className="ml-2">
                          {t('common.inactive')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.sku}</td>
                    <td className="px-3 py-2.5">
                      <CategoryBadge name={p.category?.name} />
                    </td>
                    <td className="px-3 py-2.5">{p.unit}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {p.warehouses?.length
                        ? p.warehouses.map((w, i) => (
                            <span key={w.warehouseId} className="whitespace-nowrap">
                              {i > 0 && <br />}
                              {w.name}: {formatQty(w.qty)}
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={low ? 'font-semibold text-destructive' : ''}>
                        {formatQty(p.stock ?? 0)}
                      </span>
                      {low && (
                        <Badge variant="destructive" className="ml-1.5">
                          {t('products.lowStock')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(p.avgCost)}</td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(p.salePrice)}</td>
                    {canEdit && (
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('products.writeoff')}
                            aria-label={t('products.writeoff')}
                            onClick={() => setWriteoffFor(p)}
                          >
                            <TrendingDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!lowStockOnly && list?.meta && (
        <Pagination
          page={list.meta.page}
          limit={list.meta.limit}
          total={list.meta.total}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editing ? t('products.editTitle') : t('products.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('common.name')} *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('products.sku')} *</Label>
              <Input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('products.barcode')}</Label>
              <Input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('products.category')} *</Label>
              <Select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">—</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('products.unit')} *</Label>
              <Select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t('products.costPrice')} *</Label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('products.salePrice')} *</Label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('products.minStock')}</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </div>
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) =>
                  setEditing({ ...editing, isActive: e.target.checked })
                }
              />
              <Label htmlFor="isActive">{t('common.active')}</Label>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      <CategoriesDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <WriteoffDialog
        product={writeoffFor}
        onClose={() => setWriteoffFor(null)}
        warehouses={warehouses ?? []}
      />
    </div>
  );
}

function WriteoffDialog({
  product,
  onClose,
  warehouses,
}: {
  product: Product | null;
  onClose: () => void;
  warehouses: Array<{ id: number; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: writeoff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      onClose();
      setWarehouseId('');
      setQuantity('');
      setReason('');
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError('');
    mutation.mutate({
      productId: product.id,
      warehouseId: Number(warehouseId),
      quantity: Number(quantity),
      reason,
    });
  };

  return (
    <Dialog
      open={product !== null}
      onClose={onClose}
      title={`${t('products.writeoff')}: ${product?.name ?? ''}`}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>{t('purchases.warehouse')} *</Label>
          <Select
            required
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('common.quantity')} *</Label>
          <Input
            required
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('products.writeoffReason')} *</Label>
          <Input required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('products.writeoff')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** TASK-021: sort button for this page's raw <th> cells. */
function SortBtn({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: string;
  sort: ColumnSort;
  onSort: (key: string) => void;
}) {
  const active = sort.by === k;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-label={`${label} — saralash`}
      className={cn(
        'inline-flex items-center gap-1 uppercase hover:text-foreground',
        active && 'text-foreground',
      )}
    >
      {label}
      {active ? (
        sort.dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}
