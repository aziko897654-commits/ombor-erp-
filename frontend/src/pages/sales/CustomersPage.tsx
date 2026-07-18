import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
  type Customer,
} from '@/api/sales';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { ColumnsToggle } from '@/components/ui/columns-toggle';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SortToggle, type SortDir } from '@/components/ui/sort-toggle';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { confirmDialog } from '@/lib/confirm';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = { name: '', phone: '', email: '', address: '', note: '' };

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortDir>('desc');
  // TASK-008: null = auto (show only when data exists on this page)
  const [emailCol, setEmailCol] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['customers', page, search, sort],
    queryFn: () => getCustomers({ page, search: search || undefined, sort }),
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<Customer>) =>
      editing ? updateCustomer(editing.id, payload) : createCustomer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setListError('');
    },
    onError: (err) => setListError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      note: c.note ?? '',
    });
    setError('');
    setDialogOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      note: form.note || undefined,
    });
  };

  const showEmail = emailCol ?? (list?.data.some((c) => c.email) ?? false);
  const colCount = showEmail ? 5 : 4;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('customers.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('customers.new')}
        </Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          className="w-64"
          placeholder={t('customers.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SortToggle
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
        />
        <ColumnsToggle
          columns={[
            {
              key: 'email',
              label: 'Email',
              visible: showEmail,
              onToggle: setEmailCol,
            },
          ]}
        />
      </div>
      {listError && <p className="mb-2 text-sm text-destructive">{listError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('common.phone')}</TableHead>
            {showEmail && <TableHead>Email</TableHead>}
            <TableHead>{t('common.address')}</TableHead>
            <TableHead className="w-24">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="p-0">
                <EmptyState
                  filtered={!!search}
                  onAction={
                    search
                      ? () => {
                          setSearch('');
                          setPage(1);
                        }
                      : openCreate
                  }
                  actionLabel={search ? undefined : `+ ${t('customers.new')}`}
                />
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                {showEmail && <TableCell>{c.email ?? '—'}</TableCell>}
                <TableCell className="text-muted-foreground">{c.address ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.edit')}
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.delete')}
                      disabled={removeMutation.isPending}
                      onClick={async () => {
                        if (
                          await confirmDialog(t('customers.deleteConfirm'), {
                            tone: 'danger',
                            confirmLabel: t('common.delete'),
                          })
                        ) {
                          removeMutation.mutate(c.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {list?.meta && (
        <Pagination
          page={list.meta.page}
          limit={list.meta.limit}
          total={list.meta.total}
          onPageChange={setPage}
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? t('customers.editTitle') : t('customers.new')}
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
              <Label>{t('common.phone')}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.address')}</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.note')}</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
