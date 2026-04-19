import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary
 * --------------------------------
 * Catches any rendering error in the React tree and shows a branded
 * fallback UI so the user can recover by reloading the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this is where you'd ship the error to your monitoring tool.
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Reset boundary state and full-navigate home (avoids router coupling).
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-display text-foreground">
              Si è verificato un errore critico
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              I nostri ingegneri sono stati avvisati. Puoi provare a ricaricare
              l'applicazione per continuare.
            </p>
          </div>
          <div className="space-y-2">
            <Button onClick={this.handleReload} className="w-full">
              Ricarica l'applicazione
            </Button>
            <Button
              onClick={this.handleGoHome}
              variant="outline"
              className="w-full"
            >
              Torna alla home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
