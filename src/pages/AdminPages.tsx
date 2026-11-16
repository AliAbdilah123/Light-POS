import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Building2,
  Coffee,
  QrCode,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  idr,
  localHour,
  localWeekday,
  type MenuItem,
  type Sop,
} from '../domain';
import { useStore } from '../store';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { NativeSelect as Select } from '../components/ui/native-select';
import {
  FormActions,
  Metric,
  Modal,
  PageHead,
  SectionTitle,
  StatusRow,
} from '../components/molecules';

export function AdminDashboard() {
  const s = useStore();
  const global = s.role === 'superadmin' && s.business === 'all';
  const completed = s.data.orders.filter(
    (o) => o.status === 'Completed' && o.payment
  );
  const revenue = completed.reduce((sum, o) => sum + o.total, 0);
  const average = completed.length ? Math.round(revenue / completed.length) : 0;
  const tenants = s.tenants;
  const rows = global
    ? tenants.filter((t) => t.active)
    : tenants.filter((t) => t.id === s.business);
  const target = s.data.targets[global ? '' : s.business] || 0;
  const revenueFor = (id: string) =>
    completed
      .filter((o) => o.businessId === id)
      .reduce((sum, o) => sum + o.total, 0);
  const ordersFor = (id: string) =>
    completed.filter((o) => o.businessId === id).length;
  const portfolioRevenue = rows.reduce((sum, t) => sum + revenueFor(t.id), 0);
  const portfolioOrders = rows.reduce((sum, t) => sum + ordersFor(t.id), 0);
  const freshness = completed.length
    ? new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(
        new Date(Math.max(...completed.map((item) => Date.parse(item.createdAt))))
      )
    : '';
  return (
    <>
      <PageHead
        eyebrow={global ? 'Global administration' : 'Tenant administration'}
        title={global ? 'Business portfolio' : 'Tenant admin dashboard'}
        description={
          global
            ? 'Comparable sample performance across all authorized businesses.'
            : 'Full administration for the selected tenant.'
        }
      />
      <div className="metric-grid">
        <Metric
          label={global ? 'Portfolio revenue (sample)' : 'Tenant revenue'}
          value={idr(global ? portfolioRevenue : revenue)}
          delta={
            global
              ? `${portfolioOrders} paid orders across ${rows.length} tenants`
              : `${completed.length} completed payments`
          }
          icon={<WalletCards />}
        />
        <Metric
          label="Paid orders"
          value={String(global ? portfolioOrders : completed.length)}
          icon={<ClipboardCheck />}
        />
        <Metric
          label="Average order"
          value={idr(
            global
              ? Math.round(portfolioRevenue / Math.max(1, portfolioOrders))
              : average
          )}
          icon={<BarChart3 />}
        />
        <Metric
          label="Newest sale"
          value={completed.length ? freshness : '—'}
          help={
            completed.length
              ? `${completed.length} paid orders on record`
              : 'No paid orders yet'
          }
          icon={<Clock3 />}
        />
      </div>
      <div className={global ? 'business-grid' : 'split wide-left'}>
        {rows.map((b) => {
          const live = !global && b.id === s.business;
          const tenantName = b.name;
          const tenantLocation = b.location;
          const shownRevenue = live ? revenue : revenueFor(b.id);
          const shownOrders = live ? completed.length : ordersFor(b.id);
          return (
            <Card key={b.id}>
              <div className="business-head">
                <span>
                  <Building2 />
                </span>
                <Badge tone={live ? 'good' : 'info'}>
                  {live ? 'Live records' : 'Sample'}
                </Badge>
              </div>
              <h2>{tenantName}</h2>
              <p>
                {tenantLocation}
                {live ? '' : ' · Sample business'}
              </p>
              <strong className="revenue">{idr(shownRevenue)}</strong>
              <Progress
                label="Monthly target"
                value={live && target > 0 ? (shownRevenue / target) * 100 : 0}
              />
              <div className="mini-stats">
                <span>
                  <b>{shownOrders}</b> orders
                </span>
                <span>
                  <b>
                    {idr(
                      shownOrders ? Math.round(shownRevenue / shownOrders) : 0
                    )}
                  </b>{' '}
                  avg.
                </span>
              </div>
            </Card>
          );
        })}
        {!global && (
          <Card>
            <SectionTitle title="Quick actions" meta="Common admin tasks" />
            <div className="quick-links">
              {(
                [
                  ['New order', '/admin/order', Coffee],
                  ['Menu catalog', '/admin/menu', BookOpen],
                  ['Users & roles', '/admin/users-access', Users],
                  ['Payment QR', '/admin/payment-qr', QrCode],
                ] as const
              ).map(([label, to, Icon]) => (
                <Link className="quick-link" to={to} key={to}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
      <Card className="comparison-card">
        <SectionTitle title="Comparison context" />
        <p className="definition">
          Revenue means completed payments less void reversals. Current month is
          incomplete; comparison uses the same elapsed days.{' '}
          {global
            ? 'Portfolio figures are fixture samples because tenant data is loaded one business at a time.'
            : 'Figures reflect the records stored for this business.'}
        </p>
      </Card>
    </>
  );
}

export function InsightsPage() {
  const s = useStore();
  const paid = s.data.orders.filter((o) => o.status === 'Completed');
  const hours = Array.from({ length: 8 }, (_, i) => 8 + i * 2);
  const hourly = hours.map(
    (h) =>
      paid.filter((o) => {
        const hour = localHour(o.createdAt);
        return hour >= h && hour < h + 2;
      }).length
  );
  const peakValue = Math.max(0, ...hourly),
    peakIndex = hourly.indexOf(peakValue);
  const quietValue = Math.min(...hourly),
    quietIndex = hourly.indexOf(quietValue);
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const byDay = weekdays.map((day) =>
    paid
      .filter((o) => localWeekday(o.createdAt) === day)
      .reduce((sum, o) => sum + o.total, 0)
  );
  const ranked = weekdays
    .map((day, i) => ({ day, total: byDay[i] }))
    .sort((a, b) => b.total - a.total);
  const units = new Map<string, number>();
  for (const order of paid)
    for (const line of order.lines)
      units.set(line.name, (units.get(line.name) || 0) + line.qty);
  const favourites = [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const least = [...units.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3);
  const maxDay = Math.max(1, ...byDay);
  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Operational insights"
        description="Busy and easy periods plus menu preferences, with sample-size warnings."
      />
      <div className="split">
        <Card>
          <SectionTitle
            title="Busiest hours"
            meta={`${paid.length} paid orders · last 28 days`}
          />
          <div className="hour-chart">
            {hourly.map((count, i) => (
              <div key={i}>
                <span
                  style={{
                    height: `${
                      maxDay && count
                        ? Math.max(4, (count / Math.max(1, peakValue)) * 100)
                        : 2
                    }%`,
                  }}
                  title={`${hours[i]}:00–${hours[i] + 2}:00 · ${count} orders`}
                />
                <small>{hours[i]}:00</small>
              </div>
            ))}
          </div>
          {peakValue > 0 ? (
            <>
              <div className="insight">
                <Badge tone="good">Busiest</Badge>
                <strong>
                  {hours[peakIndex]}:00–{hours[peakIndex] + 2}:00 · {peakValue}{' '}
                  orders
                </strong>
              </div>
              <div className="insight">
                <Badge tone="info">Easiest</Badge>
                <strong>
                  {hours[quietIndex]}:00–{hours[quietIndex] + 2}:00 ·{' '}
                  {quietValue} orders
                </strong>
              </div>
            </>
          ) : (
            <p className="muted">No paid orders to analyse yet.</p>
          )}
          {paid.length < 30 && (
            <p className="definition">
              Sample size is {paid.length} paid orders. Treat these rankings as
              directional until the period reaches 30 orders.
            </p>
          )}
        </Card>
        <Card>
          <SectionTitle title="Days of week" meta="Paid revenue by weekday" />
          {ranked.slice(0, 2).map((x, i) => (
            <StatusRow
              key={x.day}
              title={x.day}
              meta={`${idr(x.total)} · ${
                paid.filter((o) => localWeekday(o.createdAt) === x.day).length
              } orders`}
              status={i === 0 ? 'High demand' : 'Low demand'}
            />
          ))}
          <div className="day-bars" aria-hidden="true">
            {byDay.map((total, i) => (
              <span
                key={i}
                style={{ height: `${Math.max(3, (total / maxDay) * 100)}%` }}
                title={weekdays[i]}
              />
            ))}
          </div>
          <p className="definition">
            “Easy” means lowest paid-order volume, not effort or staffing
            quality.
          </p>
        </Card>
      </div>
      <div className="split">
        <Card>
          <SectionTitle title="Guest favourites" meta="Units sold" />
          {favourites.length ? (
            favourites.map(([name, qty], i) => (
              <StatusRow
                key={name}
                title={`#${i + 1} ${name}`}
                meta={`${qty} sold`}
                status="Favourite"
              />
            ))
          ) : (
            <p className="muted">No sales recorded.</p>
          )}
        </Card>
        <Card>
          <SectionTitle title="Least selected" meta="Units sold" />
          {least.length ? (
            least.map(([name, qty]) => (
              <StatusRow key={name} title={name} meta={`${qty} sold`} status="Review" />
            ))
          ) : (
            <p className="muted">No sales recorded.</p>
          )}
        </Card>
      </div>
    </>
  );
}

export function MenuLab() {
  const s = useStore();
  const classify = (m: MenuItem) =>
    m.price - m.cost < 15000
      ? 'Loser'
      : (m.price - m.cost) / m.price > 0.65
      ? 'Profitable'
      : 'Package';
  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title="Menu planning lab"
        description="Classify menu performance, capture planning notes, and record draft results."
      />
      <div className="planning-grid">
        {s.data.menus.map((m) => {
          const kind = classify(m);
          return (
            <Card key={m.id}>
              <div className="plan-head">
                <span className="product-icon">{m.icon}</span>
                <Badge
                  tone={
                    kind === 'Profitable'
                      ? 'good'
                      : kind === 'Loser'
                      ? 'bad'
                      : 'info'
                  }
                >
                  {kind}
                </Badge>
              </div>
              <h3>{m.name}</h3>
              <p>
                {idr(m.price - m.cost)} contribution ·{' '}
                {Math.round(((m.price - m.cost) / m.price) * 100)}% margin
              </p>
              <label className="field">
                <span>Planning note</span>
                <textarea
                  value={s.data.planningNotes[m.id] || ''}
                  onChange={(e) =>
                    s.update((d) => ({
                      ...d,
                      planningNotes: {
                        ...d.planningNotes,
                        [m.id]: e.target.value,
                      },
                    }))
                  }
                  placeholder="Decision, package idea, or experiment…"
                />
              </label>
              <Select
                label="Result"
                value={
                  s.data.planningNotes[`result-${m.id}`] || 'Draft · no result'
                }
                onChange={(e) =>
                  s.update((d) => ({
                    ...d,
                    planningNotes: {
                      ...d.planningNotes,
                      [`result-${m.id}`]: e.target.value,
                    },
                  }))
                }
              >
                <option>Draft · no result</option>
                <option>Keep</option>
                <option>Reprice</option>
                <option>Bundle as package</option>
                <option>Retire</option>
              </Select>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function CouponsPage() {
  const s = useStore();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      code = String(fd.get('code')).toUpperCase();
    if (s.data.coupons.some((c) => c.code === code)) {
      setError(`The code ${code} is already in use.`);
      return;
    }
    const value = Number(fd.get('value'));
    if (!code) {
      setError('Enter a coupon code.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive discount value.');
      return;
    }
    if (!fd.get('reason')) {
      setError('Choose a reason so the discount is auditable.');
      return;
    }
    s.update((d) => ({
      ...d,
      coupons: [
        ...d.coupons,
        {
          id: crypto.randomUUID(),
          code,
          type: String(fd.get('type')) as 'percent' | 'fixed',
          value,
          reason: String(fd.get('reason')),
          active: true,
        },
      ],
    }));
    e.currentTarget.reset();
    setError('');
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    setError('');
  };
  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title="Discount coupons"
        description="Govern coupon codes, values, activation, and standardized reasons."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Add coupon
          </Button>
        }
      />
      {open && (
        <Modal title="Add coupon" onClose={close}>
          <form onSubmit={add}>
            {error && (
              <div className="alert bad" role="alert">
                {error}
              </div>
            )}
            <Input label="Code" name="code" required />
            <Select label="Discount type" name="type">
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed IDR</option>
            </Select>
            <Input label="Value" name="value" type="number" min="1" required />
            <Select label="Reason" name="reason">
              <option value="">Select reason</option>
              <option>Review incentive</option>
              <option>Service recovery</option>
              <option>Launch offer</option>
            </Select>
            <FormActions onCancel={close} submit="Create coupon" />
          </form>
        </Modal>
      )}
      <div className="split">
        <Card>
          <SectionTitle title="Policy" />
          <p>
            Active coupons can be applied at checkout. Discount is calculated
            before the sample 10% tax and capped at subtotal.
          </p>
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="Coupon registry"
          meta={`${s.data.coupons.length} codes`}
        />
        {s.data.coupons.map((c) => (
          <StatusRow
            key={c.id}
            title={c.code}
            meta={`${c.type === 'percent' ? `${c.value}%` : idr(c.value)} · ${
              c.reason
            } · used ${
              s.data.orders.filter((o) => o.coupon === c.code).length
            }×`}
            status={c.active ? 'Active' : 'Inactive'}
            action={
              <div className="row-actions">
                <Button
                  onClick={() =>
                    s.update((d) => ({
                      ...d,
                      coupons: d.coupons.map((x) =>
                        x.id === c.id ? { ...x, active: !x.active } : x
                      ),
                    }))
                  }
                >
                  {c.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="danger" onClick={() => setDeleting(c.id)}>
                  Delete
                </Button>
              </div>
            }
          />
        ))}
      </Card>
      {deleting && (
        <Modal
          title="Delete this coupon?"
          onClose={() => setDeleting(undefined)}
        >
          <p>
            Orders that already used{' '}
            {s.data.coupons.find((c) => c.id === deleting)?.code} keep their
            discount, but the code can no longer be applied.
          </p>
          <div className="form-actions">
            <Button onClick={() => setDeleting(undefined)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                s.update((d) => ({
                  ...d,
                  coupons: d.coupons.filter((x) => x.id !== deleting),
                }));
                setDeleting(undefined);
              }}
            >
              Delete coupon
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AdminOperations() {
  const s = useStore();
  const authorized = s.tenants.filter((t) => t.id === s.business);
  const [targetDraft, setTargetDraft] = useState<Record<string, string>>({});
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, string>>({});
  const [savedTarget, setSavedTarget] = useState('');
  const month = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(
    new Date()
  );
  const revenue = s.data.orders
    .filter((o) => o.status === 'Completed')
    .reduce((sum, o) => sum + o.total, 0);
  const saveTarget = (id: string) => {
    const raw = targetDraft[id];
    if (raw === undefined) return;
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n) || n < 0) return;
    if (n !== s.data.targets[id])
      s.update(
        (d) => ({ ...d, targets: { ...d.targets, [id]: n } }),
        `Revenue target updated for ${id}`
      );
    setTargetDraft((d) => {
      const rest = { ...d };
      delete rest[id];
      return rest;
    });
    setSavedTarget(id);
    window.setTimeout(
      () => setSavedTarget((current) => (current === id ? '' : current)),
      2400
    );
  };
  const commitSchedule = (day: string, raw: string) => {
    if (raw.trim() !== (s.data.schedules[day] || ''))
      s.update(
        (d) => ({ ...d, schedules: { ...d.schedules, [day]: raw.trim() } }),
        `Opening hours updated for ${day}`
      );
    setScheduleDraft((d) => {
      const rest = { ...d };
      delete rest[day];
      return rest;
    });
  };
  if (s.business === 'all')
    return (
      <>
        <PageHead
          eyebrow="Operations"
          title="Targets & opening hours"
          description="Edit revenue goals and business operating schedule."
        />
        <p className="alert" role="status">
          Select one business in the sidebar to edit its revenue target and
          opening hours.
        </p>
      </>
    );
  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Targets & opening hours"
        description="Edit revenue goals and business operating schedule."
      />
      <div className="split">
        <Card>
          <SectionTitle
            title={`${month} revenue targets`}
            meta="Progress uses completed payments in this business"
          />
          {authorized.map((b) => {
            const target = s.data.targets[b.id] || 0,
              draft = targetDraft[b.id] ?? String(target),
              value = Number(draft);
            const valid = draft.trim() !== '' && Number.isFinite(value) && value >= 0,
              dirty = valid && value !== target;
            return (
              <div className="target-row" key={b.id}>
                <div>
                  <strong>{b.name}</strong>
                  <Progress
                    label={`${b.name} progress`}
                    value={target > 0 ? (revenue / target) * 100 : 0}
                  />
                  <small className="muted">
                    {idr(revenue)} of {idr(target)}
                  </small>
                </div>
                <div className="target-edit">
                  <Input
                    label="Target IDR"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={draft}
                    onChange={(e) =>
                      setTargetDraft((d) => ({ ...d, [b.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveTarget(b.id);
                      }
                    }}
                  />
                  <Button
                    variant="primary"
                    disabled={!dirty || !s.writable}
                    onClick={() => saveTarget(b.id)}
                  >
                    Save
                  </Button>
                  {savedTarget === b.id && (
                    <small className="saved-flag" role="status">
                      Saved
                    </small>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
        <Card>
          <SectionTitle
            title="Opening & closing schedule"
            meta="Saves when you leave the field"
          />
          {Object.entries(s.data.schedules).map(([day, hours]) => {
            const value = scheduleDraft[day] ?? hours,
              open = value.trim() !== '';
            return (
              <div className="schedule-row" key={day}>
                <strong>{day}</strong>
                <input
                  aria-label={`${day} hours`}
                  value={value}
                  placeholder="Closed"
                  onChange={(e) =>
                    setScheduleDraft((d) => ({ ...d, [day]: e.target.value }))
                  }
                  onBlur={() => commitSchedule(day, value)}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => {
                      const nextValue = e.target.checked
                        ? value.trim() || '07:00-21:00'
                        : '';
                      setScheduleDraft((d) => ({ ...d, [day]: nextValue }));
                      commitSchedule(day, nextValue);
                    }}
                  />{' '}
                  Open
                </label>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}

export function StaffPage() {
  const s = useStore();
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [error, setError] = useState('');
  const [staffDraft, setStaffDraft] = useState<{
    id?: string;
    name: string;
    role: string;
    status: string;
  } | null>(null);
  const shift = s.data.shifts.find((x) => x.id === editing);
  const saveStaff = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      name = String(fd.get('staffName')).trim(),
      role = String(fd.get('staffRole')).trim(),
      staffStatus = String(fd.get('staffStatus'));
    if (!name || !role) {
      setError('Staff name and role are required.');
      return;
    }
    if (
      s.data.staff.some(
        (x) => x.id !== staffDraft?.id && x.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setError('Staff name must be unique.');
      return;
    }
    s.update(
      (d) => ({
        ...d,
        staff: staffDraft?.id
          ? d.staff.map((x) =>
              x.id === staffDraft.id ? { ...x, name, role, status: staffStatus } : x
            )
          : [
              ...d.staff,
              { id: crypto.randomUUID(), name, role, status: staffStatus },
            ],
      }),
      'Staff directory updated'
    );
    setStaffDraft(null);
    setError('');
  };
  const close = () => {
    setOpen(false);
    setEditing(undefined);
    setError('');
  };
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const minutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const hoursThisWeek =
    s.data.shifts
      .filter((sh) => sh.date >= weekAgo && sh.date <= today)
      .reduce(
        (sum, sh) => sum + Math.max(0, minutes(sh.end) - minutes(sh.start)),
        0
      ) / 60;
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      value = {
        staff: String(fd.get('staff')),
        date: String(fd.get('date')),
        start: String(fd.get('start')),
        end: String(fd.get('end')),
        location: String(fd.get('location')),
      };
    if (
      value.staff === '' ||
      value.date === '' ||
      value.start === '' ||
      value.end === '' ||
      value.location === ''
    )
      return;
    if (minutes(value.end) <= minutes(value.start)) {
      setError('Shift end must be after the start time.');
      return;
    }
    s.update((d) => ({
      ...d,
      shifts: shift
        ? d.shifts.map((x) => (x.id === shift.id ? { ...x, ...value } : x))
        : [...d.shifts, { id: crypto.randomUUID(), ...value }],
    }));
    close();
  };
  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Staff & shifts"
        description="Directory and shift assignment for the selected business."
        action={
          <div className="form-actions">
            <Button
              onClick={() =>
                setStaffDraft({ name: '', role: 'Cashier', status: 'Active' })
              }
            >
              Add staff
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              Add shift
            </Button>
          </div>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Active staff"
          value={String(s.data.staff.filter((x) => x.status === 'Active').length)}
          delta={`${s.data.staff.length} in directory`}
          icon={<Users />}
        />
        <Metric
          label="Shifts today"
          value={String(s.data.shifts.filter((sh) => sh.date === today).length)}
          icon={<CalendarDays />}
        />
        <Metric
          label="Hours this week"
          value={`${hoursThisWeek.toFixed(1)}h`}
          help="Scheduled, last 7 days"
          icon={<Clock3 />}
        />
        <Metric
          label="Upcoming shifts"
          value={String(s.data.shifts.filter((sh) => sh.date > today).length)}
          icon={<ClipboardCheck />}
        />
      </div>
      <Card>
        <SectionTitle
          title="Staff directory"
          meta={`${s.data.staff.length} people`}
        />
        {s.data.staff.length ? (
          s.data.staff.map((person) => (
            <StatusRow
              key={person.id}
              title={person.name}
              meta={`${person.role} · ${
                s.data.shifts.filter((sh) => sh.staff === person.name).length
              } shifts`}
              status={person.status}
              action={
                <div className="row-actions">
                  <Button onClick={() => setStaffDraft({ ...person })}>Edit</Button>
                  <Button
                    variant={person.status === 'Active' ? 'danger' : 'primary'}
                    onClick={() =>
                      s.update(
                        (d) => ({
                          ...d,
                          staff: d.staff.map((x) =>
                            x.id === person.id
                              ? {
                                  ...x,
                                  status:
                                    x.status === 'Active' ? 'Inactive' : 'Active',
                                }
                              : x
                          ),
                        }),
                        'Staff status updated'
                      )
                    }
                  >
                    {person.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              }
            />
          ))
        ) : (
          <p className="muted">No staff records.</p>
        )}
      </Card>
      <Card>
        <SectionTitle
          title="Shift assignments"
          meta={`${s.data.shifts.length} total`}
        />
        {s.data.shifts.length ? (
          s.data.shifts.map((sh) => (
            <StatusRow
              key={sh.id}
              title={`${sh.staff} · ${new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'medium',
              }).format(new Date(`${sh.date}T00:00:00Z`))}`}
              meta={`${sh.start}–${sh.end} · ${sh.location}`}
              status="Assigned"
              action={
                <div className="row-actions">
                  <Button
                    onClick={() => {
                      setEditing(sh.id);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(sh.id)}>
                    Delete
                  </Button>
                </div>
              }
            />
          ))
        ) : (
          <p className="muted">No shifts scheduled.</p>
        )}
      </Card>
      {open && (
        <Modal title={shift ? 'Edit shift' : 'Add shift'} onClose={close}>
          <form key={editing || 'new'} onSubmit={save}>
            {error && (
              <div className="alert bad" role="alert">
                {error}
              </div>
            )}
            <Select label="Assign staff" name="staff" defaultValue={shift?.staff} required>
              <option value="">Select staff</option>
              {s.data.staff.map((person) => (
                <option key={person.id} value={person.name}>
                  {person.name} · {person.role}
                </option>
              ))}
            </Select>
            <Input
              label="Date"
              name="date"
              type="date"
              defaultValue={shift?.date || today}
              required
            />
            <div className="form-grid">
              <Input
                label="Start"
                name="start"
                type="time"
                defaultValue={shift?.start || '08:00'}
                required
              />
              <Input
                label="End"
                name="end"
                type="time"
                defaultValue={shift?.end || '16:00'}
                required
              />
            </div>
            <Select
              label="Location"
              name="location"
              defaultValue={shift?.location}
              required
            >
              <option value="">Select location</option>
              {s.tenants.map((t) => (
                <option key={t.id} value={t.location}>
                  {t.location}
                </option>
              ))}
            </Select>
            <FormActions
              onCancel={close}
              submit={shift ? 'Save shift' : 'Create shift'}
            />
          </form>
        </Modal>
      )}
      {staffDraft && (
        <Modal
          title={staffDraft.id ? 'Edit staff member' : 'Add staff member'}
          onClose={() => setStaffDraft(null)}
        >
          <form onSubmit={saveStaff} key={staffDraft.id || 'new'}>
            {error && (
              <p className="alert bad" role="alert">
                {error}
              </p>
            )}
            <Input
              label="Name"
              name="staffName"
              defaultValue={staffDraft.name}
              required
            />
            <Select label="Role" name="staffRole" defaultValue={staffDraft.role}>
              <option>Cashier</option>
              <option>Manager</option>
              <option>Kitchen</option>
              <option>Display</option>
            </Select>
            <Select
              label="Status"
              name="staffStatus"
              defaultValue={staffDraft.status}
            >
              <option>Active</option>
              <option>Upcoming</option>
              <option>Inactive</option>
            </Select>
            <FormActions
              onCancel={() => setStaffDraft(null)}
              submit={staffDraft.id ? 'Save staff member' : 'Add staff member'}
            />
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this shift?" onClose={() => setDeleting(undefined)}>
          <p>
            The shift will be removed from the schedule. This does not affect
            recorded orders.
          </p>
          <div className="form-actions">
            <Button onClick={() => setDeleting(undefined)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                s.update((d) => ({
                  ...d,
                  shifts: d.shifts.filter((x) => x.id !== deleting),
                }));
                setDeleting(undefined);
              }}
            >
              Delete shift
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function OrderTypesPage() {
  const s = useStore();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const edit = s.data.orderTypes.find((x) => x.id === editing);
  const saveEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      name = String(fd.get('name')).trim();
    if (!name) {
      setError('Order type name is required.');
      return;
    }
    if (
      s.data.orderTypes.some(
        (x) => x.id !== editing && x.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setError('Order type name must be unique.');
      return;
    }
    s.update(
      (d) => ({
        ...d,
        orderTypes: d.orderTypes.map((x) =>
          x.id === editing
            ? { ...x, name, requiresTable: fd.get('requiresTable') === 'on' }
            : x
        ),
      }),
      'Order type updated'
    );
    setEditing(undefined);
    setError('');
  };
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      fd = new FormData(form),
      name = String(fd.get('name')).trim();
    if (!name) {
      setError('Order type name is required.');
      return;
    }
    if (s.data.orderTypes.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      setError('Order type name must be unique.');
      return;
    }
    s.update((d) => ({
      ...d,
      orderTypes: [
        ...d.orderTypes,
        {
          id: crypto.randomUUID(),
          name,
          enabled: true,
          archived: false,
          requiresTable: fd.get('requiresTable') === 'on',
        },
      ],
    }));
    form.reset();
    setError('');
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    setError('');
  };
  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title="Order types"
        description="Configure service choices available when creating an order."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Add order type
          </Button>
        }
      />
      {open && (
        <Modal title="Add order type" onClose={close}>
          <form onSubmit={add}>
            {error && (
              <div className="alert bad" role="alert">
                {error}
              </div>
            )}
            <Input label="Order type name" name="name" required />
            <label>
              <input type="checkbox" name="requiresTable" /> Requires table
            </label>
            <FormActions onCancel={close} submit="Add order type" />
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title={`Edit ${edit.name}`} onClose={() => setEditing(undefined)}>
          <form onSubmit={saveEdit} key={edit.id}>
            {error && (
              <p className="alert bad" role="alert">
                {error}
              </p>
            )}
            <Input
              label="Order type name"
              name="name"
              defaultValue={edit.name}
              required
            />
            <label>
              <input
                type="checkbox"
                name="requiresTable"
                defaultChecked={edit.requiresTable}
              />{' '}
              Requires table
            </label>
            <FormActions
              onCancel={() => setEditing(undefined)}
              submit="Save order type"
            />
          </form>
        </Modal>
      )}
      <div className="split">
        <Card>
          <SectionTitle
            title="Order type registry"
            meta={`${s.data.orderTypes.length} types`}
          />
          {s.data.orderTypes.map((t) => {
            const refs = s.data.orders.filter(
              (o) =>
                o.service.toLowerCase() === t.name.toLowerCase() ||
                (t.id === 'dine-in' && o.service.toLowerCase() === 'dine in')
            ).length;
            return (
              <StatusRow
                key={t.id}
                title={t.name}
                meta={`${t.requiresTable ? 'Requires table' : 'No table'}${
                  refs
                    ? ` · Referenced by ${refs} order${refs === 1 ? '' : 's'}`
                    : ''
                }`}
                status={t.archived ? 'Archived' : t.enabled ? 'Enabled' : 'Disabled'}
                action={
                  <div className="row-actions">
                    <Button onClick={() => setEditing(t.id)}>Edit</Button>
                    {!t.archived && (
                      <Button
                        onClick={() =>
                          s.update((d) => ({
                            ...d,
                            orderTypes: d.orderTypes.map((x) =>
                              x.id === t.id ? { ...x, enabled: !x.enabled } : x
                            ),
                          }))
                        }
                      >
                        {t.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                    <Button
                      disabled={t.archived}
                      onClick={() =>
                        s.update((d) => ({
                          ...d,
                          orderTypes: d.orderTypes.map((x) =>
                            x.id === t.id
                              ? { ...x, archived: true, enabled: false }
                              : x
                          ),
                        }))
                      }
                    >
                      Archive
                    </Button>
                  </div>
                }
              />
            );
          })}
        </Card>
      </div>
    </>
  );
}

export function TablesPage() {
  const s = useStore();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      fd = new FormData(form),
      name = String(fd.get('name')).trim(),
      capacity = Number(fd.get('capacity'));
    if (!name || !Number.isInteger(capacity) || capacity < 1) {
      setError('Name and a positive whole-number capacity are required.');
      return;
    }
    if (
      s.data.tables.some(
        (t) => t.id !== editing && t.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setError('Table name must be unique.');
      return;
    }
    s.update((d) => ({
      ...d,
      tables: editing
        ? d.tables.map((t) =>
            t.id === editing
              ? {
                  ...t,
                  name,
                  capacity,
                  status: String(fd.get('status')) as typeof t.status,
                }
              : t
          )
        : [
            ...d.tables,
            {
              id: crypto.randomUUID(),
              name,
              capacity,
              status: 'Available',
              enabled: true,
              archived: false,
            },
          ],
    }));
    form.reset();
    setEditing(undefined);
    setError('');
    setOpen(false);
  };
  const edit = s.data.tables.find((t) => t.id === editing);
  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title="Tables"
        description="Manage table capacity, availability, and lifecycle."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Add table
          </Button>
        }
      />
      {open && (
        <Modal
          title={edit ? 'Edit table' : 'Add table'}
          onClose={() => {
            setOpen(false);
            setEditing(undefined);
            setError('');
          }}
        >
          {error && (
            <div className="alert bad" role="alert">
              {error}
            </div>
          )}
          <form key={editing || 'new'} onSubmit={save}>
            <Input
              label={edit ? 'Edit table name' : 'Table name'}
              name="name"
              defaultValue={edit?.name}
              required
            />
            <Input
              label={edit ? 'Edit capacity' : 'Capacity'}
              name="capacity"
              type="number"
              min="1"
              step="1"
              defaultValue={edit?.capacity}
              required
            />
            {edit && (
              <Select label="Edit table status" name="status" defaultValue={edit.status}>
                {[
                  'Available',
                  'Occupied',
                  'Reserved',
                  'Needs attention',
                  'Unavailable',
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            )}
            <FormActions
              onCancel={() => {
                setOpen(false);
                setEditing(undefined);
                setError('');
              }}
              submit={edit ? 'Save table' : 'Add table'}
            />
          </form>
        </Modal>
      )}
      <Card>
        <SectionTitle
          title="Table registry"
          meta={`${s.data.tables.length} tables`}
        />
        {s.data.tables.map((t) => {
          const refs = s.data.orders.filter(
            (o) =>
              !['Completed', 'Voided'].includes(o.status) &&
              (o.table === t.name || o.table === t.id || o.tableIds?.includes(t.id))
          ).length;
          return (
            <StatusRow
              key={t.id}
              title={t.name}
              meta={`${t.capacity} seats · ${t.status}${
                refs
                  ? ` · Referenced by ${refs} active order${refs === 1 ? '' : 's'}`
                  : ''
              }`}
              status={t.archived ? 'Archived' : t.enabled ? 'Enabled' : 'Disabled'}
              action={
                <div className="row-actions">
                  <Button
                    onClick={() => {
                      setEditing(t.id);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  {!t.archived && (
                    <Button
                      onClick={() =>
                        s.update((d) => ({
                          ...d,
                          tables: d.tables.map((x) =>
                            x.id === t.id ? { ...x, enabled: !x.enabled } : x
                          ),
                        }))
                      }
                    >
                      {t.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                  <Button
                    disabled={t.archived}
                    onClick={() =>
                      s.update((d) => ({
                        ...d,
                        tables: d.tables.map((x) =>
                          x.id === t.id
                            ? { ...x, archived: true, enabled: false }
                            : x
                        ),
                      }))
                    }
                  >
                    Archive
                  </Button>
                </div>
              }
            />
          );
        })}
      </Card>
    </>
  );
}

export function AdminSop() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [sopDraft, setSopDraft] = useState<Sop | null>(null);
  const saveSop = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sopDraft) return;
    const fd = new FormData(e.currentTarget),
      title = String(fd.get('title')).trim(),
      steps = String(fd.get('steps'))
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean);
    if (!title || !steps.length) return;
    s.update(
      (d) => ({
        ...d,
        sops: d.sops.map((x) =>
          x.id === sopDraft.id
            ? { ...x, title, steps, version: x.version + 1 }
            : x
        ),
      }),
      `SOP ${sopDraft.title} version ${sopDraft.version + 1}`
    );
    setSopDraft(null);
  };
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      steps = String(fd.get('steps')).split('\n').filter(Boolean);
    s.update((d) => ({
      ...d,
      sops: [
        ...d.sops,
        {
          id: crypto.randomUUID(),
          title: String(fd.get('title')),
          version: 1,
          steps,
          active: true,
        },
      ],
    }));
    e.currentTarget.reset();
    setOpen(false);
  };
  return (
    <>
      <PageHead
        eyebrow="Administration"
        title="SOP templates"
        description="Manage reusable, versioned operational checklists."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Add template
          </Button>
        }
      />
      {open && (
        <Modal title="Add template" onClose={() => setOpen(false)}>
          <form onSubmit={add}>
            <Input label="Template title" name="title" required />
            <label className="field">
              <span>Steps · one per line</span>
              <textarea name="steps" required rows={6} />
            </label>
            <FormActions onCancel={() => setOpen(false)} submit="Create draft v1" />
          </form>
        </Modal>
      )}
      {sopDraft && (
        <Modal
          title={`New version of ${sopDraft.title}`}
          onClose={() => setSopDraft(null)}
        >
          <form onSubmit={saveSop}>
            <Input
              label="Template title"
              name="title"
              defaultValue={sopDraft.title}
              required
            />
            <label className="field">
              <span>Steps · one per line</span>
              <textarea
                name="steps"
                rows={6}
                defaultValue={sopDraft.steps.join(String.fromCharCode(10))}
                required
              />
            </label>
            <p className="muted">
              Saving publishes v{sopDraft.version + 1} prospectively. The
              previous version stays in history.
            </p>
            <FormActions
              onCancel={() => setSopDraft(null)}
              submit={`Save v${sopDraft.version + 1}`}
            />
          </form>
        </Modal>
      )}
      <div className="split">
        <Card>
          <SectionTitle title="Versioning rules" />
          <p>
            Published sample versions remain represented as immutable history.
            Editing creates the next prospective version.
          </p>
          <Badge tone="info">Frontend demo boundary</Badge>
        </Card>
      </div>
      <div className="sop-grid">
        {s.data.sops.map((sop) => (
          <Card key={sop.id}>
            <div className="plan-head">
              <CalendarDays />
              <Badge tone={sop.active ? 'good' : 'neutral'}>
                {sop.active ? 'Published' : 'Archived'}
              </Badge>
            </div>
            <h3>{sop.title}</h3>
            <p>
              Version {sop.version} · {sop.steps.length} required steps
            </p>
            <ol>
              {sop.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <div className="card-actions">
              <Button onClick={() => setSopDraft(sop)}>
                Edit · v{sop.version + 1}
              </Button>
              <Button
                onClick={() =>
                  s.update((d) => ({
                    ...d,
                    sops: d.sops.map((x) =>
                      x.id === sop.id ? { ...x, active: !x.active } : x
                    ),
                  }))
                }
              >
                {sop.active ? 'Archive' : 'Publish'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
