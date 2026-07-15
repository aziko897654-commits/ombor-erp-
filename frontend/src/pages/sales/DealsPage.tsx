import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type DragEvent, type FormEvent } from 'react';
import {
  createDeal,
  getCustomers,
  getDealBoard,
  updateDeal,
  type Deal,
  type DealStage,
} from '@/api/sales';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiErrorMessage, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const STAGES: DealStage[] = ['new', 'negotiation', 'won', 'lost'];

const STAGE_ACCENT: Record<DealStage, string> = {
  new: 'border-t-blue-400',
  negotiation: 'border-t-amber-400',
  won: 'border-t-green-500',
  lost: 'border-t-red-400',
};

const emptyForm = { title: '', customerId: '', amount: '', stage: 'new', note: '' };

/** FR-1.3: kanban funnel with drag-and-drop stage change. */
export function DealsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [boardError, setBoardError] = useState('');
  const [dragOver, setDragOver] = useState<DealStage | null>(null);

  const { data: board, isLoading } = useQuery({
    queryKey: ['deals', 'board'],
    queryFn: getDealBoard,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing ? updateDeal(editing.id, payload) : createDeal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: DealStage }) =>
      updateDeal(id, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setBoardError('');
    },
    onError: (err) => setBoardError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (deal: Deal) => {
    setEditing(deal);
    setForm({
      title: deal.title,
      customerId: String(deal.customerId),
      amount: deal.amount,
      stage: deal.stage,
      note: deal.note ?? '',
    });
    setError('');
    setDialogOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    saveMutation.mutate({
      title: form.title,
      customerId: Number(form.customerId),
      amount: Number(form.amount),
      stage: form.stage,
      note: form.note || undefined,
    });
  };

  const onDrop = (e: DragEvent, stage: DealStage) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (!id) return;
    const current = STAGES.find((s) => board?.[s].some((d) => d.id === id));
    if (current !== stage) stageMutation.mutate({ id, stage });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('deals.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('deals.new')}
        </Button>
      </div>
      {boardError && <p className="mb-2 text-sm text-destructive">{boardError}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const deals = board?.[stage] ?? [];
            const sum = deals.reduce((acc, d) => acc + Number(d.amount), 0);
            return (
              <div
                key={stage}
                className={cn(
                  'flex min-h-[16rem] flex-col rounded-lg border border-t-4 bg-muted/30',
                  STAGE_ACCENT[stage],
                  dragOver === stage && 'ring-2 ring-primary/40',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, stage)}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-semibold">
                    {t(`deals.stage.${stage}`)}{' '}
                    <span className="text-muted-foreground">({deals.length})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMoney(sum)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('text/plain', String(deal.id))
                      }
                      onClick={() => openEdit(deal)}
                      className="cursor-grab rounded-md border bg-background p-3 shadow-sm transition hover:shadow"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{deal.title}</span>
                        <span className="whitespace-nowrap text-sm font-semibold">
                          {formatMoney(deal.amount)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {deal.customer?.name}
                      </p>
                      {deal.manager && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('deals.manager')}: {deal.manager.firstName}{' '}
                          {deal.manager.lastName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? t('deals.editTitle') : t('deals.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('deals.dealTitle')} *</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('deals.customer')} *</Label>
            <Combobox
              required
              value={form.customerId}
              onChange={(customerId) => setForm({ ...form, customerId })}
              placeholder={t('deals.selectCustomer')}
              options={
                customers?.data.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  hint: c.phone ?? undefined,
                })) ?? []
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('deals.amount')} *</Label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.status')}</Label>
              <Select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {t(`deals.stage.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
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
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
