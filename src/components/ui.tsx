// src/components/ui.tsx

'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

/**
 * The panel a menu button opens. Closing it is the owner's: a click-outside
 * here would count the button itself as outside, so pressing it to close the
 * menu closed it on mousedown and opened it again on click.
 */
export function Dropdown({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('dropdown', className)} {...props}>{children}</div>;
}

// Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const btnStyles: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'bg-surface-2 border-border hover:brightness-110',
  ghost: 'hover:bg-surface-2',
};
const btnSizes: Record<ButtonSize, string> = { sm: 'px-3 py-1.5', md: '', lg: 'px-6 py-3' };

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

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...props} />;
}

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
