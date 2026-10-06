import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-[400px] h-full text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10 animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-lg font-black text-slate-800 mb-1">
            {this.props.fallbackTitle || 'Terjadi Kendala pada Halaman Ini'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
            Sistem mendeteksi kesalahan rendering saat memuat data. Tenang, data toko dan transaksi Anda tetap aman di database.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>

            <button
              onClick={this.handleGoHome}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Home className="w-4 h-4 text-slate-500" />
              <span>Kembali ke Kasir</span>
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mt-6 text-left max-w-xl w-full bg-slate-100 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-rose-700 overflow-x-auto">
              <summary className="cursor-pointer font-bold text-slate-700 mb-1">
                Detail Error Teknis
              </summary>
              <div className="whitespace-pre-wrap">{this.state.error.toString()}</div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
