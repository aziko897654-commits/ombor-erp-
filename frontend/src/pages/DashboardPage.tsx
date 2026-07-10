import { t } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** Stage 0 skeleton — real KPIs and charts arrive in stage 5 (FR-5). */
export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('menu.dashboard')}</h1>
      <Card className="mt-6 max-w-lg">
        <CardHeader>
          <CardTitle>
            Xush kelibsiz, {user?.firstName} {user?.lastName}!
          </CardTitle>
          <CardDescription>{t(`roles.${user?.role ?? 'admin'}`)}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          KPI kartalar, grafiklar va davr tanlagich Bosqich 5 da quriladi
          (FR-5.1 — FR-5.5).
        </CardContent>
      </Card>
    </div>
  );
}
