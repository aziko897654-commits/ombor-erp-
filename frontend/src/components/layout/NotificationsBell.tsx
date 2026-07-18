import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationsRead } from '@/api/system';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** FR-7.1: bell + unread count; the 60s polling drives the sweep too. */
export function NotificationsBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.meta.unread ?? 0;

  const openNotification = (id: number, link?: string | null) => {
    markRead.mutate({ ids: [id] });
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        title={t('common.notifications')}
        aria-label={t('common.notifications')}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={t('common.notifications')}
          className="absolute right-0 top-11 z-50 w-96 rounded-lg border bg-background shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">
              {t('notifications.title')}
            </span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => markRead.mutate({ all: true })}
              >
                {t('notifications.markAll')}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data?.data.length ?? 0) === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('notifications.empty')}
              </p>
            ) : (
              data?.data.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openNotification(n.id, n.link)}
                  className={cn(
                    'block w-full border-b px-4 py-2.5 text-left last:border-0 hover:bg-accent',
                    !n.isRead && 'bg-primary/5',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={cn('text-sm', !n.isRead && 'font-semibold')}
                    >
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {n.message}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
