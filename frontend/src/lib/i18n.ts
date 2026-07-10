import uz from '@/locales/uz.json';

type Dict = { [key: string]: string | Dict };

/** Looks up a dot-separated key in the uz.json dictionary (NFR-15). */
export function t(key: string): string {
  let node: string | Dict = uz as Dict;
  for (const part of key.split('.')) {
    if (typeof node === 'string' || node[part] === undefined) return key;
    node = node[part];
  }
  return typeof node === 'string' ? node : key;
}
