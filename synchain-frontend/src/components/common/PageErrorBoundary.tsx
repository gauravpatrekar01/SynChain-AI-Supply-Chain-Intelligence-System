import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  pageName?: string;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`PageErrorBoundary caught an error in ${this.props.pageName || 'page'}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-8 max-w-3xl mx-auto rounded-2xl glass-panel border border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.15)] text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Module Error: {this.props.pageName || 'Current Screen'}
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto mb-6">
            An unexpected error occurred while rendering this module. Your session is active and other modules are fully operational.
          </p>

          {this.state.error && (
            <div className="mb-6 p-4 rounded-xl bg-slate-950/70 border border-white/10 text-left font-mono text-xs text-rose-300 overflow-x-auto max-h-40">
              <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              Reload Module
            </Button>
            {this.props.onNavigateHome && (
              <Button variant="primary" onClick={this.props.onNavigateHome} className="gap-2">
                <Home className="w-4 h-4" />
                Return to Command Center
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
