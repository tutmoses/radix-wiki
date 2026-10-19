// src/components/ui.tsx

'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { useClickOutside } from 'wiki-formant/react';

// Dropdown
export function Dropdown({ onClose, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { onClose: () => void }) {
  const ref = useClickOutside<HTMLDivElement>(onClose);
  return <div ref={ref} className={cn('dropdown', className)} {...props}>{children}</div>;
}

// Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const btnStyles: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'bg-surface-2 border-border hover:brightness-110',
  ghost: 'hover:bg-surface-2',
  danger: 'bg-error/80 text-text hover:bg-error',
};
const btnSizes: Record<ButtonSize, string> = { sm: 'px-3 py-1.5', md: '', lg: 'px-6 py-3', icon: 'p-2' };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => (
    <button ref={ref} className={cn('btn', btnStyles[variant], btnSizes[size], className)} disabled={disabled || isLoading} {...props}>
      {isLoading ? <><span className="spinner h-4 w-4 text-current" />Loading...</> : children}
    </button>
  )
);
Button.displayName = 'Button';

// Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, id, ...props }, ref) => (
    <div className="stack-sm">
      {label && <label htmlFor={id || props.name} className="font-medium">{label}</label>}
      <input ref={ref} id={id || props.name} className={cn('input', className)} {...props} />
      {hint && <small>{hint}</small>}
    </div>
  )
);
Input.displayName = 'Input';

// Card
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { interactive?: boolean }>(
  ({ className, interactive, ...props }, ref) => <div ref={ref} className={cn(interactive ? 'surface-interactive' : 'bg-surface-0 border border-border-muted rounded-lg', 'p-6', className)} {...props} />
);
Card.displayName = 'Card';

// Badge - with static class mappings for Tailwind JIT
type BadgeVariant = 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'danger';

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'badge-accent',
  secondary: '',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
};

export function Badge({ className, variant = 'default', ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn('badge', badgeVariants[variant], className)} {...props} />;
}

/** The tip-jar QR, shared by the block view and its editor; `.tip-jar-qr` sizes it. */
export function TipJarQr({ address, className }: { address: string; className?: string }) {
  return (
    <div className={cn('tip-jar-qr', className)}>
      <QRCodeSVG value={address} level="M" marginSize={1} fgColor="#1a1d29" bgColor="#ffffff" />
    </div>
  );
}
