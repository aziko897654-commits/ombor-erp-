import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getAuditLog, getUsers } from '@/api/system';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';

/** FR-10.2: audit journal with user/date/action filters. */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers({ page: 1, limit: 100 }),
  });
  const { data: list, isLoading } = useQuery({
    queryKey: ['audit', page, userId, action, from, to],
    queryFn: () =>
      getAuditLog({
        page,
        userId: userId ? Number(userId) : undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t('auditPage.title')}</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          className="w-52"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('auditPage.user')}: {t('common.all')}</option>
          {users?.data.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </Select>
        <Input
          className="w-56"
          placeholder={t('auditPage.actionFilter')}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          className="w-40"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          className="w-40"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('auditPage.user')}</TableHead>
            <TableHead>{t('auditPage.action')}</TableHead>
            <TableHead>{t('auditPage.entity')}</TableHead>
            <TableHead>{t('auditPage.details')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell>
                  {row.user.firstName} {row.user.lastName}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.action}</Badge>
                </TableCell>
                <TableCell>
                  {row.entity}
                  {row.entityId ? ` #${row.entityId}` : ''}
                </TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                  {row.details ? JSON.stringify(row.details) : '—'}
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
    </div>
  );
}
