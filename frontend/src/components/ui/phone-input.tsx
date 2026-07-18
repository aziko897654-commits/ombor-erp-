import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';

/** TASK-027: progressive +998 XX XXX-XX-XX mask. */
export function maskPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  if (d.length === 0) return '';
  let out = '+998 ' + d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += '-' + d.slice(5, 7);
  if (d.length > 7) out += '-' + d.slice(7, 9);
  return out;
}

function digitCount(value: string): number {
  const d = value.replace(/\D/g, '');
  return d.startsWith('998') ? d.length - 3 : d.length;
}

/**
 * Masked phone input. Emits the masked string; empty stays empty.
 * A partially-typed number shows an inline error on blur (real-time
 * validation per TASK-027) and blocks native submit via a pattern.
 */
export function PhoneInput({
  value,
  onChange,
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const incomplete = value !== '' && digitCount(value) < 9;

  return (
    <div className="space-y-1">
      <Input
        type="tel"
        inputMode="tel"
        placeholder="+998 90 123-45-67"
        className={className}
        required={required}
        pattern="\+998 \d{2} \d{3}-\d{2}-\d{2}"
        title={t('common.phoneFormat')}
        value={value}
        onChange={(e) => onChange(maskPhone(e.target.value))}
        onBlur={() => setTouched(true)}
      />
      {touched && incomplete && (
        <p className="text-xs text-destructive">{t('common.phoneIncomplete')}</p>
      )}
    </div>
  );
}
