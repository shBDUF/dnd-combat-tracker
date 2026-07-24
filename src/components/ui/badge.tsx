import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange' | 'gray' | 'slate';
}

const variantStyles: Record<string, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  outline: 'border border-input text-foreground',
};

const colorStyles: Record<string, string> = {
  red: 'bg-red-100 text-red-800 border-red-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
};

export function Badge({
  className,
  variant = 'default',
  color,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantStyles[variant],
        color && colorStyles[color],
        className
      )}
      {...props}
    />
  );
}

// Condition badge colors mapping
export const CONDITION_COLORS: Record<string, string> = {
  Blinded: 'slate',
  Charmed: 'purple',
  Deafened: 'slate',
  Fatigued: 'orange',
  Frightened: 'purple',
  Grappled: 'red',
  Incapacitated: 'gray',
  Invisible: 'blue',
  Paralyzed: 'red',
  Petrified: 'gray',
  Poisoned: 'green',
  Prone: 'orange',
  Restrained: 'red',
  Stunned: 'purple',
  Unconscious: 'red',
  Exhaustion: 'orange',
  Concentrating: 'yellow',
  Dazed: 'purple',
  Bloodied: 'red',
};