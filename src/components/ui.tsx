// src/components/ui.tsx

'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const btnBase = 'inline-flex items-center justify-center gap-2 font-medium rounded-md border border-transparent cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-inverted hover:bg-accent-hover',
  secondary: 'bg-surface-2 text-text border-border hover:bg-surface-3',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};
const btnSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  icon: 'p-2 aspect-square',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => (
    <button ref={ref} className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} disabled={disabled || isLoading} {...props}>
      {isLoading ? <><Spinner size="sm" /><span>Loading...</span></> : children}
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
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm bg-surface-0 border border-border rounded-md transition-all',
            'focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none',
            'placeholder:text-text-muted',
            error && 'border-red-500 focus:border-red-500',
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Card (simplified - use className for internal layout)
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface-0 border border-border-muted rounded-lg p-6',
        interactive && 'transition-all hover:border-border hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

// Badge
type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-accent-muted text-accent',
  secondary: 'bg-surface-2 text-text-muted',
  success: 'bg-green-500/15 text-green-600',
  warning: 'bg-yellow-500/15 text-yellow-600',
  danger: 'bg-red-500/15 text-red-600',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full', badgeVariants[variant], className)} {...props} />;
}

// Spinner
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const spinnerSizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg className={cn('animate-spin text-accent', spinnerSizes[size], className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-text-muted">{message}</p>
      </div>
    </div>
  );
}