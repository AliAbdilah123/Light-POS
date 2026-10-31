import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookCheck,
  CalendarDays,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Moon,
  PackageOpen,
  ReceiptText,
  ShoppingBag,
  Sun,
  Target,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Button, Select } from './atoms';
import { dashboardPath } from '../domain';

const nav = {
  cashier: [
    ['Dashboard', '/cashier/dashboard', LayoutDashboard],
    ['New order', '/cashier/order', Coffee],
    ['Orders', '/orders', ReceiptText],
    ['Seats', '/seats', Users],
    ['Shift & requests', '/cashier/people', CalendarDays],
    ['Notes', '/notes', ClipboardList],
  ],
  manager: [
    ['Overview', '/manager/dashboard', LayoutDashboard],
    ['Revenue', '/manager/revenue', BarChart3],
    ['Orders', '/orders', ReceiptText],
    ['Seats', '/seats', Users],
    ['Expenses', '/manager/expenses', WalletCards],
    ['Inventory & recipes', '/manager/inventory', PackageOpen],
    ['Profitability', '/manager/profitability', BarChart3],
    ['SOP & notes', '/manager/sop', BookCheck],
  ],
  admin: [
    ['Portfolio', '/admin/dashboard', LayoutDashboard],
    ['New order', '/admin/order', Coffee],
    ['Orders', '/orders', ReceiptText],
    ['Seats', '/seats', Users],
    ['Shift & requests', '/admin/people', CalendarDays],
    ['Notes', '/admin/notes', ClipboardList],
    ['Revenue', '/admin/revenue', BarChart3],
    ['Expenses', '/admin/expenses', WalletCards],
    ['Inventory & recipes', '/admin/inventory', PackageOpen],
    ['Profitability', '/admin/profitability', BarChart3],
    ['Run SOP & notes', '/admin/run-sop', BookCheck],
    ['Insights', '/admin/insights', BarChart3],
    ['Menu lab', '/admin/menu', Coffee],
    ['Experiments', '/admin/experiments', Target],
    ['Order types', '/admin/order-types', ClipboardList],
    ['Tables', '/admin/tables', Users],
    ['Coupons', '/admin/coupons', ShoppingBag],
    ['Targets & schedule', '/admin/operations', Target],
    ['Staff & shifts', '/admin/staff', Users],
    ['SOP templates', '/admin/sop', BookCheck],
    ['Payment QR', '/admin/payment-qr', WalletCards],
    ['Users & roles', '/admin/users-access', Users],
  ],
  kitchen: [['Kitchen', '/kitchen/dashboard', ClipboardList]],
  display: [['Menu display', '/display/dashboard', Coffee]],
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    role,
    user,
    business,
    setBusiness,
    tenants,
    theme,
    toggleTheme,
    demo,
    setDemo,
    data,
    update,
    logout,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  const global = role === 'superadmin' && user.businessIds.includes('*');
  const navRole = role === 'superadmin' ? 'admin' : role;
  const allowed = tenants.filter((b) => global || user.businessIds.includes(b.id));

  const isRead = (message: (typeof data.messages)[number]) =>
    data.messagesRead.includes(message.id) ||
    (!!message.businessId &&
      data.messagesRead.includes(`[${message.businessId}] ${message.id}`));
  const unread = data.messages.filter((message) => !isRead(message)).length;
  const canMarkRead =
    business !== 'all' && ['cashier', 'admin', 'superadmin'].includes(role);

  const dismissMessages = () => {
    setMessagesOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!messagesOpen) return;
    close.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissMessages();
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [messagesOpen]);

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const wide = window.matchMedia('(min-width: 801px)');
    const reset = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    wide.addEventListener('change', reset);
    return () => wide.removeEventListener('change', reset);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = sidebar.current?.querySelector<HTMLElement>('a,button');
    first?.focus();
    document.body.classList.add('nav-open');
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuTrigger.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !sidebar.current) return;
      const items = [
        ...sidebar.current.querySelectorAll<HTMLElement>(
          'a,button:not(:disabled)'
        ),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.classList.remove('nav-open');
      if (previous === menuTrigger.current) menuTrigger.current?.focus();
    };
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <header className="topbar">
        <button
          ref={menuTrigger}
          className="mobile-menu"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="app-navigation"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <MenuIcon />}
        </button>
        <NavLink className="brand" to={dashboardPath(role)}>
          <span>L</span>
          <div>
            <strong>Light POS</strong>
            <small>Sample POS workspace</small>
          </div>
        </NavLink>
        <div className="top-context">
          <div className="identity">
            <strong>{user.name}</strong>
            <small>{role}</small>
          </div>
          <Select
            label="Business"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
          >
            {global && <option value="all">All businesses</option>}
            {allowed.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            label="Demo state"
            value={demo}
            onChange={(e) => setDemo(e.target.value as typeof demo)}
          >
            <option value="ready">Ready</option>
            <option value="loading">Loading</option>
            <option value="empty">Empty</option>
            <option value="error">Error</option>
          </Select>
          <button
            ref={trigger}
            className="icon-button message-trigger"
            onClick={() => setMessagesOpen((value) => !value)}
            aria-label={`Messages (${unread} unread)`}
            aria-haspopup="dialog"
            aria-expanded={messagesOpen}
            aria-controls="messages-panel"
          >
            <Mail aria-hidden="true" />
            {unread > 0 && <span aria-hidden="true">{unread}</span>}
          </button>
          <button
            className="icon-button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>
      {messagesOpen && (
        <div
          className="message-panel-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismissMessages();
          }}
        >
          <section
            id="messages-panel"
            className="message-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messages-title"
          >
            <header>
              <div>
                <h2 id="messages-title">Messages</h2>
                <small>{unread} unread</small>
              </div>
              <button
                ref={close}
                className="icon-button"
                aria-label="Close messages"
                onClick={dismissMessages}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            {data.messages.length ? (
              data.messages.map((message) => {
                const read = isRead(message);
                const actionable = canMarkRead && !read;
                return (
                  <button
                    className={`message ${read ? 'read' : ''}`}
                    key={`${message.businessId || business}-${message.id}`}
                    disabled={!actionable}
                    onClick={() =>
                      update(
                        (d) => ({
                          ...d,
                          messagesRead: [
                            ...new Set([...d.messagesRead, message.id]),
                          ],
                        }),
                        `Read message ${message.id}`
                      )
                    }
                    aria-label={
                      actionable
                        ? `Mark message from ${message.from} as read`
                        : `Message from ${message.from}, ${read ? 'read' : 'unread'}`
                    }
                  >
                    <Mail aria-hidden="true" />
                    <div>
                      <strong>{message.from}</strong>
                      <p>{message.text}</p>
                      <small>{message.time}</small>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="muted">No messages.</p>
            )}
          </section>
        </div>
      )}
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => {
            setOpen(false);
            menuTrigger.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="app-navigation"
        className={`sidebar ${open ? 'open' : ''}`}
      >
        <nav aria-label={`${role} navigation`}>
          {[
            ...nav[navRole],
            ...(global ? ([['Tenants', '/admin/tenants', Users]] as const) : []),
          ].map(([name, to, Icon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive || (to === '/orders' && loc.pathname.startsWith('/orders'))
                  ? 'active'
                  : ''
              }
            >
              <Icon aria-hidden="true" />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Button className="sidebar-logout" onClick={() => void logout()}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
          <span className="live-dot" />
          Server session · synced
          <br />
          <small>Signed in as {user.username}</small>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
