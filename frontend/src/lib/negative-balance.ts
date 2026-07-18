import type { AxiosError } from 'axios';
import { confirmDialog } from './confirm';
import { t } from './i18n';

/**
 * TASK-001: money-out submissions (manual expense, outgoing payment,
 * transfer) come back 409 when the account would go negative and the
 * "allow negative balance" setting is on. Wraps the first attempt,
 * turns that 409 into a confirm dialog, and resubmits with force=true
 * if the user accepts. A hard 400 (setting off) just propagates as a
 * normal error for the caller's existing onError handler.
 */
export async function submitWithBalanceConfirm<T>(
  submit: (force: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await submit(false);
  } catch (err) {
    const status = (err as AxiosError).response?.status;
    if (status === 409) {
      const message =
        ((err as AxiosError).response?.data as { message?: string })
          ?.message ?? '';
      const proceed = await confirmDialog(message, {
        title: t('common.balanceWarningTitle'),
        confirmLabel: t('common.continueAnyway'),
        tone: 'danger',
      });
      if (proceed) return submit(true);
    }
    throw err;
  }
}
