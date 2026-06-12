import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/error-reporting";

type Props = Readonly<{ children: ReactNode; fallbackTitle?: string }>;
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error, {
      boundary: "react_error_boundary",
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
