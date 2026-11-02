import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

type ProgressProps=React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>&{label?:string};
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, label, ...props }, ref) => label?<div className="progress"><div className="progress-meta"><span>{label}</span><strong>{Math.round(Number(value))}%</strong></div><div role="progressbar" aria-label={label} aria-valuenow={value as number} aria-valuemin={0} aria-valuemax={100}><Progress value={value}/><i style={{width:`${Math.min(100,Number(value))}%`}}/></div></div>:(
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
