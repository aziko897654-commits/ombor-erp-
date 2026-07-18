import { Download } from 'lucide-react';
import { useState } from 'react';
import { downloadReport } from '@/api/system';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface Props {
  /** report endpoint slug, e.g. 'transactions', 'payments' */
  slug: string;
  /** extra query params forwarded to the report (from/to/month...) */
  params?: Record<string, string | undefined>;
}

/**
 * TASK-022: Excel/PDF export buttons for table pages, backed by the
 * existing /reports/:slug endpoints.
 */
export function ExportMenu({ slug, params = {} }: Props) {
  const [busy, setBusy] = useState(false);

  const download = async (format: 'xlsx' | 'pdf') => {
    setBusy(true);
    try {
      const blob = await downloadReport(slug, format, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${slug}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => download('xlsx')}
      >
        <Download className="h-4 w-4" /> Excel
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label={`${t('common.export')} PDF`}
        onClick={() => download('pdf')}
      >
        <Download className="h-4 w-4" /> PDF
      </Button>
    </div>
  );
}
