// Promise-based confirm bus (mirrors lib/toast.ts) so any component can
// `await confirmDialog(message)` instead of the native window.confirm(),
// which renders as a jarring browser popup outside the app's design system.

export interface ConfirmRequest {
  id: number;
  message: string;
  title?: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
}

interface PendingRequest extends ConfirmRequest {
  resolve: (value: boolean) => void;
}

type Listener = (request: ConfirmRequest | null) => void;

let current: PendingRequest | null = null;
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(current);
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  /** 'danger' renders the confirm button in the destructive color. */
  tone?: 'default' | 'danger';
}

export function confirmDialog(
  message: string,
  options?: ConfirmOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    current = { id: nextId++, message, resolve, ...options };
    emit();
  });
}

export function resolveConfirm(value: boolean): void {
  current?.resolve(value);
  current = null;
  emit();
}
