import { useQuery } from '@tanstack/react-query';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDashboardCharts, getDashboardSummary } from '@/api/system';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// dataviz palette (validated): income/expense pair + ordinal blues
const INCOME_COLOR = '#2a78d6';
const EXPENSE_COLOR = '#e34948';
const ORDINAL_BLUES = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'];
const GRID_COLOR = '#e1e0d9';
const AXIS_COLOR = '#898781';

type PresetKey = 'today' | 'week' | 'month' | 'quarter' | 'year';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: iso(now), to: iso(now) };
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
      return { from: iso(start), to: iso(now) };
    }
    case 'month':
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return {
        from: iso(new Date(now.getFullYear(), q * 3, 1)),
        to: iso(new Date(now.getFullYear(), q * 3 + 3, 0)),
      };
    }
    case 'year':
      return {
        from: iso(new Date(now.getFullYear(), 0, 1)),
        to: iso(new Date(now.getFullYear(), 11, 31)),
      };
  }
}

/** Compact so'm figures for axis ticks: 12 000 000 → "12 mln". */
function compactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} mlrd`;
  if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)} mln`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} ming`;
  return String(value);
}

/** FR-5: period picker + KPI cards with comparison + 3 charts. */
export function DashboardPage() {
  const [preset, setPreset] = useState<PresetKey | 'custom'>('month');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const range = useMemo(() => {
    if (preset === 'custom') {
      return custom.from && custom.to ? custom : presetRange('month');
    }
    return presetRange(preset);
  }, [preset, custom]);

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary', range],
    queryFn: () => getDashboardSummary(range),
  });
  const { data: charts } = useQuery({
    queryKey: ['dashboard', 'charts', range],
    queryFn: () => getDashboardCharts(range),
  });

  const presets: Array<{ key: PresetKey; label: string }> = [
    { key: 'today', label: t('dashboard.today') },
    { key: 'week', label: t('dashboard.week') },
    { key: 'month', label: t('dashboard.month') },
    { key: 'quarter', label: t('dashboard.quarter') },
    { key: 'year', label: t('dashboard.year') },
  ];

  const monthlyData =
    charts?.monthly.map((m) => ({
      month: m.month.slice(2), // "26-01"
      income: Number(m.income),
      expense: Number(m.expense),
    })) ?? [];
  const funnelData =
    charts?.funnel.map((f) => ({
      stage: t(`deals.stage.${f.stage}`),
      count: f.count,
      total: Number(f.total),
    })) ?? [];
  const topData =
    charts?.topProducts.map((p) => ({
      name: p.name,
      revenue: Number(p.revenue),
    })) ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('menu.dashboard')}</h1>
        <div className="flex flex-wrap items-center gap-1">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition',
                preset === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-2 flex items-center gap-1">
            <Input
              type="date"
              className="h-8 w-36"
              value={custom.from}
              onChange={(e) => {
                setCustom((c) => ({ ...c, from: e.target.value }));
                setPreset('custom');
              }}
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="date"
              className="h-8 w-36"
              value={custom.to}
              onChange={(e) => {
                setCustom((c) => ({ ...c, to: e.target.value }));
                setPreset('custom');
              }}
            />
          </div>
        </div>
      </div>

      {/* FR-5.2: KPI with previous-period comparison */}
      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.income')}
          value={summary?.kpi.income.value}
          change={summary?.kpi.income.change}
          to="/finance/transactions"
          hint={t('dashboard.incomeHint')}
        />
        <KpiCard
          label={t('dashboard.expense')}
          value={summary?.kpi.expense.value}
          change={summary?.kpi.expense.change}
          invert
          to="/finance/transactions"
          hint={t('dashboard.expenseHint')}
        />
        <KpiCard
          label={t('dashboard.profit')}
          value={summary?.kpi.profit.value}
          change={summary?.kpi.profit.change}
          to="/finance/transactions"
          hint={t('dashboard.profitHint')}
        />
        <KpiCard
          label={t('dashboard.cash')}
          value={summary?.kpi.cash.value}
          change={summary?.kpi.cash.change}
          to="/finance/accounts"
          hint={t('dashboard.cashHint')}
        />
      </div>

      {/* FR-5.3: extra cards; FR-5.5: each links to its module */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallCard
          label={t('dashboard.receivables')}
          value={formatMoney(summary?.cards.receivables)}
          tone="text-destructive"
          to="/finance/debts"
        />
        <SmallCard
          label={t('dashboard.payables')}
          value={formatMoney(summary?.cards.payables)}
          tone="text-destructive"
          to="/finance/debts"
        />
        <SmallCard
          label={t('dashboard.grossProfit')}
          value={formatMoney(summary?.cards.grossProfit)}
          to="/reports"
          hint={t('dashboard.grossProfitHint')}
        />
        <SmallCard
          label={t('dashboard.stockValue')}
          value={formatMoney(summary?.cards.stockValue)}
          to="/products"
        />
        <SmallCard
          label={t('dashboard.openDeals')}
          value={`${summary?.cards.openDealsCount ?? 0} ta / ${formatMoney(summary?.cards.openDealsTotal)}`}
          to="/deals"
        />
        <SmallCard
          label={t('dashboard.activeEmployees')}
          value={String(summary?.cards.activeEmployees ?? 0)}
          to="/employees"
        />
        <SmallCard
          label={t('dashboard.lowStock')}
          value={`${summary?.cards.lowStockCount ?? 0} ta`}
          tone={
            (summary?.cards.lowStockCount ?? 0) > 0 ? 'text-destructive' : undefined
          }
          to="/products?lowStock=1"
        />
      </div>

      {/* FR-5.4: charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.monthlyChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={compactMoney}
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Legend />
                <Bar
                  dataKey="income"
                  name={t('dashboard.income')}
                  fill={INCOME_COLOR}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name={t('dashboard.expense')}
                  fill={EXPENSE_COLOR}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.funnelChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funnelData} layout="vertical" barSize={26}>
                <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === t('dashboard.dealsSum')
                      ? formatMoney(Number(value))
                      : value
                  }
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar
                  dataKey="count"
                  name={t('dashboard.dealsCount')}
                  radius={[0, 4, 4, 0]}
                >
                  {funnelData.map((_, i) => (
                    <Cell key={i} fill={ORDINAL_BLUES[i % ORDINAL_BLUES.length]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    style={{ fill: '#52514e', fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.topChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topData} layout="vertical" barSize={22}>
                <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={compactMoney}
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={150}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar
                  dataKey="revenue"
                  name={t('dashboard.revenue')}
                  fill={INCOME_COLOR}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  change,
  invert,
  to,
  hint,
}: {
  label: string;
  value?: string;
  change?: number | null;
  /** for expenses growth is bad: invert the delta color */
  invert?: boolean;
  to: string;
  /** TASK-002: formula tooltip shown on hover over the ℹ icon */
  hint?: string;
}) {
  const up = (change ?? 0) >= 0;
  const good = invert ? !up : up;
  return (
    <Link to={to}>
      <Card className="transition hover:shadow-md">
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {label}
            {hint && (
              <Info
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                aria-label={hint}
              >
                <title>{hint}</title>
              </Info>
            )}
          </p>
          <p
            className={cn(
              'mt-1 text-xl font-semibold',
              Number(value ?? 0) < 0 && 'text-destructive',
            )}
          >
            {formatMoney(value)}
          </p>
          {change !== null && change !== undefined ? (
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-medium',
                good ? 'text-green-700' : 'text-destructive',
              )}
            >
              {up ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {change > 0 ? '+' : ''}
              {change}% {t('dashboard.vsPrev')}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('dashboard.noPrev')}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function SmallCard({
  label,
  value,
  tone,
  to,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  to: string;
  hint?: string;
}) {
  return (
    <Link to={to}>
      <Card className="transition hover:shadow-md">
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {label}
            {hint && (
              <Info
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                aria-label={hint}
              >
                <title>{hint}</title>
              </Info>
            )}
          </p>
          <p className={cn('mt-1 text-lg font-semibold', tone)}>{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
