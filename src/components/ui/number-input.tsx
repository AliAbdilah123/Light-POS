import * as React from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

const formatters = new Map<number, Intl.NumberFormat>();

const formatter = (decimals: number) => {
  let instance = formatters.get(decimals);
  if (!instance) {
    instance = new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
      useGrouping: true,
    });
    formatters.set(decimals, instance);
  }
  return instance;
};

const toNumber = (value: number | string | undefined): number | '' => {
  if (value === undefined || value === null || value === '') return '';
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : '';
};

const parseNumber = (text: string, decimals: number): number | '' => {
  const negative = /^\s*-/.test(text);
  const digits = text.replace(/[^\d,]/g, '');
  if (!digits) return '';
  const [whole, ...fraction] = digits.split(',');
  const frac = decimals > 0 ? fraction.join('').slice(0, decimals) : '';
  const parsed = Number(
    `${negative ? '-' : ''}${whole || '0'}${frac ? `.${frac}` : ''}`
  );
  return Number.isFinite(parsed) ? parsed : '';
};

const caretPosition = (formatted: string, significant: number): number => {
  if (significant <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/[\d,]/.test(formatted[i])) {
      seen += 1;
      if (seen === significant) return i + 1;
    }
  }
  return formatted.length;
};

type NumberInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'
> & {
  label?: string;
  error?: string;
  value?: number | string;
  defaultValue?: number | string;
  onValueChange?: (value: number | '') => void;
  /** Fraction digits kept while typing. 0 formats whole numbers only. */
  decimals?: number;
  min?: number;
  max?: number;
};

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      className,
      label,
      error,
      id,
      name,
      value,
      defaultValue,
      onValueChange,
      decimals = 0,
      min,
      max,
      required,
      disabled,
      onBlur,
      ...props
    },
    forwardedRef
  ) {
    const controlId = id || name || label?.replaceAll(' ', '-');
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => inputRef.current as HTMLInputElement
    );
    const initial = toNumber(value !== undefined ? value : defaultValue);
    const [text, setText] = React.useState(() =>
      initial === '' ? '' : formatter(decimals).format(initial)
    );
    const [raw, setRaw] = React.useState(() =>
      initial === '' ? '' : String(initial)
    );
    const pendingCaret = React.useRef<number | null>(null);

    React.useLayoutEffect(() => {
      if (pendingCaret.current === null) return;
      const input = inputRef.current;
      if (input) input.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    });

    React.useEffect(() => {
      if (value === undefined) return;
      const next = toNumber(value);
      setRaw(next === '' ? '' : String(next));
      setText((current) =>
        parseNumber(current, decimals) === next
          ? current
          : next === ''
          ? ''
          : formatter(decimals).format(next)
      );
    }, [value, decimals]);

    React.useEffect(() => {
      const form = inputRef.current?.form;
      if (!form) return;
      const onReset = () => {
        const next = toNumber(value !== undefined ? value : defaultValue);
        setRaw(next === '' ? '' : String(next));
        setText(next === '' ? '' : formatter(decimals).format(next));
      };
      form.addEventListener('reset', onReset);
      return () => form.removeEventListener('reset', onReset);
    }, [value, defaultValue, decimals]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const caret = input.selectionStart ?? input.value.length;
      const significant = input.value.slice(0, caret).replace(/[^\d,]/g, '').length;
      const next = parseNumber(input.value, decimals);
      const trailingComma = decimals > 0 && /,\s*$/.test(input.value);
      const formatted =
        (next === '' ? '' : formatter(decimals).format(next)) +
        (trailingComma ? ',' : '');
      input.setCustomValidity('');
      setText(formatted);
      setRaw(next === '' ? '' : String(next));
      pendingCaret.current = caretPosition(formatted, significant);
      onValueChange?.(next);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const next = parseNumber(event.target.value, decimals);
      if (next !== '' && min !== undefined && next < min) {
        event.target.setCustomValidity(`Enter ${min} or more.`);
      } else if (next !== '' && max !== undefined && next > max) {
        event.target.setCustomValidity(`Enter ${max} or less.`);
      } else {
        event.target.setCustomValidity('');
      }
      onBlur?.(event);
    };

    const control = (
      <>
        <input
          {...props}
          ref={inputRef}
          id={controlId}
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            className
          )}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${controlId}-error` : undefined}
        />
        {name && !disabled && <input type="hidden" name={name} value={raw} />}
      </>
    );

    if (!label) return control;
    return (
      <div className="field">
        <Label htmlFor={controlId}>{label}</Label>
        {control}
        {error && (
          <small id={`${controlId}-error`} role="alert">
            {error}
          </small>
        )}
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';

export { NumberInput };
