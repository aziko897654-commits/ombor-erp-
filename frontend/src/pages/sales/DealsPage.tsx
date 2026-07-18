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
import { MoneyInput } from '@/components/ui/money-input';
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

// TASK-025: reasons offered when a card is dropped into "lost"
const LOST_REASONS = ['price', 'competitor', 'other'] as const;

/** FR-1.3: kanban funnel with drag-and-drop stage change. */
export function DealsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [boardError, setBoardError] = useState('');
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  // TASK-025: pending "dropped into lost" prompt
  const [lostPrompt, setLostPrompt] = useState<Deal | null>(null);
  const [lostReason, setLostReason] = useState<string>('price');

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
      // MoneyInput keeps raw digits; drop the decimal tail
      amount: String(Math.round(Number(deal.amount))),
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
    if (current === stage) return;
    if (stage === 'lost') {
      // TASK-025: ask why before recording the loss
      const deal = board?.[current!]?.find((d) => d.id === id);
      if (deal) {
        setLostReason('price');
        setLostPrompt(deal);
        return;
      }
    }
    stageMutation.mutate({ id, stage });
  };

  const confirmLost = () => {
    if (!lostPrompt) return;
    const reasonLabel = t(`deals.lostReasons.${lostReason}`);
    const note = lostPrompt.note
      ? `${lostPrompt.note} | ${t('deals.lostReasonLabel')}: ${reasonLabel}`
      : `${t('deals.lostReasonLabel')}: ${reasonLabel}`;
    saveLost.mutate({ id: lostPrompt.id, note });
  };

  const saveLost = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      updateDeal(id, { stage: 'lost', note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setLostPrompt(null);
      setBoardError('');
    },
    onError: (err) => {
      setLostPrompt(null);
      setBoardError(apiErrorMessage(err));
    },
  });

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
              minLength={3}
              pattern=".*\S{1}.*\S{1}.*\S{1}.*"
              title={t('deals.titleMinLength')}
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
              <MoneyInput
                required
                value={form.amount}
                onChange={(amount) => setForm({ ...form, amount })}
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

      {/* TASK-025: reason prompt when a deal lands in "lost" */}
      <Dialog
        open={!!lostPrompt}
        onClose={() => setLostPrompt(null)}
        title={t('deals.lostReasonTitle')}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {lostPrompt?.title} — {formatMoney(lostPrompt?.amount)}
          </p>
          <div className="space-y-1.5">
            <Label>{t('deals.lostReasonLabel')} *</Label>
            <Select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            >
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`deals.lostReasons.${r}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLostPrompt(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saveLost.isPending}
              onClick={confirmLost}
            >
              {saveLost.isPending ? t('common.saving') : t('deals.markLost')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
