import uz from '@/locales/uz.json';

type Dict = { [key: string]: string | Dict };

const warned = new Set<string>();

const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;

function missing(key: string): string {
  // surface untranslated keys during development, once each
  if (isDev && !warned.has(key)) {
    warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[i18n] tarjima topilmadi: "${key}"`);
  }
  return key;
}

/**
 * Looks up a dot-separated key in the uz.json dictionary (NFR-15).
 * `fallback` is returned for missing keys instead of the key itself —
 * useful for open-ended sets like audit action names.
 */
export function t(key: string, fallback?: string): string {
  let node: string | Dict = uz as Dict;
  for (const part of key.split('.')) {
    if (typeof node === 'string' || node[part] === undefined) {
      return fallback ?? missing(key);
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : (fallback ?? missing(key));
}
