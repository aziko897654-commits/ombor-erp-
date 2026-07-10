import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '@/api/warehouse';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';

export function CategoriesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    setError('');
  };

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      invalidate();
      setNewName('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      updateCategory(id, name),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submitNew = (e: FormEvent) => {
    e.preventDefault();
    if (newName.trim()) createMut.mutate(newName.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('products.categories')}>
      <form onSubmit={submitNew} className="mb-3 flex gap-2">
        <Input
          placeholder={t('common.name')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" disabled={createMut.isPending}>
          {t('common.add')}
        </Button>
      </form>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-md border">
        {categories?.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            {editingId === c.id ? (
              <>
                <Input
                  className="h-8"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => updateMut.mutate({ id: c.id, name: editName })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1">
                  {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({c._count?.products ?? 0})
                  </span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={(c._count?.products ?? 0) > 0}
                  onClick={() => deleteMut.mutate(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </li>
        ))}
        {(categories?.length ?? 0) === 0 && (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            {t('common.noData')}
          </li>
        )}
      </ul>
    </Dialog>
  );
}
