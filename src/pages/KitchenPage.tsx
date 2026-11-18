import { useState } from 'react';
import { Clock3, Flame, PackageOpen } from 'lucide-react';
import { EmptyState } from '../components/ui/empty-state';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Metric, PageHead, SectionTitle } from '../components/molecules';
import { useStore } from '../store';
import { printOrder, printReason } from '../services/printing';
import type { MenuItem, Order } from '../domain';

const age = (createdAt: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  );
  return minutes < 60
    ? `${minutes} min`
    : minutes < 1440
    ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
    : `${Math.floor(minutes / 1440)} days`;
};
const tables = (order: Order, names: Map<string, string>) =>
  order.tableIds?.map((id) => names.get(id) || id).join(', ') ||
  order.table ||
  'No table';

export function KitchenPage() {
  const { data, sessionMenus, update, business, user } = useStore();
  const [selected, setSelected] = useState<string>();
  const [printNotice, setPrintNotice] = useState('');
  const orders = data.orders
    .filter((o) => o.status === 'Preparing')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const order = orders.find((o) => o.id === selected);
  const tableNames = new Map(data.tables.map((t) => [t.id, t.name]));
  const availability = (
    menu: MenuItem,
    value: NonNullable<MenuItem['availability']>
  ) =>
    update((d) => {
      const active = d.experiments.findIndex((e) => e.status === 'active');
      return active < 0
        ? {
            ...d,
            menus: d.menus.map((m) =>
              m.id === menu.id ? { ...m, availability: value } : m
            ),
          }
        : {
            ...d,
            experiments: d.experiments.map((e, i) =>
              i === active
                ? {
                    ...e,
                    menuDrafts: e.menuDrafts.map((m) =>
                      m.id === menu.id ? { ...m, availability: value } : m
                    ),
                  }
                : e
            ),
          };
    });
  const ready = () => {
    if (!order) return;
    update((d) => ({
      ...d,
      orders: d.orders.map((o) =>
        o.id === order.id && o.status === 'Preparing'
          ? { ...o, status: 'Ready' }
          : o
      ),
    }));
    setSelected(undefined);
  };
  const printTicket = async () => {
    if (!order) return;
    setPrintNotice('Printing…');
    try {
      const result = await printOrder(
        business,
        order.id,
        'kitchen',
        false,
        user.csrfToken
      );
      setPrintNotice(
        result.printed
          ? `Ticket sent to ${result.printerName}.`
          : printReason(result.reason)
      );
    } catch (reason) {
      setPrintNotice(
        reason instanceof Error ? reason.message : 'Print failed.'
      );
    }
  };
  const low = sessionMenus.filter(
    (m) => !m.archived && m.availability === 'low'
  ).length;
  const soldOut = sessionMenus.filter(
    (m) => !m.archived && m.availability === 'sold-out'
  ).length;
  return (
    <>
      <PageHead
        eyebrow="Kitchen"
        title="Kitchen"
        description="Preparing orders only, oldest first."
      />
      <div className="metric-grid">
        <Metric
          label="Preparing"
          value={String(orders.length)}
          delta="Oldest first"
          icon={<Flame />}
        />
        <Metric
          label="Oldest ticket"
          value={orders.length ? age(orders[0].createdAt) : '—'}
          delta="Time since order"
          icon={<Clock3 />}
        />
        <Metric
          label="Low stock"
          value={String(low)}
          delta="Marked low"
          icon={<PackageOpen />}
        />
        <Metric
          label="Sold out"
          value={String(soldOut)}
          delta="Hidden from ordering"
          icon={<PackageOpen />}
        />
      </div>
      <section>
        <SectionTitle title="Preparing orders" meta={`${orders.length} waiting`} />
        {orders.length ? (
          <div className="kitchen-grid">
            {orders.map((o) => (
              <button
                key={o.id}
                className="kitchen-order"
                aria-label={`Open order ${o.id}`}
                onClick={() => {
                  setPrintNotice('');
                  setSelected(o.id);
                }}
              >
                <span>
                  <strong>{o.id}</strong>
                  <Badge tone="warn">{age(o.createdAt)}</Badge>
                </span>
                <b>
                  {o.service} · {tables(o, tableNames)}
                </b>
                {o.lines.map((l) => (
                  <small key={l.id}>
                    {l.qty} × {l.name}
                    {l.variations?.length
                      ? ` · ${l.variations.map((v) => v.optionName).join(' · ')}`
                      : l.modifier
                      ? ` · ${l.modifier}`
                      : ''}
                    {l.note ? ` · ${l.note}` : ''}
                  </small>
                ))}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No orders preparing">
            <p>New preparing orders will appear here.</p>
          </EmptyState>
        )}
      </section>
      <section className="kitchen-availability">
        <SectionTitle title="Menu availability" meta="Current session menu" />
        <div className="planning-grid">
          {sessionMenus
            .filter((m) => !m.archived)
            .map((m) => (
              <article className="card kitchen-menu" key={m.id}>
                <span>
                  <strong>{m.name}</strong>
                  <Badge
                    tone={
                      m.availability === 'sold-out'
                        ? 'bad'
                        : m.availability === 'low'
                        ? 'warn'
                        : 'good'
                    }
                  >
                    {m.availability === 'sold-out'
                      ? 'Sold out'
                      : m.availability === 'low'
                      ? 'Low'
                      : 'Available'}
                  </Badge>
                </span>
                <div className="row-actions">
                  <Button onClick={() => availability(m, 'low')}>Set low</Button>
                  <Button onClick={() => availability(m, 'sold-out')}>
                    Set sold out
                  </Button>
                  {m.availability !== 'available' && (
                    <Button
                      variant="primary"
                      onClick={() => availability(m, 'available')}
                    >
                      Restore available
                    </Button>
                  )}
                </div>
              </article>
            ))}
        </div>
      </section>
      {order && (
        <div
          className="modal-backdrop kitchen-detail"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-order-title"
        >
          <div>
            <header>
              <h1 id="kitchen-order-title">Order {order.id}</h1>
              <Button onClick={() => setSelected(undefined)}>Close</Button>
            </header>
            <p>
              <strong>{age(order.createdAt)}</strong> · {order.service} ·{' '}
              {tables(order, tableNames)}
            </p>
            <ul>
              {order.lines.map((l) => (
                <li key={l.id}>
                  <strong>
                    {l.qty} × {l.name}
                  </strong>
                  {l.variations?.length ? (
                    <span>
                      Variations:{' '}
                      {l.variations.map((v) => v.optionName).join(' · ')}
                    </span>
                  ) : (
                    l.modifier && <span>Modifier: {l.modifier}</span>
                  )}
                  {l.note && <span>Note: {l.note}</span>}
                </li>
              ))}
            </ul>
            {printNotice && (
              <p className="hint-text" role="status">
                {printNotice}
              </p>
            )}
            <div className="form-actions">
              <Button onClick={() => void printTicket()}>Print ticket</Button>
              <Button variant="primary" onClick={ready}>
                Mark Ready
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
