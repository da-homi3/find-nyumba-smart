import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/error-reporting";
import { isChunkLoadError, reloadOnceForStaleChunk } from "@/lib/chunk-load-recovery";

type Props = Readonly<{ children: ReactNode; fallbackTitle?: string }>;
type State = { error: Error | null; reloading: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    if (isChunkLoadError(error)) {
      return { error, reloading: true };
    }
    return { error, reloading: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      reloadOnceForStaleChunk();
      return;
    }
    reportClientError(error, {
      boundary: "react_error_boundary",
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.reloading) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Updating app…</p>
        </div>
      );
    }

    if (this.state.error) {
      const chunkError = isChunkLoadError(this.state.error);
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {chunkError
                ? "A newer version of the app is available. Refresh to continue."
                : this.state.error.message || "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (chunkError) {
                  globalThis.location.reload();
                  return;
                }
                this.setState({ error: null });
              }}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {chunkError ? "Refresh" : "Try again"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
