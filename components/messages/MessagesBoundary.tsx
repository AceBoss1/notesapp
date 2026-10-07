"use client";

import { Component, type ReactNode } from "react";
import { sendClientError } from "@/components/ErrorReporter";

// If anything in messages fails to draw, say so right here and show what failed (so it can be reported precisely), instead of
// replacing the whole page. The error is also recorded for /admin/errors.
export default class MessagesBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    sendClientError(`Messages: ${error.message || "render error"}`, error.stack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="border border-rule p-5 text-sm" role="alert">
        <p className="font-display text-xl text-ink">Messages couldn&apos;t load</p>
        <p className="mt-2 text-slate">We&apos;ve been told about it. Try again; if it keeps happening, send us what is written below.</p>
        <p className="mt-3 break-words rounded bg-paper p-2 font-mono text-xs text-slate">{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} className="btn-primary mt-4 !px-5 !py-2 text-xs">Try again</button>
      </div>
    );
  }
}
