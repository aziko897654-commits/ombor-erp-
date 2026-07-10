import { Construction } from 'lucide-react';
import { t } from '@/lib/i18n';

interface Props {
  titleKey: string;
  stage: number;
}

/** Temporary page for modules that arrive in later stages (TZ section 10). */
export function PlaceholderPage({ titleKey, stage }: Props) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
      <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
        <Construction className="h-10 w-10" />
        <p>{t('common.comingSoon')}</p>
        <p className="text-sm">Bosqich {stage}</p>
      </div>
    </div>
  );
}
