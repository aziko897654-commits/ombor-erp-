import { useEffect, useState } from 'react';
import { resolveConfirm, subscribeConfirm, type ConfirmRequest } from '@/lib/confirm';
import { t } from '@/lib/i18n';
import { Button } from './button';
import { Dialog } from './dialog';

/** Renders the current confirmDialog() request, if any. Mount once. */
export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => subscribeConfirm(setRequest), []);

  return (
    <Dialog
      open={request !== null}
      onClose={() => resolveConfirm(false)}
      title={request?.title ?? t('common.confirmTitle')}
    >
      {request && (
        <>
          <p className="text-sm text-muted-foreground">{request.message}</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => resolveConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={request.tone === 'danger' ? 'destructive' : 'default'}
              onClick={() => resolveConfirm(true)}
            >
              {request.confirmLabel ?? t('common.confirmAction')}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
