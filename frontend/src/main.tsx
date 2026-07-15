import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialogHost } from './components/ui/confirm-dialog-host';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './lib/auth';
import { apiErrorMessage } from './lib/format';
import { toast } from './lib/toast';
import './index.css';

const queryClient = new QueryClient({
  // data-loading failures are otherwise silent on list pages; surface
  // them once via a toast (401 refresh is handled by the api client)
  queryCache: new QueryCache({
    onError: (error) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) return;
      toast(apiErrorMessage(error), 'error');
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
        <Toaster />
        <ConfirmDialogHost />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
