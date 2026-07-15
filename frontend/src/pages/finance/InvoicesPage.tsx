import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Plus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createInvoice,
  downloadInvoicePdf,
  getInvoices,
  sendInvoice,
  type InvoiceStatus,
} from '@/api/finance';
import { getOrders } from '@/api/sales';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
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

const STATUS_VARIANT: Record<InvoiceStatus, 'secondary' | 'default' | 'success'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'success',
};

/** FR-3.5: invoices — create from order, sent, auto-paid, PDF print. */
export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () =>
      getInvoices({
        page,
        status: (statusFilter || undefined) as InvoiceStatus | undefined,
      }),
  });
  const { data: invoiceableOrders } = useQuery({
    queryKey: ['orders', 'invoiceable'],
    queryFn: async () => {
      const [confirmed, shipped] = await Promise.all([
        getOrders({ page: 1, limit: 100, status: 'confirmed' }),
        getOrders({ page: 1, limit: 100, status: 'shipped' }),
      ]);
      return [...confirmed.data, ...shipped.data];
    },
    enabled: dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: () => createInvoice(Number(orderId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const sendMutation = useMutation({
    mutationFn: sendInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setListError('');
    },
    onError: (err) => setListError(apiErrorMessage(err)),
  });

  const handlePdf = async (id: number, number: string) => {
    try {
      const blob = await downloadInvoicePdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setListError(apiErrorMessage(err));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('invoices.title')}</h1>
        <Button
          onClick={() => {
            setOrderId('');
            setError('');
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('invoices.new')}
        </Button>
      </div>

      <Select
        className="mb-3 w-44"
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
      >
        <option value="">{t('common.all')}</option>
        {(['draft', 'sent', 'paid'] as const).map((s) => (
          <option key={s} value={s}>
            {t(`invoices.status.${s}`)}
          </option>
        ))}
      </Select>
      {listError && <p className="mb-2 text-sm text-destructive">{listError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('invoices.order')}</TableHead>
            <TableHead>{t('orders.customer')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
            <TableHead className="text-right">{t('invoices.paid')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="w-24">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.number}</TableCell>
                <TableCell>{formatDate(invoice.issuedAt)}</TableCell>
                <TableCell>{invoice.order?.number}</TableCell>
                <TableCell>{invoice.order?.customer.name}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(invoice.order?.total)}
                </TableCell>
                <TableCell className="text-right text-green-700">
                  {formatMoney(invoice.paidTotal)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[invoice.status]}>
                    {t(`invoices.status.${invoice.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex">
                    {invoice.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('invoices.send')}
                        aria-label={t('invoices.send')}
                        disabled={sendMutation.isPending}
                        onClick={() => sendMutation.mutate(invoice.id)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('invoices.pdf')}
                      aria-label={t('invoices.pdf')}
                      onClick={() => handlePdf(invoice.id, invoice.number)}
                    >
                      <FileDown className="h-4 w-4" />
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
        title={t('invoices.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('invoices.order')} *</Label>
            <Select
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">{t('invoices.selectOrder')}</option>
              {invoiceableOrders?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} — {o.customer?.name} ({formatMoney(o.total)})
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !orderId}>
              {createMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
