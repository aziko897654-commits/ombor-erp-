import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { downloadReport, getReport } from '@/api/system';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { apiErrorMessage, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'accountant' | 'warehouse' | 'sales' | 'hr';

// FR-6.3: visibility follows the rights matrix
const REPORTS: Array<{ slug: string; roles: Role[]; monthly?: boolean }> = [
  { slug: 'finance', roles: ['admin', 'accountant'] },
  { slug: 'sales', roles: ['admin', 'sales'] },
  { slug: 'stock', roles: ['admin', 'warehouse'] },
  { slug: 'debts', roles: ['admin', 'accountant'] },
  { slug: 'payments', roles: ['admin', 'accountant'] },
  { slug: 'attendance', roles: ['admin', 'hr'], monthly: true },
  { slug: 'profit', roles: ['admin', 'accountant'] },
];

function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** FR-6: seven reports with period filter and xlsx/pdf export. */
export function ReportsPage() {
  const { user } = useAuth();
  const available = useMemo(
    () => REPORTS.filter((r) => user && r.roles.includes(user.role)),
    [user],
  );
  const [slug, setSlug] = useState(available[0]?.slug ?? 'finance');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [error, setError] = useState('');

  const active = REPORTS.find((r) => r.slug === slug);
  const params = active?.monthly ? { month } : { from, to };

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', slug, params],
    queryFn: () => getReport(slug, params),
  });

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    try {
      setError('');
      const blob = await downloadReport(slug, format, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${slug}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t('reports.title')}</h1>

      <div className="mb-4 flex flex-wrap gap-1">
        {available.map((r) => (
          <button
            key={r.slug}
            type="button"
            onClick={() => setSlug(r.slug)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition',
              slug === r.slug
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {t(`reports.names.${r.slug}`)}
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          {active?.monthly ? (
            <div className="space-y-1.5">
              <Label>{t('reports.month')}</Label>
              <Input
                type="month"
                className="w-44"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </div>
          ) : slug === 'debts' ? null : (
            <>
              <div className="space-y-1.5">
                <Label>{t('reports.period')}</Label>
                <DatePicker className="w-44" value={from} onChange={setFrom} />
              </div>
              <div className="space-y-1.5">
                <Label>&nbsp;</Label>
                <DatePicker className="w-44" value={to} onChange={setTo} />
              </div>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => handleDownload('xlsx')}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={() => handleDownload('pdf')}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        report?.sections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">{section.title}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  {section.columns.map((c) => (
                    <TableHead
                      key={c.key}
                      className={c.money || c.align === 'right' ? 'text-right' : ''}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={section.columns.length}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  section.rows.map((row, i) => {
                    const isTotal =
                      typeof row[section.columns[0].key] === 'string' &&
                      String(row[section.columns[0].key]).startsWith('JAMI');
                    return (
                      <TableRow key={i} className={isTotal ? 'font-semibold' : ''}>
                        {section.columns.map((c) => (
                          <TableCell
                            key={c.key}
                            className={
                              c.money || c.align === 'right' ? 'text-right' : ''
                            }
                          >
                            {c.money && row[c.key] !== '' && row[c.key] !== null
                              ? formatMoney(row[c.key] as string)
                              : (row[c.key] ?? '—')}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  );
}
