import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Button as ShadcnButton } from './ui/button';
import { Input as ShadcnInput } from './ui/input';
import { Badge as ShadcnBadge } from './ui/badge';
import { Card as ShadcnCard } from './ui/card';
import { Progress as ShadcnProgress } from './ui/progress';
import { Label as ShadcnLabel } from './ui/label';
import { cn } from '@/lib/utils';

export function Button({
  variant = 'secondary',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const shadcnVariant =
    variant === 'primary'
      ? 'default'
      : variant === 'danger'
      ? 'destructive'
      : variant === 'ghost'
      ? 'ghost'
      : 'secondary';

  return (
    <ShadcnButton
      variant={shadcnVariant}
      className={cn(`button ${variant}`, className)}
      {...p}
    />
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <ShadcnButton
      variant="ghost"
      size="icon"
      className={cn('icon-button', className)}
      aria-label={label}
      title={label}
      {...p}
    >
      {children}
    </ShadcnButton>
  );
}

export function Input({
  label,
  error,
  className = '',
  ...p
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const id = p.id || p.name || label.replaceAll(' ', '-');
  return (
    <label className="field" htmlFor={id}>
      <ShadcnLabel htmlFor={id} className="cursor-pointer">
        <span>{label}</span>
      </ShadcnLabel>
      <ShadcnInput
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(className)}
        {...p}
      />
      {error && (
        <small id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

export function Select({
  label,
  children,
  className = '',
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className={className} {...p}>
        {children}
      </select>
    </label>
  );
}

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral';
  className?: string;
  children: ReactNode;
}) {
  const shadcnVariant =
    tone === 'bad'
      ? 'destructive'
      : tone === 'good'
      ? 'default'
      : tone === 'warn'
      ? 'secondary'
      : 'outline';

  return (
    <ShadcnBadge
      variant={shadcnVariant}
      className={cn(`badge ${tone}`, className)}
    >
      {children}
    </ShadcnBadge>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ShadcnCard className={cn(`card ${className}`)}>
      {children}
    </ShadcnCard>
  );
}

export function Progress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="progress">
      <div className="progress-meta">
        <span>{label}</span>
        <strong>{Math.round(value)}%</strong>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <ShadcnProgress value={value} className="h-full w-full" />
        <i style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export { Switch } from './ui/switch';
export { Label } from './ui/label';
