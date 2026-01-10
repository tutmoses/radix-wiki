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

const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-inverted hover:bg-accent-hover',
  secondary: 'bg-surface-2 border-border hover:bg-surface-3',
  ghost: 'hover:bg-surface-2',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};

const btnSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-6 py-3',
  icon: 'p-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'row justify-center font-medium rounded-md border border-transparent cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <><Spinner size="sm" />Loading...</> : children}
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
      <div className="stack-2">
        {label && <label htmlFor={inputId} className="font-medium">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn('input', error && 'border-red-500 focus:border-red-500', className)}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-red-500">{error}</p>}
        {hint && !error && <small>{hint}</small>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Card
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(interactive ? 'surface-interactive p-6' : 'panel', className)}
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
  default: 'badge-accent',
  secondary: '',
  success: 'bg-green-500/15 text-green-500',
  warning: 'bg-yellow-500/15 text-yellow-500',
  danger: 'bg-red-500/15 text-red-500',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <span className={cn('badge', badgeVariants[variant], className)} {...props} />;
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
    <div className="center min-h-[400px]">
      <div className="stack-2 items-center">
        <Spinner size="lg" />
        <p className="text-muted">{message}</p>
      </div>
    </div>
  );
}