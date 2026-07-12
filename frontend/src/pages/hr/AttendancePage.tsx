import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getAttendanceMonth,
  setAttendance,
  type AttendanceStatus,
} from '@/api/hr';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const CYCLE: Record<string, AttendanceStatus | 'clear'> = {
  empty: 'present',
  present: 'absent',
  absent: 'vacation',
  vacation: 'sick',
  sick: 'clear',
};

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-700',
  vacation: 'bg-blue-100 text-blue-700',
  sick: 'bg-amber-100 text-amber-800',
};

const CELL_MARK: Record<AttendanceStatus, string> = {
  present: '✓',
  absent: '×',
  vacation: 'T',
  sick: 'K',
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** FR-4.3: month grid — rows are employees, columns are days. */
export function AttendancePage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [error, setError] = useState('');

  const { data: grid, isLoading } = useQuery({
    queryKey: ['attendance', month],
    queryFn: () => getAttendanceMonth(month),
  });

  const mutation = useMutation({
    mutationFn: setAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', month] });
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const statusByKey = new Map(
    grid?.entries.map((e) => [
      `${e.employeeId}|${e.date.slice(0, 10)}`,
      e.status,
    ]) ?? [],
  );

  const toggle = (employeeId: number, day: number) => {
    if (mutation.isPending) return;
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const current = statusByKey.get(`${employeeId}|${date}`) ?? 'empty';
    mutation.mutate({ employeeId, date, status: CYCLE[current] });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('attendance.title')}</h1>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            className="w-44"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {(Object.keys(CELL_STYLE) as AttendanceStatus[]).map((status) => (
          <Badge key={status} className={cn('border-0', CELL_STYLE[status])}>
            {CELL_MARK[status]} — {t(`attendance.statuses.${status}`)}
          </Badge>
        ))}
        <span className="text-muted-foreground">{t('attendance.hint')}</span>
      </div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (grid?.employees.length ?? 0) === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t('common.noData')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 bg-muted px-3 py-2 text-left font-semibold">
                  {t('employees.fullName')}
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="w-9 px-0 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid?.employees.map((employee) => (
                <tr key={employee.id} className="border-b last:border-0">
                  <td className="sticky left-0 whitespace-nowrap bg-background px-3 py-1 font-medium">
                    {employee.fullName}
                  </td>
                  {days.map((day) => {
                    const date = `${month}-${String(day).padStart(2, '0')}`;
                    const status = statusByKey.get(`${employee.id}|${date}`);
                    return (
                      <td key={day} className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(employee.id, day)}
                          className={cn(
                            'h-8 w-8 rounded text-xs font-semibold transition hover:ring-1 hover:ring-primary/40',
                            status
                              ? CELL_STYLE[status]
                              : 'bg-muted/40 text-transparent',
                          )}
                        >
                          {status ? CELL_MARK[status] : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
