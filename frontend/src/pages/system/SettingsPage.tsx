import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { assetUrl } from '@/api/client';
import { getSettings, updateSettings, uploadLogo } from '@/api/system';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = {
  companyName: '',
  address: '',
  phone: '',
  inn: '',
  bankDetails: '',
  invoiceFooter: '',
  allowNegativeBalance: false,
};

/** FR-9: company requisites + logo (used on the invoice PDF). */
export function SettingsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        inn: settings.inn ?? '',
        bankDetails: settings.bankDetails ?? '',
        invoiceFooter: settings.invoiceFooter ?? '',
        allowNegativeBalance: settings.allowNegativeBalance ?? false,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSettings({
        companyName: form.companyName,
        address: form.address || null,
        phone: form.phone || null,
        inn: form.inn || null,
        bankDetails: form.bankDetails || null,
        invoiceFooter: form.invoiceFooter || null,
        allowNegativeBalance: form.allowNegativeBalance,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMessage(t('settings.saved'));
      setError('');
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setMessage('');
    },
  });

  const logoMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMessage(t('settings.saved'));
      setError('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setMessage('');
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    saveMutation.mutate();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">{t('settings.title')}</h1>

      <form onSubmit={submit}>
        <Card className="mb-4">
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-1.5">
              <Label>{t('settings.companyName')} *</Label>
              <Input
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('common.phone')}</Label>
                <PhoneInput
                  value={form.phone}
                  onChange={(phone) => setForm({ ...form, phone })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.inn')}</Label>
                <Input
                  value={form.inn}
                  onChange={(e) => setForm({ ...form, inn: e.target.value })}
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
              <Label>{t('settings.bankDetails')}</Label>
              <Input
                value={form.bankDetails}
                onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.invoiceFooter')}</Label>
              <Input
                value={form.invoiceFooter}
                onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
              />
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <input
                id="allowNegativeBalance"
                type="checkbox"
                className="mt-0.5"
                checked={form.allowNegativeBalance}
                onChange={(e) =>
                  setForm({ ...form, allowNegativeBalance: e.target.checked })
                }
              />
              <label htmlFor="allowNegativeBalance" className="space-y-0.5">
                <span className="block text-sm font-medium">
                  {t('settings.allowNegativeBalance')}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t('settings.allowNegativeBalanceHint')}
                </span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              {message && <span className="text-sm text-green-700">{message}</span>}
              {error && <span className="text-sm text-destructive">{error}</span>}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* TASK-033: shortcut reference */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('settings.shortcuts')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {[
              ['Ctrl+K yoki /', t('settings.shortcutSearch')],
              ['N', t('settings.shortcutNew')],
              ['Esc', t('settings.shortcutEsc')],
              ['↑ ↓ Enter', t('settings.shortcutNav')],
            ].map(([keys, label]) => (
              <li key={keys} className="flex items-center gap-3">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">
                  {keys}
                </kbd>
                <span className="text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.logo')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {settings?.logoPath ? (
            <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-1">
              <img
                src={assetUrl(settings.logoPath)}
                alt={t('settings.logo')}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              —
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
            }}
          />
          <Button
            variant="outline"
            disabled={logoMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <ImageUp className="h-4 w-4" /> {t('settings.uploadLogo')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
