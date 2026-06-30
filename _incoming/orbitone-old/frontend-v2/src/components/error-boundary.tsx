import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // In production, send to a logging service instead of console
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-error" />
          <h1 className="mt-4 text-2xl font-bold text-primary">Something went wrong</h1>
          <p className="mt-2 max-w-md text-muted">
            We&apos;re sorry, but an unexpected error occurred. Try refreshing the page.
          </p>
          {this.state.error && import.meta.env.DEV && (
            <pre className="mt-4 max-w-md overflow-auto rounded-lg bg-surface-elevated p-4 text-left text-xs text-error">
              {this.state.error.message}
            </pre>
          )}
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
