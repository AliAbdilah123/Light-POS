import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  PackageOpen,
  Scale,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  idr,
  localDateTime,
  localDay,
  recipeCost,
  stockFromExpenseLines,
  unitConvert,
  type ExpenseLine,
  type InventoryItem,
  type InventoryMovement,
} from '../domain';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { parseReceipt, RECEIPT_MAX_BYTES } from '../services/receiptParser';
import { useStore } from '../store';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { NativeSelect as Select } from '../components/ui/native-select';
import { Progress } from '../components/ui/progress';
import {
  FormActions,
  Metric,
  Modal,
  PageHead,
  SectionTitle,
  StatusRow,
} from '../components/molecules';

export function ManagerDashboard() {
  const s = useStore();
  const today = localDay(new Date());
  const tenant = s.tenants.find((t) => t.id === s.business)?.name || 'this business';
  const paid = s.data.orders.filter((o) => o.status === 'Completed' && o.payment);
  const paidToday = paid.filter((o) => localDay(o.createdAt) === today);
  const revenueToday = paidToday.reduce((sum, o) => sum + o.total, 0);
  const average = paid.length
    ? Math.round(paid.reduce((sum, o) => sum + o.total, 0) / paid.length)
    : 0;
  const todaysShifts = s.data.shifts.filter((sh) => sh.date === today);
  const active = todaysShifts.filter((sh) => {
    const now = new Date().toTimeString().slice(0, 5);
    return now >= sh.start && now <= sh.end;
  });
  const openOrders = s.data.orders.filter(
    (o) => !['Completed', 'Voided'].includes(o.status)
  ).length;
  const coverage = s.data.orders.length
    ? Math.round((paid.length / s.data.orders.length) * 100)
    : 0;
  const refreshed = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
  const shiftState = (sh: (typeof todaysShifts)[number]) => {
    const now = new Date().toTimeString().slice(0, 5);
    return now < sh.start ? 'Upcoming' : now > sh.end ? 'Completed' : 'Active';
  };
  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Service overview"
        description={`Revenue pulse, cashier performance, and messages for ${tenant}.`}
      />
      <div className="metric-grid">
        <Metric
          label="Revenue today"
          value={idr(revenueToday)}
          delta={`${paidToday.length} paid ${
            paidToday.length === 1 ? 'order' : 'orders'
          } today`}
          icon={<WalletCards />}
        />
        <Metric
          label="Average order"
          value={idr(average)}
          delta={`${paid.length} paid orders on record`}
          icon={<BarChart3 />}
        />
        <Metric
          label="Cashiers active"
          value={`${active.length} / ${todaysShifts.length}`}
          help={`${todaysShifts.length - active.length} scheduled today`}
          icon={<Users />}
        />
        <Metric
          label="Open orders"
          value={String(openOrders)}
          help={`${coverage}% of orders paid · refreshed ${refreshed}`}
          icon={<ClipboardCheck />}
        />
      </div>
      <div className="split">
        <Card>
          <SectionTitle
            title="Cashier summaries"
            meta={`${todaysShifts.length} shifts today`}
          />
          {todaysShifts.length ? (
            todaysShifts.map((sh) => (
              <StatusRow
                key={sh.id}
                title={sh.staff}
                meta={`${sh.start}–${sh.end} · ${sh.location}`}
                status={shiftState(sh)}
              />
            ))
          ) : (
            <p className="muted">No shifts scheduled for today.</p>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="Manager inbox"
            meta={`${s.data.messages.length} messages`}
          />
          {s.data.messages.length ? (
            s.data.messages.map((m) => (
              <div className="callout" key={m.id}>
                <strong>{m.from}</strong>
                <p>{m.text}</p>
                <small>{m.time}</small>
              </div>
            ))
          ) : (
            <p className="muted">No messages.</p>
          )}
        </Card>
      </div>
      <Card>
        <SectionTitle title="Audit pulse" meta="Latest recorded actions" />
        {s.data.audit.length ? (
          s.data.audit
            .slice(0, 4)
            .map((a, i) => (
              <div className="audit" key={i}>
                <span>●</span>
                {a}
              </div>
            ))
        ) : (
          <p className="muted">No recorded actions yet.</p>
        )}
      </Card>
    </>
  );
}

const dayKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localDay(d);
};
const eachDay = (start: string, end: string) => {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && out.length < 31) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

