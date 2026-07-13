import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { changePasswordRequest } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

const empty = { oldPassword: '', newPassword: '', confirm: '' };

/** FR-0.4: change own password (current password required). */
export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      changePasswordRequest(form.oldPassword, form.newPassword),
    onSuccess: () => {
      toast(t('profile.passwordChanged'), 'success');
      setForm(empty);
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) {
      setError(t('profile.passwordTooShort'));
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError(t('profile.passwordMismatch'));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('profile.changePassword')}>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>{t('profile.oldPassword')} *</Label>
          <Input
            required
            type="password"
            value={form.oldPassword}
            onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('profile.newPassword')} *</Label>
          <Input
            required
            type="password"
            minLength={8}
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('profile.confirmPassword')} *</Label>
          <Input
            required
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
