import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createUser, getUsers, updateUser, type AppUser } from '@/api/system';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
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
import { apiErrorMessage, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';

const ROLES = ['admin', 'accountant', 'warehouse', 'sales', 'hr'] as const;

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'sales',
  password: '',
  confirmPassword: '',
  isActive: true,
};

/** FR-0.3: admin manages users; deactivation instead of deletion. */
export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser, refresh } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['users', page, sort],
    queryFn: () => getUsers({ page, sort }),
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing ? updateUser(editing.id, payload) : createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // editing your own account must also update the header profile,
      // which is cached in the auth context since login
      if (editing && currentUser && editing.id === currentUser.id) {
        void refresh();
      }
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditing(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      password: '',
      confirmPassword: '',
      isActive: user.isActive,
    });
    setError('');
    setDialogOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    // catches both a genuine typo and the (rare) browser-autofill case
    // where the visible field text doesn't match React's own state
    if (form.password && form.password !== form.confirmPassword) {
      setError(t('users.passwordMismatch'));
      return;
    }
    mutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      role: form.role,
      ...(form.password ? { password: form.password } : {}),
      ...(editing ? { isActive: form.isActive } : {}),
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('users.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('users.new')}
        </Button>
      </div>

      <div className="mb-3 flex justify-end">
        <SortToggle
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('users.firstName')}</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>{t('users.role')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead className="w-14">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.firstName} {user.lastName}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{t(`roles.${user.role}`)}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={user.isActive ? 'active' : 'blocked'}
                    label={user.isActive ? t('common.active') : t('common.inactive')}
                  />
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.edit')}
                    onClick={() => openEdit(user)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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
        title={editing ? t('users.editTitle') : t('users.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('users.firstName')} *</Label>
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('users.lastName')} *</Label>
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('users.role')} *</Label>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('users.password')} {editing ? '' : '*'}</Label>
              <PasswordInput
                required={!editing}
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
            </div>
          </div>
          {(!editing || form.password) && (
            <div className="space-y-1.5">
              <Label>{t('users.confirmPassword')} {editing ? '' : '*'}</Label>
              <PasswordInput
                required={!editing || !!form.password}
                minLength={8}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
              />
            </div>
          )}
          {editing && (
            <div className="space-y-1.5">
              <Label>{t('common.status')}</Label>
              <Select
                value={form.isActive ? '1' : '0'}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
              >
                <option value="1">{t('common.active')}</option>
                <option value="0">{t('common.inactive')}</option>
              </Select>
            </div>
          )}
          {editing && (
            <p className="text-xs text-muted-foreground">{t('users.passwordHint')}</p>
          )}
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
