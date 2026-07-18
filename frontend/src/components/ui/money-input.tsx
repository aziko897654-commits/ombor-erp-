import { Input } from '@/components/ui/input';

/** TASK-027: live thousand grouping — "10000000" → "10 000 000". */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Money input: shows grouped digits while typing, accepts digits only,
 * and reports the raw numeric string ("1250000") to the form state.
 */
export function MoneyInput({
  value,
  onChange,
  required,
  min = 1,
  className,
}: {
  /** raw digits, e.g. "1250000" (empty string when blank) */
  value: string;
  onChange: (raw: string) => void;
  required?: boolean;
  min?: number;
  className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      className={className}
      required={required}
      pattern="[\d ]+"
      value={value === '' ? '' : group(value)}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        // guard absurd lengths (DECIMAL(16,2) ceiling)
        onChange(raw.slice(0, 14));
      }}
      onBlur={(e) => {
        // normalize a bare "0" so `min` semantics stay intuitive
        if (min > 0 && e.target.value !== '' && Number(value) === 0) {
          onChange('');
        }
      }}
    />
  );
}
