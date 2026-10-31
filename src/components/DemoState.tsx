import { useStore } from '../store';
import { Button, EmptyState } from './atoms';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';

export function StateBoundary({ children }: { children: React.ReactNode }) {
  const { demo, setDemo } = useStore();

  if (demo === 'loading') {
    return (
      <div className="skeleton-wrap" aria-label="Loading sample data">
        <div />
        <div />
        <div />
      </div>
    );
  }

  if (demo === 'empty') {
    return (
      <EmptyState title="No sample records in this view">
        <p>Switch the demo state back to Ready to continue.</p>
        <Button onClick={() => setDemo('ready')}>Show sample data</Button>
      </EmptyState>
    );
  }

  if (demo === 'error') {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>We could not load this sample view</AlertTitle>
          <AlertDescription>
            Nothing was changed. Retry the local demo state.
          </AlertDescription>
        </Alert>
        <EmptyState title="We could not load this sample view">
          <p>Nothing was changed. Retry the local demo state.</p>
          <Button variant="primary" onClick={() => setDemo('ready')}>
            Try again
          </Button>
        </EmptyState>
      </div>
    );
  }

  return <>{children}</>;
}
