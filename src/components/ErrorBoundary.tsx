import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Application boundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      let readable = "Une erreur s'est produite lors du chargement des données.";
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          readable = parsed.error.includes('permission')
            ? "Accès refusé ou droits insuffisants pour cette opération."
            : parsed.error;
        }
      } catch {
        readable = this.state.message;
      }

      return (
        <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Oups, quelque chose s'est interrompu
            </h2>
            <p className="text-sm text-slate-600 mb-6">{readable}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-medium text-white rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
