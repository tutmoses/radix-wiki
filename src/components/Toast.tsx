// src/components/Toast.tsx

'use client';

import { X } from 'lucide-react';
import { useStore } from '@/hooks';

export function Toast() {
  const toast = useStore(s => s.toast);
  const dismissToast = useStore(s => s.dismissToast);

  if (!toast) return null;

  return (
    <div className="toast" role="alert">
      <span>{toast.message}</span>
      <button onClick={dismissToast} className="toast-close" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