export function RevenuePage() {
  const s = useStore();
  const [mode, setMode] = useState<'week' | 'month' | 'custom'>('week');
  const [from, setFrom] = useState(dayKey(-6));
  const [to, setTo] = useState(dayKey(0));
  const start = mode === 'week' ? dayKey(-6) : mode === 'month' ? dayKey(-29) : from;
  const end = mode === 'week' || mode === 'month' ? dayKey(0) : to;
  const invalid = !!from && !!to && from > to && mode === 'custom';
  const days = invalid ? [] : eachDay(start, end);
  const inRange = s.data.orders.filter(
    (o) =>
      o.status === 'Completed' &&
      o.payment &&
      !invalid &&
      localDay(o.createdAt) >= start &&
      localDay(o.createdAt) <= end
  );
  const net = inRange.reduce((sum, o) => sum + o.total, 0);
  const average = inRange.length ? Math.round(net / inRange.length) : 0;
  const cash = inRange.filter((o) => o.payment === 'Cash').length,
    qris = inRange.filter((o) => o.payment === 'QRIS').length;
  const split = inRange.length
    ? `${Math.round((cash / inRange.length) * 100)}% / ${Math.round(
        (qris / inRange.length) * 100
      )}%`
    : '—';
  const series = days.map((day) => ({
    day,
    total: s.data.orders
      .filter(
        (o) =>
          o.status === 'Completed' &&
          o.payment &&
          localDay(o.createdAt) === day
      )
      .reduce((sum, o) => sum + o.total, 0),
  }));
  const peak = Math.max(1, ...series.map((x) => x.total));
  const label = (day: string) =>
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${day}T00:00:00Z`));
  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Revenue"
        description="Period-aware revenue with definition and freshness context."
      />
      <div className="toolbar">
        <div className="segment" role="group" aria-label="Revenue period">
          {(
            [
              ['week', 'Last 7 days'],
              ['month', 'Last 30 days'],
              ['custom', 'Custom'],
            ] as const
          ).map(([k, text]) => (
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>
              {text}
            </button>
          ))}
        </div>
        {mode === 'custom' && (
          <>
            <Input
              label="From"
              type="date"
              value={from}
              max={today()}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={to}
              max={today()}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
      </div>
      {invalid && (
        <div className="alert bad" role="alert">
          From date must be on or before To date.
        </div>
      )}
      <div className="metric-grid">
        <Metric
          label="Net revenue"
          value={idr(net)}
          delta={`${inRange.length} paid orders`}
          icon={<WalletCards />}
        />
        <Metric
          label="Paid orders"
          value={inRange.length.toLocaleString('id-ID')}
          icon={<ClipboardCheck />}
        />
        <Metric label="Average ticket" value={idr(average)} icon={<BarChart3 />} />
        <Metric
          label="Cash / QRIS"
          value={split}
          help={`${cash} cash · ${qris} QRIS`}
          icon={<Scale />}
        />
      </div>
      <Card>
        <SectionTitle
          title="Revenue trend"
          meta={`${label(start)} – ${label(end)} · Asia/Jakarta · ${inRange.length} paid orders`}
        />
        {series.length ? (
          <div
            className="bar-chart"
            role="img"
            aria-label={`Revenue by day from ${label(start)} to ${label(end)}`}
          >
            {series.map((x) => (
              <div key={x.day}>
                <span
                  style={{ height: `${Math.max(2, (x.total / peak) * 100)}%` }}
                  title={idr(x.total)}
                />
                <small>{label(x.day)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No paid orders in this period.</p>
        )}
        <p className="definition">
          Definition: completed payments less void reversals; excludes held and
          unpaid orders. Refreshed{' '}
          {new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date())}
          .
        </p>
      </Card>
    </>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

type ExpenseDraftLine = Omit<ExpenseLine, 'amount'> & { amount?: number };

export function ExpensesPage() {
  const s = useStore();
  const formRef = useRef<HTMLFormElement>(null);
  const request = useRef(0);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [parsing, setParsing] = useState(false);
  const emptyLine = (): ExpenseDraftLine => ({
    id: crypto.randomUUID(),
    description: '',
  });
  const [lines, setLines] = useState<ExpenseDraftLine[]>([emptyLine()]);
  const [toInventory, setToInventory] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const invalidRange = !!from && !!to && from > to;
  const shown = invalidRange
    ? []
    : s.data.expenses.filter(
        (e) => (!from || e.date >= from) && (!to || e.date <= to)
      );
  const categories = [
    ...new Map(
      s.data.expenses
        .filter((e) => e.category !== 'Uncategorized')
        .map((e) => [e.category.trim().toLowerCase(), e.category.trim()] as const)
        .reverse()
    ).values(),
  ];
  const lineTotal = lines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0
  );
  const updateLine = (id: string, patch: Partial<ExpenseDraftLine>) =>
    setLines((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const close = () => {
    request.current++;
    formRef.current?.reset();
    setLines([emptyLine()]);
    setToInventory(false);
    setError('');
    setFile(undefined);
    setPreview('');
    setParsing(false);
    setOpen(false);
  };
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );
  const upload = async (receipt: File) => {
    const generation = ++request.current;
    setParsing(true);
    setError('');
    try {
      const result = await parseReceipt(
          receipt,
          fetch,
          s.user.csrfToken,
          s.business
        ),
        form = formRef.current;
      if (generation !== request.current) return;
      if (form) {
        (form.elements.namedItem('label') as HTMLInputElement).value =
          result.merchant;
        (form.elements.namedItem('category') as HTMLInputElement).value =
          result.category;
        (form.elements.namedItem('date') as HTMLInputElement).value =
          result.date;
      }
      setLines(
        result.lines.length
          ? result.lines.map((x) => ({ ...x, id: crypto.randomUUID() }))
          : [emptyLine()]
      );
    } catch (e) {
      if (generation === request.current) {
        const message = e instanceof Error ? e.message : '';
        setError(
          message.includes('not configured')
            ? message
            : message.includes('invalid receipt data')
            ? message
            : 'Receipt could not be parsed. Check the image and retry.'
        );
      }
    } finally {
      if (generation === request.current) setParsing(false);
    }
  };
  const choose = (receipt?: File) => {
    if (!receipt) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(receipt.type)) {
      setError('Receipt must be a JPEG, PNG, or WebP image.');
      return;
    }
    if (receipt.size > RECEIPT_MAX_BYTES) {
      setError('Receipt image must be 5 MB or smaller.');
      return;
    }
    setFile(receipt);
    setPreview(URL.createObjectURL(receipt));
    void upload(receipt);
  };
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      fd = new FormData(form),
      label = String(fd.get('label')).trim(),
      category = String(fd.get('category')).trim(),
      date = String(fd.get('date')),
      amount = Number(fd.get('amount'));
    if (!label || !category || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Description, category, and a valid date are required.');
      return;
    }
    if (
      lines.some(
        (x) =>
          !x.description.trim() ||
          !Number.isFinite(Number(x.amount)) ||
          Number(x.amount) <= 0 ||
          (x.quantity !== undefined &&
            (!Number.isFinite(Number(x.quantity)) || Number(x.quantity) <= 0))
      )
    ) {
      setError(
        'Every line needs a description and positive amount; quantity must be positive when supplied.'
      );
      return;
    }
    if (!lines.length) {
      setError('At least one valid line is required.');
      return;
    }
    const cleanLines = lines.map((x) => ({
      ...x,
      description: x.description.trim(),
      unit: x.unit?.trim() || undefined,
      quantity: x.quantity === undefined ? undefined : Number(x.quantity),
      amount: Number(x.amount),
    }));
    if (toInventory && !cleanLines.some((x) => x.quantity && x.unit)) {
      setError(
        'Add a quantity and unit to at least one line to record stock.'
      );
      return;
    }
    const stock = toInventory
      ? stockFromExpenseLines(s.data.inventory, cleanLines, label, s.user.name)
      : undefined;
    s.update((d) => ({
      ...d,
      expenses: [
        {
          id: crypto.randomUUID(),
          label,
          category,
          date,
          lines: cleanLines,
          amount: cleanLines.length
            ? cleanLines.reduce((sum, x) => sum + x.amount, 0)
            : amount,
        },
        ...d.expenses,
      ],
      ...(stock
        ? {
            inventory: stock.inventory,
            inventoryMovements: [...stock.movements, ...d.inventoryMovements],
          }
        : {}),
    }));
    close();
  };
  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Expenses"
        description="Record and maintain non-inventory operating expenses."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Add expense
          </Button>
        }
      />
      {open && (
        <Modal title="Add expense" onClose={close} className="wide">
          {error && (
            <div className="alert bad" role="alert">
              {error}
            </div>
          )}
          <form ref={formRef} onSubmit={add}>
            <Input
              label="Receipt image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {preview && (
              <img
                className="receipt-preview"
                src={preview}
                alt="Selected receipt preview"
              />
            )}
            {parsing && <p role="status">Parsing receipt…</p>}
            {file && error && (
              <Button type="button" onClick={() => void upload(file)}>
                Retry receipt
              </Button>
            )}
            <Input required label="Description" name="label" />
            <Input
              required
              label="Category"
              name="category"
              list="expense-categories"
            />
            <datalist id="expense-categories">
              {categories.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
            <Input required label="Date" name="date" type="date" />
            <div className="expense-lines">
              <div className="expense-line-head" aria-hidden="true">
                <span>Description</span>
                <span>Quantity</span>
                <span>Unit</span>
                <span>Amount</span>
                <span />
              </div>
              {lines.map((line, i) => (
                <div className="expense-line" key={line.id}>
                  <div className="line-field">
                    <span className="line-label">Description</span>
                    <Input
                      required
                      aria-label={`Line ${i + 1} description`}
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.id, { description: e.target.value })
                      }
                    />
                  </div>
                  <div className="line-field">
                    <span className="line-label">Quantity</span>
                    <NumberInput
                      aria-label={`Line ${i + 1} quantity`}
                      decimals={2}
                      min={0.01}
                      value={line.quantity ?? ''}
                      onValueChange={(quantity) =>
                        updateLine(line.id, {
                          quantity: quantity === '' ? undefined : quantity,
                        })
                      }
                    />
                  </div>
                  <div className="line-field">
                    <span className="line-label">Unit</span>
                    <Input
                      aria-label={`Line ${i + 1} unit`}
                      value={line.unit || ''}
                      onChange={(e) =>
                        updateLine(line.id, { unit: e.target.value })
                      }
                    />
                  </div>
                  <div className="line-field">
                    <span className="line-label">Amount</span>
                    <NumberInput
                      required
                      aria-label={`Line ${i + 1} amount`}
                      value={line.amount ?? ''}
                      onValueChange={(amount) =>
                        updateLine(line.id, {
                          amount: amount === '' ? undefined : amount,
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={lines.length === 1}
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() =>
                      setLines((xs) =>
                        xs.length === 1
                          ? xs
                          : xs.filter((x) => x.id !== line.id)
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="expense-inventory">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={toInventory}
                  onChange={(e) => setToInventory(e.target.checked)}
                />
                Add these line items to inventory
              </label>
              <small>
                Lines with a quantity and unit increase stock on hand and append
                a receive movement.
              </small>
            </div>
            <div className="expense-lines-footer">
              <Button
                type="button"
                onClick={() =>
                  setLines((xs) => [
                    ...xs,
                    { id: crypto.randomUUID(), description: '' },
                  ])
                }
              >
                Add line
              </Button>
              <strong>Line total: {idr(lineTotal)}</strong>
            </div>
            <FormActions onCancel={close} submit="Record expense" />
          </form>
        </Modal>
      )}
      <div className="split">
        <Card>
          <SectionTitle title={from || to ? 'Filtered total' : 'Total recorded'} />
          <div className="big-stat">
            <WalletCards />
            <strong>{idr(shown.reduce((a, e) => a + e.amount, 0))}</strong>
            <span>
              {shown.length} {shown.length === 1 ? 'record' : 'records'}
              {from || to ? ' · filtered' : ''}
            </span>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Categories" meta="Distinct expense categories" />
          <div className="big-stat">
            <ClipboardCheck />
            <strong>{categories.length}</strong>
            <span>categories in use</span>
          </div>
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="Expense ledger"
          meta={`${shown.length} records`}
          action={
            <div className="expense-filters">
              <Input
                label="From"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          }
        />
        {invalidRange && (
          <div className="alert bad" role="alert">
            From date must be on or before To date.
          </div>
        )}
        {!shown.length && !invalidRange && (
          <p className="muted">No expenses in this date range.</p>
        )}
        {shown.map((e) => (
          <div className="expense-record" key={e.id}>
            <div className="status-row">
              <div>
                <strong>{e.label}</strong>
                <small>
                  {e.date} · {e.category}
                  {e.lines.length
                    ? ` · ${e.lines.length} line${e.lines.length === 1 ? '' : 's'}`
                    : ''}
                </small>
              </div>
              <div className="status-end">
                <b>{idr(e.amount)}</b>
                <div className="row-actions">
                  <Button onClick={() => setEditing(e.id)}>Edit</Button>
                  {e.lines.length > 0 && (
                    <Button
                      aria-expanded={expanded === e.id}
                      aria-controls={`expense-details-${e.id}`}
                      onClick={() =>
                        setExpanded(expanded === e.id ? undefined : e.id)
                      }
                    >
                      {expanded === e.id
                        ? `Collapse ${e.label}`
                        : `Expand ${e.label}`}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => setDeleting(e.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
            {expanded === e.id && (
              <div
                id={`expense-details-${e.id}`}
                className="expense-details"
                role="region"
                aria-label={`${e.label} expense details`}
              >
                {e.lines.map((line) => (
                  <div key={line.id}>
                    <span>
                      <strong>{line.description}</strong>
                      <small>
                        {line.quantity ?? '—'} {line.unit || ''}
                      </small>
                    </span>
                    <b>{idr(line.amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>
      {editing &&
        (() => {
          const record = s.data.expenses.find((x) => x.id === editing);
          if (!record) return null;
          return (
            <Modal title="Edit expense" onClose={() => setEditing(undefined)}>
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const fd = new FormData(ev.currentTarget),
                    label = String(fd.get('label')).trim(),
                    category = String(fd.get('category')).trim(),
                    date = String(fd.get('date')),
                    amount = Number(fd.get('amount'));
                  if (
                    !label ||
                    !category ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                  ) {
                    setError(
                      'Description, category, date, and a positive amount are required.'
                    );
                    return;
                  }
                  s.update((d) => ({
                    ...d,
                    expenses: d.expenses.map((x) =>
                      x.id === record.id
                        ? {
                            ...x,
                            label,
                            category,
                            date,
                            amount: x.lines.length ? x.amount : amount,
                          }
                        : x
                    ),
                    audit: [`Expense ${record.id} edited`, ...d.audit],
                  }));
                  setEditing(undefined);
                  setError('');
                }}
              >
                <Input
                  label="Description"
                  name="label"
                  defaultValue={record.label}
                  required
                />
                <Input
                  label="Category"
                  name="category"
                  defaultValue={record.category}
                  list="expense-categories-edit"
                  required
                />
                <datalist id="expense-categories-edit">
                  {categories.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
                <Input
                  label="Date"
                  name="date"
                  type="date"
                  defaultValue={record.date}
                  required
                />
                <NumberInput
                  label="Amount (IDR)"
                  name="amount"
                  min={1}
                  defaultValue={record.amount}
                  disabled={record.lines.length > 0}
                  required
                />
                <FormActions
                  onCancel={() => setEditing(undefined)}
                  submit="Save expense"
                />
              </form>
            </Modal>
          );
        })()}
      {deleting && (
        <Modal
          title="Delete this expense?"
          onClose={() => setDeleting(undefined)}
        >
          <p>The record and its line items will be removed from this business.</p>
          <div className="form-actions">
            <Button onClick={() => setDeleting(undefined)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                s.update((d) => ({
                  ...d,
                  expenses: d.expenses.filter((x) => x.id !== deleting),
                }));
                setDeleting(undefined);
              }}
            >
              Delete expense
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function InventoryPage() {
  const s = useStore();
  const [itemId, setItemId] = useState(s.data.inventory[0]?.id || '');
  const [recipe, setRecipe] = useState(100);
  const [receiving, setReceiving] = useState('');
  const [receiveNote, setReceiveNote] = useState('');
  const [cost, setCost] = useState('');
  const [moved, setMoved] = useState('');
  const item = s.data.inventory.find((x) => x.id === itemId) || s.data.inventory[0];
  const base = (unit?: string) =>
    unit === 'kg'
      ? 'g'
      : unit === 'liter' || unit === 'l'
      ? 'ml'
      : unit === 'g'
      ? 'g'
      : unit === 'ml'
      ? 'ml'
      : undefined;
  const stockBase =
    item && base(item.unit)
      ? unitConvert(
          item.quantity,
          item.unit as 'kg' | 'liter',
          base(item.unit) as 'g' | 'ml'
        )
      : 0;
  const portions = item && stockBase > 0 && recipe > 0 ? Math.floor(stockBase / recipe) : 0;
  const costPerBase =
    item?.unitCost && base(item.unit)
      ? item.unitCost / (base(item.unit) === 'g' ? 1000 : 1000)
      : 0;
  const portionCost = Math.round(costPerBase * recipe);
  const movements = s.data.inventoryMovements.filter((m) => m.itemId === item?.id);
  const inventoryColumns: DataTableColumn<InventoryItem>[] = [
    {
      key: 'name',
      label: 'Ingredient',
      value: (x) => x.name,
      render: (x) => (
        <span>
          <strong>{x.name}</strong>
          <small>{x.unit}</small>
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'On hand',
      value: (x) => x.quantity,
      render: (x) => `${x.quantity.toLocaleString('id-ID')} ${x.unit}`,
    },
    {
      key: 'reorderAt',
      label: 'Reorder at',
      value: (x) => x.reorderAt,
      render: (x) => `${x.reorderAt.toLocaleString('id-ID')} ${x.unit}`,
    },
    {
      key: 'status',
      label: 'Status',
      value: (x) => x.status,
      render: (x) => (
        <Badge
          tone={
            x.status === 'Healthy' ? 'good' : x.status === 'Low' ? 'warn' : 'bad'
          }
        >
          {x.status}
        </Badge>
      ),
    },
    {
      key: 'unitCost',
      label: 'Unit cost',
      value: (x) => x.unitCost ?? 0,
      render: (x) => (x.unitCost ? idr(x.unitCost) : '—'),
    },
    {
      key: 'value',
      label: 'Stock value',
      value: (x) => (x.unitCost ? x.quantity * x.unitCost : 0),
      render: (x) =>
        x.unitCost ? idr(Math.round(x.quantity * x.unitCost)) : '—',
    },
    {
      key: 'last',
      label: 'Last movement',
      value: (x) =>
        s.data.inventoryMovements.find((m) => m.itemId === x.id)?.at || '',
      render: (x) => {
        const last = s.data.inventoryMovements.find((m) => m.itemId === x.id);
        return last ? localDateTime(last.at) : '—';
      },
    },
  ];
  const saveCost = () => {
    if (!item) return;
    const value = Number(cost);
    if (!Number.isFinite(value) || value < 0) {
      setMoved('Enter a non-negative unit cost.');
      return;
    }
    s.update(
      (d) => ({
        ...d,
        inventory: d.inventory.map((x) =>
          x.id === item.id ? { ...x, unitCost: value } : x
        ),
      }),
      `Unit cost updated for ${item.name}`
    );
    setCost('');
    setMoved('Unit cost saved.');
  };
  const receive = () => {
    if (!item) return;
    const qty = Number(receiving);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMoved('Enter a quantity greater than zero.');
      return;
    }
    const movement: InventoryMovement = {
      id: crypto.randomUUID(),
      itemId: item.id,
      type: 'receive',
      quantity: qty,
      unit: item.unit,
      note: receiveNote.trim() || 'Stock receipt',
      at: new Date().toISOString(),
      actor: s.user.name,
    };
    s.update(
      (d) => ({
        ...d,
        inventory: d.inventory.map((x) =>
          x.id === item.id
            ? {
                ...x,
                quantity: Math.round((x.quantity + qty) * 1000) / 1000,
                status: x.quantity + qty >= x.reorderAt ? 'Healthy' : x.status,
              }
            : x
        ),
        inventoryMovements: [movement, ...d.inventoryMovements],
      }),
      `Received ${qty} ${item.unit} of ${item.name}`
    );
    setReceiving('');
    setReceiveNote('');
    setMoved(`Recorded ${qty} ${item.unit} for ${item.name}.`);
  };
  if (!item)
    return (
      <>
        <PageHead
          eyebrow="Operations"
          title="Inventory & recipes"
          description="Stock, costs, and append-only movements."
        />
        <p className="muted">No inventory items recorded for this business.</p>
      </>
    );
  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Inventory & recipes"
        description="Stock on hand, unit costs, and append-only movements feed recipe costing."
      />
      <Card>
        <SectionTitle
          title="Stock on hand"
          meta={`${s.data.inventory.length} ingredients`}
        />
        <DataTable
          ariaLabel="Inventory"
          rows={s.data.inventory}
          rowKey={(x) => x.id}
          columns={inventoryColumns}
          rowActions={(x) => (
            <Button
              aria-label={`Open ${x.name}`}
              aria-pressed={x.id === item.id}
              onClick={() => setItemId(x.id)}
            >
              Open
            </Button>
          )}
          empty="No inventory items recorded."
        />
      </Card>
      <div className="ingredient-hero">
        <div>
          <Scale />
          <span>Selected ingredient</span>
          <strong>{item.name}</strong>
        </div>
        <div>
          <PackageOpen />
          <span>Stock on hand</span>
          <strong>
            {item.quantity.toLocaleString('id-ID')} {item.unit}
          </strong>
        </div>
        <div>
          <Users />
          <span>Parts per stock</span>
          <strong>{portions.toLocaleString('id-ID')}</strong>
        </div>
      </div>
      <div className="split inventory-conversion">
        <Card>
          <SectionTitle
            title="Stock and recipe yield"
            meta="Derived from recorded stock"
          />
          <Select
            label="Ingredient"
            value={item.id}
            onChange={(e) => setItemId(e.target.value)}
          >
            {s.data.inventory.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <NumberInput
            label="Recipe portion (base unit: g or ml)"
            min={1}
            value={recipe}
            onValueChange={(portion) => setRecipe(portion === '' ? 0 : portion)}
          />
          <div className="formula">
            <span>
              {item.quantity.toLocaleString('id-ID')} {item.unit} →{' '}
              {stockBase.toLocaleString('id-ID')} {base(item.unit)} ÷ {recipe}
            </span>
            <strong>= {portions.toLocaleString('id-ID')} portions</strong>
          </div>
          <p className="muted">
            Reorder at {item.reorderAt.toLocaleString('id-ID')} {item.unit} ·
            status {item.status}
          </p>
        </Card>
        <Card>
          <SectionTitle
            title="Unit cost"
            meta={
              item.unitCost
                ? `${idr(item.unitCost)} per ${item.unit}`
                : 'Not priced'
            }
          />
          <NumberInput
            label={`Cost per ${item.unit} (IDR)`}
            min={0}
            value={cost}
            placeholder={item.unitCost ? String(item.unitCost) : ''}
            onValueChange={(next) => setCost(next === '' ? '' : String(next))}
          />
          <div className="formula highlight">
            <span>
              {recipe} {base(item.unit)} × {idr(item.unitCost || 0)}/{item.unit}
            </span>
            <strong>= {idr(portionCost)}/portion</strong>
          </div>
          <Button variant="primary" disabled={!s.writable} onClick={saveCost}>
            Save unit cost
          </Button>
        </Card>
      </div>
      <div className="split">
        <Card>
          <SectionTitle title="Receive stock" meta="Appends a movement" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              receive();
            }}
          >
            <NumberInput
              label={`Quantity (${item.unit})`}
              decimals={2}
              min={0.01}
              value={receiving}
              onValueChange={(next) =>
                setReceiving(next === '' ? '' : String(next))
              }
            />
            <Input
              label="Note"
              value={receiveNote}
              onChange={(e) => setReceiveNote(e.target.value)}
              placeholder="Supplier, invoice, or correction"
            />
            <Button variant="primary" disabled={!s.writable} type="submit">
              Receive stock
            </Button>
          </form>
          {moved && (
            <p className="alert" role="status">
              {moved}
            </p>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="Ingredient movements"
            meta={`${movements.length} recorded`}
          />
          {movements.length ? (
            movements.map((m) => (
              <StatusRow
                key={m.id}
                title={`${m.type === 'receive' ? '+' : m.type === 'consume' ? '−' : ''}${m.quantity.toLocaleString(
                  'id-ID'
                )} ${m.unit}`}
                meta={`${m.note} · ${m.actor} · ${localDateTime(m.at)}`}
                status={
                  m.type === 'receive'
                    ? 'Received'
                    : m.type === 'consume'
                    ? 'Consumed'
                    : 'Adjusted'
                }
              />
            ))
          ) : (
            <p className="muted">No movements recorded for this ingredient.</p>
          )}
          {s.data.inventory.length > 1 && (
            <p className="muted">Showing movements for {item.name} only.</p>
          )}
        </Card>
      </div>
    </>
  );
}

export function ProfitabilityPage() {
  const s = useStore();
  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Menu profitability"
        description="Sales price, recipe cost rolled up from stocked ingredients, contribution, and margin."
      />
      <Card>
        <div className="table-list">
          <div className="table-head profit">
            <span>Menu</span>
            <span>Price</span>
            <span>Recipe cost</span>
            <span>Margin</span>
            <span>Signal</span>
          </div>
          {s.data.menus.map((m) => {
            const version = m.versions?.find((v) => v.version === m.currentVersion);
            const rollup = recipeCost(version, s.data.inventory);
            const cost = rollup.cost || m.cost;
            const margin = ((m.price - cost) / m.price) * 100;
            return (
              <div className="table-row profit" key={m.id}>
                <span>
                  <strong>{version?.name || m.name}</strong>
                  <small>
                    {m.category} ·{' '}
                    {rollup.cost
                      ? `${rollup.priced} of ${rollup.total} ingredients priced from stock`
                      : 'estimated unit cost'}
                  </small>
                </span>
                <b>{idr(m.price)}</b>
                <span>{idr(cost)}</span>
                <strong>{margin.toFixed(1)}%</strong>
                <Badge tone={margin > 65 ? 'good' : margin > 55 ? 'warn' : 'bad'}>
                  {margin > 65 ? 'Healthy' : margin > 55 ? 'Watch' : 'Low'}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

export function ManagerSop() {
  const s = useStore();
  const activeSops = s.data.sops.filter((x) => x.active);
  const [sopId, setSopId] = useState(activeSops[0]?.id || '');
  const sop = activeSops.find((x) => x.id === sopId) || activeSops[0];
  const [done, setDone] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const complete = () => {
    if (!sop) return;
    s.update((d) => ({
      ...d,
      sopHistory: [
        `${new Date().toLocaleString('id-ID')} · ${s.user.name} · ${sop.title} v${sop.version}`,
        ...d.sopHistory,
      ],
    }));
    setDone([]);
  };
  const addNote = () => {
    if (!note.trim()) return;
    s.update((d) => ({
      ...d,
      notes: [
        {
          id: crypto.randomUUID(),
          text: note.trim(),
          date: new Date().toISOString().slice(0, 10),
        },
        ...d.notes,
      ],
    }));
    setNote('');
    setOpen(false);
  };
  const close = () => {
    setNote('');
    setOpen(false);
  };
  if (!sop)
    return (
      <>
        <PageHead
          eyebrow="Operations"
          title="SOP run & day notes"
          description="Complete the assigned checklist with visible progress and immutable history."
        />
        <p className="muted">No SOP templates are published for this business yet.</p>
      </>
    );
  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="SOP run & day notes"
        description="Complete the assigned checklist with visible progress and immutable history."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Add manager day note
          </Button>
        }
      />
      {open && (
        <Modal title="Add manager day note" onClose={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addNote();
            }}
          >
            <Input
              label="New day note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <FormActions onCancel={close} submit="Add note" />
          </form>
        </Modal>
      )}
      <div className="split">
        <Card>
          <SectionTitle
            title={sop.title}
            meta={`Version ${sop.version} · required today`}
          />
          {activeSops.length > 1 && (
            <Select
              label="Checklist"
              value={sop.id}
              onChange={(e) => {
                setSopId(e.target.value);
                setDone([]);
              }}
            >
              {activeSops.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title} · v{x.version}
                </option>
              ))}
            </Select>
          )}
          <Progress
            label="Checklist progress"
            value={sop.steps.length ? (done.length / sop.steps.length) * 100 : 0}
          />
          <div className="checklist">
            {sop.steps.map((step) => (
              <label key={step}>
                <input
                  type="checkbox"
                  checked={done.includes(step)}
                  onChange={(e) =>
                    setDone((d) =>
                      e.target.checked
                        ? [...d, step]
                        : d.filter((x) => x !== step)
                    )
                  }
                />
                <span>{step}</span>
              </label>
            ))}
          </div>
          <div className="card-actions">
            <Button onClick={() => setDone([])}>Reset run</Button>
            <Button
              variant="primary"
              disabled={done.length !== sop.steps.length || !s.writable}
              onClick={complete}
            >
              Complete SOP
            </Button>
          </div>
        </Card>
        <Card>
          <SectionTitle
            title="Completion history"
            meta={`${s.data.sopHistory.length} records`}
          />
          {s.data.sopHistory.length ? (
            s.data.sopHistory.map((entry, i) => (
              <div className="audit" key={i}>
                <span>●</span>
                {entry}
              </div>
            ))
          ) : (
            <p className="muted">No completed runs yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
