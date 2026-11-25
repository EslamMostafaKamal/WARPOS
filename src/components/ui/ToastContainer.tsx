import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 end-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
          error: <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
          info: <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />,
        };

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-white border border-slate-200/90 shadow-xl shadow-slate-900/10 rounded-xl px-4 py-3 flex items-start gap-3 transition-all duration-150"
          >
            {iconMap[toast.type]}
            <div className="flex-1 min-w-0 text-start">
              <p className="text-xs font-semibold text-slate-900 leading-snug">{toast.title}</p>
              {toast.description && (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
