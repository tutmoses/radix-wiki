// src/components/ui.tsx

'use client';

import { forwardRef, useRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Dropdown
export function Dropdown({ onClose, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return <div ref={ref} className={cn('dropdown', className)} {...props}>{children}</div>;
}

// Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const btnStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-inverted hover:bg-accent-hover hover:text-text-inverted',
  secondary: 'bg-surface-2 border-border hover:brightness-110',
  ghost: 'hover:bg-surface-2',
  danger: 'bg-error/80 text-text hover:bg-error',
};
const btnSizes: Record<ButtonSize, string> = { sm: 'px-3 py-1.5', md: 'px-4 py-2', lg: 'px-6 py-3', icon: 'p-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => (
    <button ref={ref} className={cn('row justify-center font-medium rounded-md border border-transparent cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed', btnStyles[variant], btnSizes[size], className)} disabled={disabled || isLoading} {...props}>
      {isLoading ? <><span className="spinner h-4 w-4 text-current" />Loading...</> : children}
    </button>
  )
);
Button.displayName = 'Button';

// Input
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <div className="stack-sm">
      {label && <label htmlFor={id || props.name} className="font-medium">{label}</label>}
      <input ref={ref} id={id || props.name} className={cn('input', error && 'border-error focus:border-error', className)} aria-invalid={!!error} {...props} />
      {error ? <p className="text-error">{error}</p> : hint && <small>{hint}</small>}
    </div>
  )
);
Input.displayName = 'Input';

// Card
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { interactive?: boolean }>(
  ({ className, interactive, ...props }, ref) => <div ref={ref} className={cn(interactive ? 'surface-interactive p-6' : 'panel', className)} {...props} />
);
Card.displayName = 'Card';

// Badge - with static class mappings for Tailwind JIT
type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger';

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'badge-accent',
  secondary: '',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-error/15 text-error',
};

export function Badge({ className, variant = 'default', ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn('badge', badgeVariants[variant], className)} {...props} />;
}

// Spinner - CSS-only
const spinnerSizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return <span className={cn('spinner text-accent', spinnerSizes[size], className)} />;
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="center min-h-100">
      <div className="stack-sm items-center"><Spinner size="lg" /><p className="text-muted">{message}</p></div>
    </div>
  );
}