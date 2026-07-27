import { useMutation } from '@tanstack/react-query';
import { Download, FileUp, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  commitImport,
  downloadTemplate,
  previewImport,
  type ImportPreview,
} from '@/api/warehouse';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';

interface PreviewColumn {
  key: string;
  label: string;
  align?: 'right';
}

const PRODUCT_COLUMNS: PreviewColumn[] = [
  { key: 'name', label: t('common.name') },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: t('products.category') },
  { key: 'unit', label: t('products.unit') },
  { key: 'costPrice', label: t('products.costPrice'), align: 'right' },
  { key: 'salePrice', label: t('products.salePrice'), align: 'right' },
];

export function ImportsPage() {
  const { user } = useAuth();
  // FR-8.1: products — warehouse/admin
  const canImportProducts = user?.role === 'admin' || user?.role === 'warehouse';

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold">{t('imports.title')}</h1>
      <div className="space-y-8">
        {canImportProducts && (
          <ImportSection
            type="products"
            title={t('imports.products')}
            columns={PRODUCT_COLUMNS}
          />
        )}
      </div>
    </div>
  );
}

function ImportSection({
  type,
  title,
  columns,
}: {
  type: 'products' | 'customers';
  title: string;
  columns: PreviewColumn[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState('');

  const previewMutation = useMutation({
    mutationFn: (file: File) => previewImport(type, file),
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const commitMutation = useMutation({
    mutationFn: () => commitImport(type, preview?.valid ?? []),
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
      setError('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const handleTemplate = async () => {
    try {
      const blob = await downloadTemplate(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            1) Shablonni yuklab oling → 2) to'ldiring → 3) faylni yuklang → 4)
            oldindan ko'rib tasdiqlang
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleTemplate}>
            <Download className="h-4 w-4" /> {t('imports.downloadTemplate')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) previewMutation.mutate(file);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={previewMutation.isPending}
          >
            <FileUp className="h-4 w-4" />
            {previewMutation.isPending ? t('common.loading') : t('imports.uploadFile')}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="mb-4 border-green-300 bg-green-50">
          <CardContent className="pt-6 text-sm">
            <span className="font-semibold">{t('imports.result')}:</span>{' '}
            {t('imports.imported')}: {result.imported} ta
          </CardContent>
        </Card>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              {t('imports.validRows')}: {preview.summary.valid}
            </Badge>
            <Badge variant="destructive">
              {t('imports.errorRows')}: {preview.summary.errors}
            </Badge>
            <Badge variant="warning">
              {t('imports.duplicateRows')}: {preview.summary.duplicates}
            </Badge>
            <Button
              className="ml-auto"
              disabled={preview.summary.valid === 0 || commitMutation.isPending}
              onClick={() => commitMutation.mutate()}
            >
              <Upload className="h-4 w-4" />
              {commitMutation.isPending
                ? t('common.saving')
                : `${t('imports.commit')} (${preview.summary.valid})`}
            </Button>
          </div>

          {preview.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-destructive">
                  {t('imports.errorRows')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {preview.errors.map((e) => (
                    <li key={e.row}>
                      <span className="font-medium">
                        {e.row}-{t('imports.row').toLowerCase()}:
                      </span>{' '}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {preview.duplicates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-amber-700">
                  {t('imports.duplicateRows')} (o'tkazib yuboriladi)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {preview.duplicates.map((d) => (
                    <li key={d.row}>
                      <span className="font-medium">
                        {d.row}-{t('imports.row').toLowerCase()}:
                      </span>{' '}
                      {d.reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {preview.valid.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-green-700">
                  {t('imports.validRows')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-2 py-1.5">{t('imports.row')}</th>
                        {columns.map((c) => (
                          <th
                            key={c.key}
                            className={`px-2 py-1.5 ${c.align === 'right' ? 'text-right' : ''}`}
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.valid.map((r: any) => (
                        <tr key={r.row} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-muted-foreground">{r.row}</td>
                          {columns.map((c) => (
                            <td
                              key={c.key}
                              className={`px-2 py-1.5 ${
                                c.key === 'name' ? 'font-medium' : ''
                              } ${c.align === 'right' ? 'text-right' : ''}`}
                            >
                              {r[c.key] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
