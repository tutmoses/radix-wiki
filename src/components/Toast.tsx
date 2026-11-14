// src/components/Toast.tsx

'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/hooks';
import { cn } from '@/lib/utils';

/** A toast raised just before a full page load, carried across it in sessionStorage. */
export const CARRIED_TOAST = 'toast';

export function Toast() {
  const toast = useStore(s => s.toast);
  const showToast = useStore(s => s.showToast);
  const dismissToast = useStore(s => s.dismissToast);

  // The editor's save leaves by a full page load, which starts a fresh store.
  useEffect(() => {
    const carried = sessionStorage.getItem(CARRIED_TOAST);
    if (!carried) return;
    sessionStorage.removeItem(CARRIED_TOAST);
    showToast(carried);
  }, [showToast]);

  if (!toast) return null;

  return (
    <div className={cn('toast', toast.type === 'error' && 'toast-error')} role={toast.type === 'error' ? 'alert' : 'status'}>
      {toast.type === 'error' && <AlertTriangle size={16} className="text-error shrink-0" />}
      <span>{toast.message}</span>
      <button onClick={dismissToast} className="toast-close" title="Dismiss" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
