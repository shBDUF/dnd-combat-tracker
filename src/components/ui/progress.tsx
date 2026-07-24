import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'health' | 'health-danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default: 'bg-primary',
  health: 'bg-green-500',
  'health-danger': 'bg-red-500',
};

const sizeStyles: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function Progress({
  className,
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  ...props
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const isLow = variant === 'health' && percentage < 30;

  return (
    <div
      className={cn('w-full bg-secondary rounded-full overflow-hidden', sizeStyles[size], className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          isLow ? variantStyles['health-danger'] : variantStyles[variant]
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}