import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import {
  archiveSupplier,
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
  type Supplier,
} from '@/api/warehouse';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColumnsToggle } from '@/components/ui/columns-toggle';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
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
import { useAuth } from '@/lib/auth';
import { confirmDialog } from '@/lib/confirm';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = { name: '', phone: '', email: '', address: '', note: '' };

export function SuppliersPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'warehouse';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  // TASK-008: null = auto (show only when data exists on this page)
  const [emailCol, setEmailCol] = useState<boolean | null>(null);

  const { data: list, isLoading } = useQuery({
    queryKey: ['suppliers', page, search, sort],
    queryFn: () => getSuppliers({ page, search: search || undefined, sort }),
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<Supplier>) =>
      editing ? updateSupplier(editing.id, payload) : createSupplier(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  // TASK-009: hard delete when history-free; a 409 offers archiving
  const handleDelete = async (s: Supplier) => {
    setListError('');
    const ok = await confirmDialog(t('suppliers.deleteConfirm'), {
      tone: 'danger',
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await deleteSupplier(s.id);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err) {
      if ((err as AxiosError).response?.status === 409) {
        const message = apiErrorMessage(err);
        const archive = await confirmDialog(message, {
          title: t('suppliers.archiveTitle'),
          confirmLabel: t('suppliers.archive'),
        });
        if (archive) {
          try {
            await archiveSupplier(s.id);
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          } catch (e2) {
            setListError(apiErrorMessage(e2));
          }
        }
      } else {
        setListError(apiErrorMessage(err));
      }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      note: s.note ?? '',
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

  const showEmail = emailCol ?? (list?.data.some((s) => s.email) ?? false);
  const colCount = (showEmail ? 4 : 3) + (canEdit ? 1 : 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('suppliers.title')}</h1>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('suppliers.new')}
          </Button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          className="w-64"
          placeholder={t('common.search')}
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
            {canEdit && <TableHead className="w-24">{t('common.actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton rows={6} cols={colCount} />
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
                      : canEdit
                        ? openCreate
                        : undefined
                  }
                  actionLabel={
                    search || !canEdit ? undefined : `+ ${t('suppliers.new')}`
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link to={`/suppliers/${s.id}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                  {s.isActive === false && (
                    <Badge variant="secondary" className="ml-2">
                      {t('suppliers.archived')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{s.phone ?? '—'}</TableCell>
                {showEmail && <TableCell>{s.email ?? '—'}</TableCell>}
                <TableCell className="text-muted-foreground">{s.address ?? '—'}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.edit')}
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.delete')}
                        onClick={() => handleDelete(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
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
        title={editing ? t('suppliers.editTitle') : t('suppliers.new')}
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
