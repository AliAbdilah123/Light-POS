import * as React from 'react';
import {Label} from './label';
import {cn} from '@/lib/utils';

type InputProps=React.ComponentProps<'input'>&{label?:string;error?:string};

const Input=React.forwardRef<HTMLInputElement,InputProps>(({className,type,label,error,id,...props},ref)=>{
  const controlId=id||props.name||label?.replaceAll(' ','-');
  const control=<input type={type} id={controlId} aria-invalid={!!error} aria-describedby={error?`${controlId}-error`:undefined} className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',className)} ref={ref} {...props}/>;
  if(!label)return control;
  return <div className="field"><Label htmlFor={controlId}>{label}</Label>{control}{error&&<small id={`${controlId}-error`} role="alert">{error}</small>}</div>;
});
Input.displayName='Input';

export {Input};
