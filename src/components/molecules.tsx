import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, Card } from './atoms';
import { idr } from '../domain';
import { cn } from '@/lib/utils';

export function PageHead({
  eyebrow = 'Sample operational data',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Metric({
  label,
  value,
  delta,
  help,
}: {
  label: string;
  value: string;
  delta?: string;
  help?: string;
}) {
  return (
    <Card className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
      {help && <em>{help}</em>}
    </Card>
  );
}

export function SectionTitle({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusRow({
  title,
  meta,
  status,
  amount,
  action,
}: {
  title: string;
  meta: string;
  status: string;
  amount?: number;
  action?: ReactNode;
}) {
  const tone =
    status === 'Completed' ||
    status === 'Available' ||
    status === 'Approved' ||
    status === 'Active'
      ? 'good'
      : status === 'Voided' ||
        status === 'Declined' ||
        status === 'Unavailable'
      ? 'bad'
      : status === 'Ready'
      ? 'info'
      : 'warn';

  return (
    <div className="status-row">
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
      <div className="status-end">
        {amount !== undefined && <b>{idr(amount)}</b>}
        <Badge tone={tone}>{status}</Badge>
        {action}
      </div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  closeRef.current = onClose;

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (!dialog) return;

    const focusable = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((x) => !x.hidden);

    (focusable()[0] || dialog).focus();

    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      prior?.focus();
    };
  }, []);

  return createPortal(
    <div
      className={cn('modal-backdrop', className)}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={cn('modal', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
            ×
          </Button>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}

export function FormActions({
  onCancel,
  submit = 'Save',
}: {
  onCancel: () => void;
  submit?: string;
}) {
  return (
    <div className="form-actions">
      <Button type="button" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" type="submit">
        {submit}
      </Button>
    </div>
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
