import * as React from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

type NativeSelectProps=React.SelectHTMLAttributes<HTMLSelectElement>&{label:string};

const NativeSelect=React.forwardRef<HTMLSelectElement,NativeSelectProps>(({label,className,id,...props},ref)=>{
  const controlId=id||props.name||label.replaceAll(' ','-');
  return <label className="field" htmlFor={controlId}><Label htmlFor={controlId}>{label}</Label><select ref={ref} id={controlId} className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',className)} {...props}/></label>;
});
NativeSelect.displayName='NativeSelect';

export {NativeSelect};
