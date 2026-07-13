import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so a single broken page never blanks the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Boshqarilmagan xato:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Nimadir noto'g'ri ketdi</h1>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Sahifani ochishda kutilmagan xato yuz berdi. Qayta urinib
              ko'ring; muammo takrorlansa, sahifani yangilang.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>
              Qayta urinish
            </Button>
            <Button onClick={() => window.location.reload()}>
              Sahifani yangilash
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
