import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock3,
  Minus,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import {
  idr,
  localDateTime,
  validateBundle,
  type MenuItem,
  type MenuVersion,
  type Order,
  type SelectedVariation,
} from '../domain';
import { API, useStore } from '../store';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { Modal, PageHead, SectionTitle } from '../components/molecules';
import { MenuImage } from '../components/MenuImage';
import { useMenuImages } from '../services/menuImages';
import { printOrder, printReason, getReceiptHeader } from '../services/printing';
import { downloadReceiptJpg } from '../services/receiptImage';

type CatalogItem = MenuItem & MenuVersion & { bundleError?: string };

export function OrderEntry() {
  const s = useStore();
  const { images } = useMenuImages(s.business);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string>();
  const [notice, setNotice] = useState('');
  const [customError, setCustomError] = useState('');
  const [detail, setDetail] = useState<CatalogItem>();
  const [custom, setCustom] = useState<CatalogItem>();
  const [selections, setSelections] = useState<SelectedVariation[]>([]);
  const [customQty, setCustomQty] = useState(1);
  const [customNote, setCustomNote] = useState('');
  const [heldOpen, setHeldOpen] = useState(false);
  const [replacing, setReplacing] = useState<string>();
  const [checkout, setCheckout] = useState(false);
  const [receipt, setReceipt] = useState<Order>();
  const [printNotice, setPrintNotice] = useState('');
  const [tendered, setTendered] = useState('');
  const [payError, setPayError] = useState('');
  const [qris, setQris] = useState(false);
  const [paymentQr, setPaymentQr] = useState<{
    configured: boolean;
    updatedAt?: string;
  }>({ configured: false });
  const [receiptHeader, setReceiptHeader] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const timer = useRef<number>();
  const start = useRef({ x: 0, y: 0, long: false });

  const current = (id: string) => {
    const m = s.sessionMenus.find((x) => x.id === id);
    return m?.versions?.find((v) => v.version === m.currentVersion);
  };
  const catalog: CatalogItem[] = s.sessionMenus
    .filter((m) => !m.archived)
    .map((m) => {
      const v = m.versions!.find((v) => v.version === m.currentVersion)!;
      const bundleError =
        (m.kind || 'item') === 'bundle'
          ? validateBundle(m.id, v.components || [], s.sessionMenus)
          : '';
      return {
        ...m,
        ...v,
        bundleError,
        available: m.availability !== 'sold-out' && !bundleError,
      };
    });
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const categories = ['All', ...new Set(catalog.map((x) => x.category))];
  const filtered = catalog.filter(
    (x) =>
      (cat === 'All' || x.category === cat) &&
      x.name.toLowerCase().includes(q.toLowerCase())
  );
  const held = s.data.orders.filter((o) => o.status === 'Held');
  const line = s.cart.find((l) => l.id === edit);

  useEffect(() => {
    if (s.business === 'all') {
      setPaymentQr({ configured: false });
      setReceiptHeader('');
      return;
    }
    fetch(`${API}/payment-qr?business=${encodeURIComponent(s.business)}`, {
      credentials: 'same-origin',
    })
      .then((response) => response.json())
      .then(setPaymentQr)
      .catch(() => setPaymentQr({ configured: false }));
    getReceiptHeader(s.business)
      .then((result) => setReceiptHeader(result.header))
      .catch(() => setReceiptHeader(''));
  }, [s.business]);

  const orderTypes = s.data.orderTypes
    .filter((x) => x.enabled && !x.archived)
    .filter(
      (x, i, all) =>
        all.findIndex(
          (y) => y.name.trim().toLowerCase() === x.name.trim().toLowerCase()
        ) === i
    );
  const needsTable = !!s.data.orderTypes.find((x) => x.name === s.service)
    ?.requiresTable;
  const blocked = needsTable && !s.tableIds.length;
  const total = s.totals.total;
  const cashGiven = Number(tendered || 0);
  const change = Math.max(0, cashGiven - total);

  useEffect(() => {
    const table = new URLSearchParams(window.location.search).get('table');
    if (
      table &&
      s.data.tables.some(
        (t) =>
          t.id === table &&
          !t.archived &&
          t.enabled &&
          t.status === 'Available'
      )
    )
      s.setTableIds([table]);
  }, []);

  const openCustom = (item: CatalogItem, lineId?: string) => {
    const existing = s.cart.find((l) => l.id === lineId);
    const defaults = (item.variations || [])
      .filter((g) => g.required && g.options[0])
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        optionId: g.options[0].id,
        optionName: g.options[0].name,
        priceDelta: g.options[0].priceDelta,
      }));
    setCustom(item);
    setEdit(lineId);
    setSelections(
      existing?.variations?.length
        ? structuredClone(existing.variations)
        : defaults
    );
    setCustomQty(existing?.qty || 1);
    setCustomNote(existing?.note || '');
    setCustomError('');
  };
  const closeCustom = () => {
    setCustom(undefined);
    setEdit(undefined);
    setCustomError('');
  };
  const editLine = (id: string) => {
    const existing = s.cart.find((l) => l.id === id);
    if (!existing) return;
    const item =
      catalog.find((x) => x.id === existing.menuId) ||
      ({
        id: existing.menuId,
        name: existing.name,
        category: '',
        price: existing.basePrice ?? existing.price,
        cost: 0,
        available: true,
        icon: '',
        version: 1,
        description: '',
        ingredients: [],
        createdAt: '',
      } as CatalogItem);
    openCustom(item, id);
  };

  const applyCoupon = () => {
    const found = s.data.coupons.find(
      (c) =>
        c.code.toLowerCase() === couponCode.trim().toLowerCase() && c.active
    );
    if (!found) {
      setCouponError('Code is invalid or inactive.');
      return;
    }
    s.setCoupon(found);
    setCouponError('');
  };
  const resetPayment = () => {
    setCheckout(false);
    setQris(false);
    setTendered('');
    setPayError('');
  };
  const finish = (order: Order) => {
    setPrintNotice('');
    setReceipt(order);
    s.clearCart();
    resetPayment();
    void s.whenSaved().then(async () => {
      const outcomes = await Promise.all([
        printOrder(s.business, order.id, 'receipt', true, s.user.csrfToken)
          .then((result) =>
            result.printed ? `Receipt sent to ${result.printerName}.` : ''
          )
          .catch((reason) => `Receipt print failed: ${reason.message}`),
        printOrder(s.business, order.id, 'kitchen', true, s.user.csrfToken)
          .then((result) =>
            result.printed ? `Kitchen ticket sent to ${result.printerName}.` : ''
          )
          .catch((reason) => `Kitchen ticket print failed: ${reason.message}`),
      ]);
      setPrintNotice(outcomes.filter(Boolean).join(' '));
    });
  };
  const printReceiptCopy = async (type: 'receipt' | 'kitchen') => {
    if (!receipt) return;
    setPrintNotice('Printing…');
    try {
      const result = await printOrder(
        s.business,
        receipt.id,
        type,
        false,
        s.user.csrfToken
      );
      setPrintNotice(
        result.printed
          ? `${type === 'receipt' ? 'Receipt' : 'Kitchen ticket'} sent to ${
              result.printerName
            }.`
          : printReason(result.reason)
      );
    } catch (reason) {
      setPrintNotice(
        reason instanceof Error ? reason.message : 'Print failed.'
      );
    }
  };
  const saveReceiptJpg = () => {
    if (!receipt) return;
    const tenant = s.tenants.find((item) => item.id === s.business);
    const tables =
      receipt.tableIds?.map(
        (id) => s.data.tables.find((table) => table.id === id)?.name || id
      ) || [];
    try {
      downloadReceiptJpg(
        receipt,
        { name: tenant?.name || s.business, location: tenant?.location, header: receiptHeader },
        tables
      );
      setPrintNotice('Receipt JPG downloaded.');
    } catch (reason) {
      setPrintNotice(
        reason instanceof Error
          ? reason.message
          : 'The receipt image could not be created.'
      );
    }
  };
  const payCash = () => {
    if (cashGiven < total) {
      setPayError('Cash received must cover the amount due.');
      return;
    }
    try {
      const order = s.completeOrder('Cash', cashGiven);
      finish(order);
    } catch (reason) {
      setPayError(
        reason instanceof Error
          ? reason.message
          : 'Payment could not be recorded.'
      );
    }
  };
  const completeQris = () => {
    try {
      const order = s.completeOrder('QRIS');
      finish(order);
    } catch (reason) {
      setPayError(
        reason instanceof Error
          ? reason.message
          : 'Payment could not be recorded.'
      );
    }
  };
  const hold = () => {
    if (!s.cart.length) return;
    if (s.business === 'all') {
      setNotice('Select one business before holding an order.');
      return;
    }
    try {
      const order = s.completeOrder('Cash');
      s.setTableStatus(order.tableIds || [], 'Occupied');
      s.update((d) => ({
        ...d,
        orders: d.orders.map((x) =>
          x.id === order.id
            ? { ...x, status: 'Held', payment: undefined }
            : x
        ),
        audit: [`Order ${order.id} held for later`, ...d.audit],
      }));
      s.clearCart();
      setNotice('');
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : 'The order could not be held.'
      );
    }
  };
  const resume = (id: string) => {
    const o = s.data.orders.find((x) => x.id === id);
    if (
      !o ||
      !o.lines.every(
        (l) =>
          l.id &&
          l.menuId &&
          l.name &&
          Number.isFinite(l.price) &&
          Number.isInteger(l.qty) &&
          l.qty > 0
      )
    )
      return;
    const tableIds =
      o.tableIds?.filter((tableId) =>
        s.data.tables.some((t) => t.id === tableId && !t.archived)
      ) ||
      s.data.tables
        .filter((t) => !t.archived && (t.id === o.table || t.name === o.table))
        .map((t) => t.id);
    const coupon = o.coupon
      ? s.data.coupons.find(
          (c) => c.code.toLowerCase() === o.coupon!.toLowerCase() && c.active
        )
      : undefined;
    s.dispatch({ type: 'restore', lines: o.lines });
    s.setService(o.service);
    s.setTableIds(tableIds);
    s.setCoupon(coupon);
    setCouponCode(coupon?.code || '');
    setCouponError('');
    setNotice(
      o.coupon && !coupon
        ? `Coupon ${o.coupon} is unavailable or inactive and was not applied.`
        : ''
    );
    s.update((d) => ({
      ...d,
      orders: d.orders.filter((x) => x.id !== id),
    }));
    setReplacing(undefined);
    setHeldOpen(false);
  };
  const chooseHeld = (id: string) =>
    s.cart.length ? setReplacing(id) : resume(id);

  if (!s.writable)
    return (
      <>
        <PageHead
          eyebrow="Service"
          title="Fast order entry"
          description="Order entry is scoped to one business."
        />
        <Card>
          <SectionTitle
            title="Choose a business to start an order"
            meta="Aggregate view"
          />
          <p className="muted">
            This view combines every authorized business, so prices, tables and
            payment QR codes cannot be mixed. Select one business in the header
            to take an order.
          </p>
        </Card>
      </>
    );

  return (
    <>
      {notice && (
        <p className="alert bad" role="alert">
          {notice}
        </p>
      )}
      <PageHead
        eyebrow="Service"
        title="Fast order entry"
        description="Pick a category, tap products, and review the live order ledger."
        action={
          held.length ? (
            <Button onClick={() => setHeldOpen(true)}>
              <Clock3 /> {held.length} held{' '}
              {held.length === 1 ? 'order' : 'orders'}
            </Button>
          ) : undefined
        }
      />
      <div className="order-workspace">
        <nav className="category-rail" aria-label="Menu categories">
          {categories.map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </nav>
        <section className="product-canvas">
          <label className="search-box">
            <Search aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search menu"
            />
          </label>
          <div className="product-grid">
            {filtered.map((item) => (
              <div key={item.id} className="product-wrap">
                <button
                  className="product"
                  aria-disabled={!item.available}
                  aria-label={`${item.name} ${item.category}${
                    item.available
                      ? '; Enter or Space to add, Shift+Enter for details'
                      : ' Unavailable; Shift+Enter for details'
                  }`}
                  title="Long press or press Shift+Enter for details"
                  onPointerDown={(e) => {
                    start.current = {
                      x: e.clientX,
                      y: e.clientY,
                      long: false,
                    };
                    timer.current = window.setTimeout(() => {
                      start.current.long = true;
                      setDetail(item);
                    }, 600);
                  }}
                  onPointerMove={(e) => {
                    if (
                      Math.hypot(
                        e.clientX - start.current.x,
                        e.clientY - start.current.y
                      ) > 10
                    )
                      cancel();
                  }}
                  onPointerCancel={cancel}
                  onPointerUp={cancel}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    cancel();
                    setDetail(item);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.shiftKey) {
                      e.preventDefault();
                      setDetail(item);
                    }
                  }}
                  onClick={() => {
                    if (!start.current.long && item.available) openCustom(item);
                    start.current.long = false;
                  }}
                >
                  <MenuImage
                    business={s.business}
                    menuId={item.id}
                    version={images[item.id]}
                    className="menu-photo tile"
                    fallback={
                      <span className="product-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    }
                  />
                  <strong>{item.name}</strong>
                  <small>{item.category}</small>
                  {item.availability === 'low' && (
                    <span className="product-status">Low</span>
                  )}
                  {!item.available && (
                    <span className="product-status">
                      Unavailable · Sold out
                    </span>
                  )}
                  <b>{idr(item.price)}</b>
                  {item.available && (
                    <span className="product-plus" aria-hidden="true">
                      +
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
          {!filtered.length && (
            <EmptyState title="No products match">
              <p>Try another category or search term.</p>
            </EmptyState>
          )}
        </section>
        <aside className="order-ledger">
          <SectionTitle
            title="Current order"
            action={
              s.cart.length > 1 ? (
                <button className="link-button" onClick={() => s.clearCart()}>
                  Clear
                </button>
              ) : undefined
            }
            meta={`${s.cart.reduce((a, l) => a + l.qty, 0)} ${
              s.cart.reduce((a, l) => a + l.qty, 0) === 1 ? 'item' : 'items'
            }`}
          />
          <div
            className="segment service-modes"
            role="group"
            aria-label="Service mode"
          >
            {orderTypes.map((m) => (
              <button
                key={m.id}
                aria-pressed={s.service === m.name}
                onClick={() => s.setService(m.name)}
              >
                {m.name}
              </button>
            ))}
          </div>
          {!orderTypes.length && (
            <div className="alert" role="status">
              No order types available
            </div>
          )}
          {!s.activeShift && s.role === 'cashier' && (
            <p className="hint" role="status">
              No open shift.{' '}
              <Link to="/cashier/dashboard">Open a shift</Link> to reconcile
              cash at close.
            </p>
          )}
          {needsTable && (
            <fieldset className="table-picker">
              <legend>
                Table(s) <b aria-hidden="true">*</b>
              </legend>
              <div className="table-picker-grid">
                {s.data.tables
                  .filter((t) => !t.archived && t.enabled)
                  .map((t) => {
                    const taken = t.status !== 'Available';
                    return (
                      <button
                        type="button"
                        key={t.id}
                        className={`table-chip ${t.status
                          .toLowerCase()
                          .replaceAll(' ', '-')}`}
                        aria-pressed={s.tableIds.includes(t.id)}
                        disabled={taken}
                        onClick={() =>
                          s.setTableIds(
                            s.tableIds.includes(t.id)
                              ? s.tableIds.filter((id) => id !== t.id)
                              : [...s.tableIds, t.id]
                          )
                        }
                      >
                        <strong>{t.name}</strong>
                        <small>
                          {t.capacity} seats · {t.status}
                        </small>
                      </button>
                    );
                  })}
              </div>
              {blocked && (
                <p className="hint" role="status">
                  Select at least one table to continue.
                </p>
              )}
            </fieldset>
          )}
          <div className="cart-lines">
            {!s.cart.length ? (
              <EmptyState title="The ledger is empty">
                <p>Tap a product to begin.</p>
              </EmptyState>
            ) : (
              s.cart.map((l) => (
                <div className="cart-line" key={l.id}>
                  <button className="line-name" onClick={() => editLine(l.id)}>
                    <strong>{l.name}</strong>
                    <small>
                      {l.variations?.map((v) => v.optionName).join(' · ') ||
                        l.modifier ||
                        'Standard'}
                      {l.note && ` · ${l.note}`}
                    </small>
                  </button>
                  <div className="qty">
                    <button
                      aria-label={`Remove one ${l.name}`}
                      onClick={() =>
                        s.dispatch({ type: 'qty', id: l.id, delta: -1 })
                      }
                    >
                      <Minus />
                    </button>
                    <b>{l.qty}</b>
                    <button
                      aria-label={`Add one ${l.name}`}
                      onClick={() =>
                        s.dispatch({ type: 'qty', id: l.id, delta: 1 })
                      }
                    >
                      <Plus />
                    </button>
                    <button
                      aria-label={`Remove ${l.name}`}
                      onClick={() =>
                        s.dispatch({ type: 'qty', id: l.id, delta: -l.qty })
                      }
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <span>{idr(l.price * l.qty)}</span>
                </div>
              ))
            )}
          </div>
          {s.cart.length > 0 && (
            <div className="coupon-entry">
              <Input
                label="Coupon code"
                value={couponCode}
                list="active-coupons"
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponError('');
                }}
                error={couponError}
              />
              <datalist id="active-coupons">
                {s.data.coupons
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.type === 'percent'
                        ? `${c.value}%`
                        : `Rp ${c.value.toLocaleString('id-ID')}`}{' '}
                      · {c.reason}
                    </option>
                  ))}
              </datalist>
              <Button onClick={applyCoupon}>Apply</Button>
            </div>
          )}
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <b>{idr(s.totals.subtotal)}</b>
            </div>
            {s.totals.discount > 0 && (
              <div className="discount">
                <span>Discount · {s.coupon?.code}</span>
                <b>−{idr(s.totals.discount)}</b>
              </div>
            )}
            <div>
              <span>Tax · sample 10%</span>
              <b>{idr(s.totals.tax)}</b>
            </div>
            <div className="grand">
              <span>Total</span>
              <b>{idr(s.totals.total)}</b>
            </div>
            <div className="ledger-actions">
              <Button
                disabled={!s.cart.length || !s.service || blocked}
                onClick={hold}
              >
                Hold
              </Button>
              <Button
                variant="primary"
                disabled={!s.cart.length || !s.service || blocked}
                onClick={() => setCheckout(true)}
              >
                Review &amp; pay
              </Button>
            </div>
          </div>
        </aside>
      </div>
      <div className="mobile-cart-dock" aria-label="Cart summary">
        <span>
          <small>
            {s.cart.reduce((a, l) => a + l.qty, 0)}{' '}
            {s.cart.reduce((a, l) => a + l.qty, 0) === 1 ? 'item' : 'items'}
          </small>
          <strong>{idr(s.totals.total)}</strong>
        </span>
        <Button
          variant="primary"
          disabled={!s.cart.length || !s.service || blocked}
          onClick={() => setCheckout(true)}
        >
          Review &amp; pay
        </Button>
      </div>

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(undefined)}>
          <p>{detail.description}</p>
          <p>
            {detail.category} · {idr(detail.price)}
          </p>
          {detail.components?.length ? (
            <>
              <h3>Bundle composition</h3>
              {detail.bundleError && (
                <p className="alert bad">
                  Composition unavailable: {detail.bundleError}
                </p>
              )}
              <ul>
                {detail.components.map((x) => {
                  const v = current(x.menuId);
                  return (
                    <li key={x.menuId}>
                      {x.quantity} × {v?.name || x.menuId}
                      {v?.ingredients.filter((i) => !i.hidden).length
                        ? ` — ${v.ingredients
                            .filter((i) => !i.hidden)
                            .map((i) => i.name)
                            .join(', ')}`
                        : ''}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : detail.ingredients.filter((x) => !x.hidden).length ? (
            <ul>
              {detail.ingredients
                .filter((x) => !x.hidden)
                .map((x) => (
                  <li key={x.id}>
                    {x.name}
                    {x.quantity
                      ? ` · ${x.quantity}${x.unit ? ` ${x.unit}` : ''}`
                      : ''}
                  </li>
                ))}
            </ul>
          ) : (
            <p>No public ingredient details for this item.</p>
          )}
        </Modal>
      )}

      {heldOpen && !replacing && (
        <Modal title="Held orders" onClose={() => setHeldOpen(false)}>
          <div className="held-orders">
            {held.map((o) => (
              <button
                key={o.id}
                aria-label={`Restore ${o.id}`}
                onClick={() => chooseHeld(o.id)}
              >
                <strong>{o.id}</strong>
                <span>
                  {localDateTime(o.createdAt)} · {o.service}
                  {o.tableIds?.length
                    ? ` · ${o.tableIds.join(', ')}`
                    : o.table
                    ? ` · ${o.table}`
                    : ''}
                </span>
                <small>
                  {o.lines.reduce((n, l) => n + l.qty, 0)} items ·{' '}
                  {idr(o.total)}
                </small>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {replacing && (
        <Modal
          title="Replace current order?"
          onClose={() => setReplacing(undefined)}
        >
          <p>Restoring {replacing} will replace the current cart.</p>
          <div className="form-actions">
            <Button onClick={() => setReplacing(undefined)}>Cancel</Button>
            <Button variant="danger" onClick={() => resume(replacing)}>
              Replace order
            </Button>
          </div>
        </Modal>
      )}

      {custom && (
        <Modal title={`Customize ${custom.name}`} onClose={closeCustom}>
          {customError && (
            <p className="alert bad" role="alert">
              {customError}
            </p>
          )}
          <form
            className="variation-picker"
            onSubmit={(e) => {
              e.preventDefault();
              const missing = (custom.variations || []).find(
                (g) =>
                  g.required && !selections.some((x) => x.groupId === g.id)
              );
              if (missing) {
                setCustomError(
                  `${missing.name} is required. Choose one option to continue.`
                );
                return;
              }
              setCustomError('');
              if (line)
                s.dispatch({
                  type: 'update',
                  id: line.id,
                  selections,
                  qty: customQty,
                  note: customNote,
                });
              else
                s.dispatch({
                  type: 'addConfigured',
                  item: custom,
                  selections,
                  qty: customQty,
                  note: customNote,
                });
              closeCustom();
            }}
          >
            {custom.variations?.map((group) => (
              <fieldset key={group.id}>
                <legend>
                  {group.name}
                  {group.required ? ' · Required' : ''}
                </legend>
                {!group.required && (
                  <label>
                    <input
                      type="radio"
                      name={group.id}
                      checked={!selections.some((x) => x.groupId === group.id)}
                      onChange={() =>
                        setSelections((x) =>
                          x.filter((v) => v.groupId !== group.id)
                        )
                      }
                    />{' '}
                    None
                  </label>
                )}
                {group.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name={group.id}
                      checked={selections.some(
                        (x) =>
                          x.groupId === group.id && x.optionId === option.id
                      )}
                      onChange={() =>
                        setSelections((x) => [
                          ...x.filter((v) => v.groupId !== group.id),
                          {
                            groupId: group.id,
                            groupName: group.name,
                            optionId: option.id,
                            optionName: option.name,
                            priceDelta: option.priceDelta,
                          },
                        ])
                      }
                    />{' '}
                    {option.name} ·{' '}
                    {option.priceDelta ? `+${idr(option.priceDelta)}` : 'Free'}
                  </label>
                ))}
              </fieldset>
            ))}
            <div className="variation-quantity">
              <Button
                type="button"
                aria-label="Decrease quantity"
                disabled={customQty === 1}
                onClick={() => setCustomQty((x) => x - 1)}
              >
                <Minus />
              </Button>
              <strong>{customQty}</strong>
              <Button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setCustomQty((x) => x + 1)}
              >
                <Plus />
              </Button>
            </div>
            <Input
              label="Notes"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
            <Button variant="primary" type="submit">
              {line ? 'Save changes' : 'Add to order'} ·{' '}
              {idr(
                (custom.price +
                  selections.reduce((n, x) => n + x.priceDelta, 0)) *
                  customQty
              )}
            </Button>
          </form>
        </Modal>
      )}

      {checkout && (
        <Modal title="Checkout" onClose={resetPayment}>
          <div className="checkout-total">
            <small>Amount due</small>
            <strong>{idr(total)}</strong>
            <span>
              {s.service}
              {needsTable && s.tableIds.length
                ? ` · ${s.tableIds
                    .map(
                      (id) => s.data.tables.find((t) => t.id === id)?.name || id
                    )
                    .join(', ')}`
                : ''}
            </span>
          </div>
          {payError && (
            <p className="alert bad" role="alert">
              {payError}
            </p>
          )}
          {!s.activeShift && s.role === 'cashier' && (
            <p className="hint" role="status">
              No open shift — this sale is recorded but will not be reconciled
              to a drawer.{' '}
              <Link to="/cashier/dashboard">Open a shift</Link>.
            </p>
          )}
          <div className="cash-payment">
            <NumberInput
              label="Cash received"
              min={0}
              value={tendered}
              onValueChange={(next) => {
                setTendered(next === '' ? '' : String(next));
                setPayError('');
              }}
            />
            <div className="row-actions">
              <Button type="button" onClick={() => setTendered(String(total))}>
                Exact
              </Button>
              <Button
                type="button"
                onClick={() =>
                  setTendered(String(Math.ceil(total / 5000) * 5000))
                }
              >
                {idr(Math.ceil(total / 5000) * 5000)}
              </Button>
            </div>
            <div className="formula">
              <span>Change due</span>
              <strong>{idr(change)}</strong>
            </div>
            <Button
              variant="primary"
              disabled={cashGiven < total}
              onClick={payCash}
            >
              Complete cash payment
            </Button>
          </div>
          <div className="payment-options">
            <button
              onClick={() => {
                if (paymentQr.configured) setQris(true);
              }}
              disabled={!paymentQr.configured}
              aria-describedby={!paymentQr.configured ? 'qris-hint' : undefined}
            >
              <QrCode />
              <strong>QRIS</strong>
              <small>
                {paymentQr.configured
                  ? 'Show tenant payment QR'
                  : 'No tenant payment QR configured'}
              </small>
            </button>
          </div>
          {!paymentQr.configured && (
            <p className="hint" id="qris-hint" role="status">
              QRIS needs a payment QR. Ask an admin to upload one under Payment
              QR.
            </p>
          )}
        </Modal>
      )}

      {qris && (
        <Modal title="QRIS payment" onClose={() => setQris(false)}>
          <div className="qris">
            <img
              className="payment-qr"
              src={`${API}/payment-qr/image?business=${encodeURIComponent(
                s.business
              )}&v=${encodeURIComponent(paymentQr.updatedAt || '')}`}
              alt={`Payment QR for ${
                s.tenants.find((item) => item.id === s.business)?.name ||
                s.business
              }`}
            />
            <p>Ask the customer to scan this static QR, then confirm the transfer.</p>
            {payError && (
              <p className="alert bad" role="alert">
                {payError}
              </p>
            )}
            <Button variant="primary" onClick={completeQris}>
              Payment received · {idr(total)}
            </Button>
          </div>
        </Modal>
      )}

      {receipt && (
        <Modal title="Payment complete" onClose={() => setReceipt(undefined)}>
          <div className="receipt">
            <CheckCircle2 />
            <h2>{receipt.id}</h2>
            <p>
              {localDateTime(receipt.createdAt)} · {receipt.service}
              {receipt.tableIds?.length
                ? ` · ${receipt.tableIds
                    .map(
                      (id) => s.data.tables.find((t) => t.id === id)?.name || id
                    )
                    .join(', ')}`
                : ''}
            </p>
            <div className="receipt-lines">
              {receipt.lines.map((l) => (
                <div className="receipt-line" key={l.id}>
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <b>{idr(l.price * l.qty)}</b>
                </div>
              ))}
              <div className="receipt-line">
                <span>Tax</span>
                <b>{idr(receipt.tax)}</b>
              </div>
              {receipt.discount > 0 && (
                <div className="receipt-line">
                  <span>Discount · {receipt.coupon}</span>
                  <b>−{idr(receipt.discount)}</b>
                </div>
              )}
              <div className="receipt-line grand">
                <span>Total</span>
                <b>{idr(receipt.total)}</b>
              </div>
              <div className="receipt-line">
                <span>{receipt.payment}</span>
                <b>{idr(receipt.tendered ?? receipt.total)}</b>
              </div>
              {receipt.change ? (
                <div className="receipt-line">
                  <span>Change</span>
                  <b>{idr(receipt.change)}</b>
                </div>
              ) : null}
            </div>
            <p className="muted">
              Cashier {receipt.cashierName || '—'}
              {receipt.tableIds?.length ? ' · table released' : ''}
            </p>
            {printNotice && (
              <p className="hint-text" role="status">
                {printNotice}
              </p>
            )}
            <div className="form-actions">
              <Button onClick={() => void printReceiptCopy('receipt')}>
                Print receipt
              </Button>
              <Button onClick={() => void printReceiptCopy('kitchen')}>
                Print kitchen order
              </Button>
              <Button onClick={saveReceiptJpg}>Save receipt as JPG</Button>
            </div>
            <Button variant="primary" onClick={() => setReceipt(undefined)}>
              Start next order
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
