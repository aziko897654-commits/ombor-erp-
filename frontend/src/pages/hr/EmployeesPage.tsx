import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createDepartment,
  createEmployee,
  createPosition,
  getDepartments,
  getEmployees,
  getPositions,
  updateEmployee,
  type Employee,
} from '@/api/hr';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiErrorMessage, formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  departmentId: '',
  positionId: '',
  salary: '',
  hiredAt: '',
  status: 'active',
  firedAt: '',
};

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catalogsOpen, setCatalogsOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newPosition, setNewPosition] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => getEmployees({ page, search: search || undefined }),
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
  });
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing ? updateEmployee(editing.id, payload) : createEmployee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const departmentMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setNewDepartment('');
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const positionMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      setNewPosition('');
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setForm({
      fullName: employee.fullName,
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      departmentId: String(employee.departmentId),
      positionId: String(employee.positionId),
      salary: employee.salary,
      hiredAt: employee.hiredAt.slice(0, 10),
      status: employee.status,
      firedAt: employee.firedAt ? employee.firedAt.slice(0, 10) : '',
    });
    setError('');
    setDialogOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    saveMutation.mutate({
      fullName: form.fullName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      departmentId: Number(form.departmentId),
      positionId: Number(form.positionId),
      salary: Number(form.salary),
      hiredAt: form.hiredAt,
      ...(editing
        ? {
            status: form.status,
            firedAt:
              form.status === 'fired' && form.firedAt ? form.firedAt : undefined,
          }
        : {}),
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('employees.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setError(''); setCatalogsOpen(true); }}>
            <FolderTree className="h-4 w-4" /> {t('employees.catalogs')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('employees.new')}
          </Button>
        </div>
      </div>

      <Input
        className="mb-3 w-64"
        placeholder={t('common.search')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('employees.fullName')}</TableHead>
            <TableHead>{t('employees.department')}</TableHead>
            <TableHead>{t('employees.position')}</TableHead>
            <TableHead className="text-right">{t('employees.salary')}</TableHead>
            <TableHead>{t('employees.hiredAt')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="w-14">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <Link
                    to={`/employees/${employee.id}`}
                    className="font-medium hover:underline"
                  >
                    {employee.fullName}
                  </Link>
                </TableCell>
                <TableCell>{employee.department?.name}</TableCell>
                <TableCell>{employee.position?.name}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(employee.salary)}
                </TableCell>
                <TableCell>{formatDate(employee.hiredAt)}</TableCell>
                <TableCell>
                  <Badge
                    variant={employee.status === 'active' ? 'success' : 'destructive'}
                  >
                    {t(`employees.status.${employee.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(employee)}>
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
        title={editing ? t('employees.editTitle') : t('employees.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('employees.fullName')} *</Label>
            <Input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('employees.department')} *</Label>
              <Select
                required
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">{t('employees.selectDepartment')}</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.position')} *</Label>
              <Select
                required
                value={form.positionId}
                onChange={(e) => setForm({ ...form, positionId: e.target.value })}
              >
                <option value="">{t('employees.selectPosition')}</option>
                {positions?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('employees.salary')} *</Label>
              <Input
                required
                type="number"
                min="1"
                step="0.01"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.hiredAt')} *</Label>
              <Input
                required
                type="date"
                value={form.hiredAt}
                onChange={(e) => setForm({ ...form, hiredAt: e.target.value })}
              />
            </div>
          </div>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('common.status')}</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">{t('employees.status.active')}</option>
                  <option value="fired">{t('employees.status.fired')}</option>
                </Select>
              </div>
              {form.status === 'fired' && (
                <div className="space-y-1.5">
                  <Label>{t('employees.firedAt')}</Label>
                  <Input
                    type="date"
                    value={form.firedAt}
                    onChange={(e) => setForm({ ...form, firedAt: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={catalogsOpen}
        onClose={() => setCatalogsOpen(false)}
        title={t('employees.catalogs')}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newDepartment) departmentMutation.mutate(newDepartment);
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label>{t('employees.newDepartment')}</Label>
                <Input
                  required
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                />
              </div>
              <Button type="submit" size="icon" disabled={departmentMutation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {departments?.map((d) => (
                <div key={d.id} className="rounded-md border px-3 py-1.5 text-sm">
                  {d.name}{' '}
                  <span className="text-muted-foreground">
                    ({d._count?.employees ?? 0})
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newPosition) positionMutation.mutate(newPosition);
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label>{t('employees.newPosition')}</Label>
                <Input
                  required
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                />
              </div>
              <Button type="submit" size="icon" disabled={positionMutation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {positions?.map((p) => (
                <div key={p.id} className="rounded-md border px-3 py-1.5 text-sm">
                  {p.name}{' '}
                  <span className="text-muted-foreground">
                    ({p._count?.employees ?? 0})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </Dialog>
    </div>
  );
}
