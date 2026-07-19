import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive:
          'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-red-300',
        success:
          'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        // TASK-012: completed/final states — darker green than success
        done: 'bg-green-700 text-green-50 dark:bg-green-800 dark:text-green-100',
        warning:
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        // TASK-012: in-progress/informational states (e.g. shipped)
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        outline: 'border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
