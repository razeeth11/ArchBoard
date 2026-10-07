"use client";

import { Component, type ReactNode } from "react";
import { downloadRawDatabase } from "./dialogs";

export class EditorErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold">Something went wrong in the editor</h1>
        <p className="text-muted mt-2 text-sm">
          Your drawings are stored on this device and were not deleted. Download a backup of the raw
          data first, then reload.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="bg-accent text-accent-fg rounded-md px-3 py-1.5 text-sm font-medium"
            onClick={() => void downloadRawDatabase()}
          >
            Recover and download backup
          </button>
          <button
            type="button"
            className="border-border rounded-md border px-3 py-1.5 text-sm"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
        <pre className="text-muted mt-4 overflow-auto text-xs">{this.state.error.message}</pre>
      </div>
    );
  }
}
