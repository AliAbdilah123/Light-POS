import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Coffee,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Moon,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Printer as PrinterIcon,
  ReceiptText,
  Settings2,
  Sun,
  Table2,
  Target,
  TicketPercent,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore, type Session, type Tenant } from '../store';
import { Button } from './ui/button';
import { dashboardPath, type Role } from '../domain';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';

type NavEntry = string | readonly [string, string, LucideIcon];
type NavRole = 'cashier' | 'manager' | 'admin' | 'kitchen' | 'display';

const nav: Record<NavRole, readonly NavEntry[]> = {
  cashier: [
    'Today',
    ['Dashboard', '/cashier/dashboard', LayoutDashboard],
    'Service',
    ['New order', '/cashier/order', Coffee],
    ['Orders', '/orders', ReceiptText],
    ['Seats', '/seats', Table2],
    'My work',
    ['Shift & requests', '/cashier/people', CalendarDays],
    ['Notes', '/notes', ClipboardList],
  ],
  manager: [
    'Overview',
    ['Overview', '/manager/dashboard', LayoutDashboard],
    ['Revenue', '/manager/revenue', BarChart3],
    'Service',
    ['Orders', '/orders', ReceiptText],
    ['Seats', '/seats', Table2],
    ['Leave approvals', '/manager/requests', CalendarDays],
    'Operations',
    ['Expenses', '/manager/expenses', WalletCards],
    ['Inventory & recipes', '/manager/inventory', PackageOpen],
    ['Profitability', '/manager/profitability', BarChart3],
    ['SOP & notes', '/manager/sop', BookCheck],
  ],
  admin: [
    'Overview',
    ['Portfolio', '/admin/dashboard', LayoutDashboard],
    ['Revenue', '/admin/revenue', BarChart3],
    ['Insights', '/admin/insights', BarChart3],
    'Service',
    ['New order', '/admin/order', Coffee],
    ['Orders', '/orders', ReceiptText],
    ['Seats', '/seats', Table2],
    ['Shift & requests', '/admin/people', CalendarDays],
    ['Leave approvals', '/admin/requests', CalendarDays],
    ['Notes', '/admin/notes', ClipboardList],
    ['Run SOP & notes', '/admin/run-sop', BookCheck],
    'Operations',
    ['Expenses', '/admin/expenses', WalletCards],
    ['Inventory & recipes', '/admin/inventory', PackageOpen],
    ['Profitability', '/admin/profitability', BarChart3],
    ['Staff & shifts', '/admin/staff', Users],
    ['Targets & schedule', '/admin/operations', Target],
    'Catalogue',
    ['Menu catalog', '/admin/menu', Coffee],
    ['Menu lab', '/admin/menu-lab', FlaskConical],
    ['Experiments', '/admin/experiments', FlaskConical],
    ['Order types', '/admin/order-types', ClipboardList],
    ['Tables', '/admin/tables', Table2],
    ['Coupons', '/admin/coupons', TicketPercent],
    'Administration',
    ['SOP templates', '/admin/sop', BookCheck],
    ['Payment QR', '/admin/payment-qr', WalletCards],
    ['Printers & printing', '/admin/printers', PrinterIcon],
    ['Users & roles', '/admin/users-access', Settings2],
  ],
  kitchen: [['Kitchen', '/kitchen/dashboard', ClipboardList]],
  display: [['Menu display', '/display/dashboard', Coffee]],
};

const pageTitles: Record<string, string> = {
  '/cashier/dashboard': 'Dashboard',
  '/cashier/order': 'New order',
  '/cashier/people': 'Shift & requests',
  '/orders': 'Orders',
  '/seats': 'Seats',
  '/notes': 'Notes',
  '/manager/dashboard': 'Overview',
  '/manager/revenue': 'Revenue',
  '/manager/expenses': 'Expenses',
  '/manager/inventory': 'Inventory & recipes',
  '/manager/profitability': 'Profitability',
  '/manager/sop': 'SOP & notes',
  '/manager/requests': 'Leave approvals',
  '/admin/dashboard': 'Portfolio',
  '/admin/order': 'New order',
  '/admin/people': 'Shift & requests',
  '/admin/requests': 'Leave approvals',
  '/admin/notes': 'Notes',
  '/admin/revenue': 'Revenue',
  '/admin/expenses': 'Expenses',
  '/admin/inventory': 'Inventory & recipes',
  '/admin/profitability': 'Profitability',
  '/admin/run-sop': 'Run SOP & notes',
  '/admin/insights': 'Insights',
  '/admin/menu': 'Menu catalog',
  '/admin/menu-lab': 'Menu lab',
  '/admin/experiments': 'Experiments',
  '/admin/coupons': 'Coupons',
  '/admin/order-types': 'Order types',
  '/admin/tables': 'Tables',
  '/admin/operations': 'Targets & schedule',
  '/admin/staff': 'Staff & shifts',
  '/admin/sop': 'SOP templates',
  '/admin/tenants': 'Tenants',
  '/admin/users-access': 'Users & roles',
  '/admin/payment-qr': 'Payment QR',
  '/admin/printers': 'Printers & printing',
  '/kitchen/dashboard': 'Kitchen',
  '/display/dashboard': 'Menu display',
};

const pageGroups: Record<string, string> = {
  '/admin/dashboard': 'Overview',
  '/admin/revenue': 'Overview',
  '/admin/insights': 'Overview',
  '/admin/order': 'Service',
  '/admin/people': 'Service',
  '/admin/requests': 'Service',
  '/admin/notes': 'Service',
  '/admin/run-sop': 'Service',
  '/admin/expenses': 'Operations',
  '/admin/inventory': 'Operations',
  '/admin/profitability': 'Operations',
  '/admin/staff': 'Operations',
  '/admin/operations': 'Operations',
  '/admin/menu': 'Catalogue',
  '/admin/menu-lab': 'Catalogue',
  '/admin/experiments': 'Catalogue',
  '/admin/order-types': 'Catalogue',
  '/admin/tables': 'Catalogue',
  '/admin/coupons': 'Catalogue',
  '/admin/sop': 'Administration',
  '/admin/payment-qr': 'Administration',
  '/admin/printers': 'Administration',
  '/admin/users-access': 'Administration',
  '/admin/tenants': 'Administration',
  '/manager/dashboard': 'Overview',
  '/manager/revenue': 'Overview',
  '/manager/requests': 'Service',
  '/manager/expenses': 'Operations',
  '/manager/inventory': 'Operations',
  '/manager/profitability': 'Operations',
  '/manager/sop': 'Operations',
  '/cashier/dashboard': 'Today',
  '/cashier/order': 'Service',
  '/cashier/people': 'My work',
  '/orders': 'Service',
  '/seats': 'Service',
  '/notes': 'My work',
  '/kitchen/dashboard': 'Kitchen',
  '/display/dashboard': 'Display',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    role,
    user,
    business,
    setBusiness,
    tenants,
    theme,
    toggleTheme,
    data,
    update,
    logout,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('pos-sidebar-collapsed') === '1'
  );
  const [messagesOpen, setMessagesOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  const global = role === 'superadmin' && user.businessIds.includes('*');
  const navRole: NavRole = role === 'superadmin' ? 'admin' : role;
  const allowed = tenants.filter((b) => global || user.businessIds.includes(b.id));
  const pageTitle = pageTitles[loc.pathname] || (loc.pathname.startsWith('/orders/') ? 'Order detail' : 'Workspace');
  const group = pageGroups[loc.pathname] || 'Workspace';

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
    localStorage.setItem('pos-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const wide = window.matchMedia('(min-width: 901px)');
    const reset = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    wide.addEventListener('change', reset);
    return () => wide.removeEventListener('change', reset);
  }, []);

  if (role === 'display') {
    return (
      <main id="main" className="display-kiosk" tabIndex={-1}>
        {children}
      </main>
    );
  }

  return (
    <div className={`app-shell${collapsed ? ' collapsed' : ''}`}>
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
        <NavLink className="topbar-brand" to={dashboardPath(role)} aria-label="Light POS home">
          <span>L</span>
        </NavLink>
        <div className="topbar-context">
          <span className="crumb">
            <Building2 aria-hidden="true" />
            {group}
          </span>
          <span className="divider" aria-hidden="true" />
          <strong>{pageTitle}</strong>
        </div>
        <div className="top-context">
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="sidebar mobile-sidebar">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Navigation
            idPrefix="mobile"
            role={role}
            navRole={navRole}
            global={global}
            pathname={loc.pathname}
            logout={logout}
            user={user}
            business={business}
            setBusiness={setBusiness}
            tenants={allowed}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <aside id="app-navigation" className="sidebar desktop-sidebar">
        <Navigation
          idPrefix="desktop"
          role={role}
          navRole={navRole}
          global={global}
          pathname={loc.pathname}
          logout={logout}
          user={user}
          business={business}
          setBusiness={setBusiness}
          tenants={allowed}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

function Navigation({
  idPrefix,
  role,
  navRole,
  global,
  pathname,
  logout,
  user,
  business,
  setBusiness,
  tenants,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  idPrefix: string;
  role: Role;
  navRole: NavRole;
  global: boolean;
  pathname: string;
  logout: () => Promise<void>;
  user: Session;
  business: string;
  setBusiness: (business: string) => void;
  tenants: Tenant[];
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const entries: readonly NavEntry[] = nav[navRole];
  const extras: readonly NavEntry[] = global
    ? [['Tenants', '/admin/tenants', Building2] as const]
    : [];
  const items: readonly NavEntry[] = [...entries, ...extras];
  return (
    <>
      <div className="sidebar-brand">
        <NavLink className="brand" to={dashboardPath(role)} onClick={onNavigate}>
          <span>L</span>
          <div>
            <strong>Light POS</strong>
            <small>Sample workspace</small>
          </div>
        </NavLink>
        {onToggleCollapse && (
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="app-navigation"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <section className="sidebar-context" aria-label="Account and tenant">
        <div className="sidebar-user">
          <span aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
          <div title={`${user.name} · @${user.username} · ${role}`}>
            <strong>{user.name}</strong>
            <small>@{user.username} · {role}</small>
          </div>
        </div>
        <TenantSelect
          id={`${idPrefix}-business`}
          global={global}
          value={business}
          tenants={tenants}
          onChange={setBusiness}
        />
      </section>
      <nav aria-label={`${role} navigation`}>
        {items.map((entry) => {
          if (typeof entry === 'string')
            return (
              <span className="nav-group" key={entry}>
                {entry}
              </span>
            );
          const [name, to, Icon] = entry;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              title={collapsed ? name : undefined}
              className={({ isActive }) =>
                isActive || (to === '/orders' && pathname.startsWith('/orders'))
                  ? 'active'
                  : ''
              }
            >
              <Icon aria-hidden="true" />
              <span>{name}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <Button className="sidebar-logout" onClick={() => void logout()}>
          <LogOut aria-hidden="true" />
          <span>Sign out</span>
        </Button>
        <span>
          <span className="live-dot" /> Server session · synced
        </span>
      </div>
    </>
  );
}

function TenantSelect({
  id,
  global,
  value,
  tenants,
  onChange,
}: {
  id: string;
  global: boolean;
  value: string;
  tenants: Tenant[];
  onChange: (business: string) => void;
}) {
  const options = [
    ...(global ? [{ id: 'all', name: 'All businesses' }] : []),
    ...tenants,
  ];
  const selected = options.find((option) => option.id === value)?.name || '';
  const [query, setQuery] = useState(selected);
  const [open, setOpen] = useState(false);
  const visible = options.filter((option) =>
    option.name.toLowerCase().includes(query.toLowerCase())
  );
  useEffect(() => setQuery(selected), [selected]);
  const choose = (option: (typeof options)[number]) => {
    onChange(option.id);
    setQuery(option.name);
    setOpen(false);
  };
  return (
    <div className="field tenant-combobox">
      <label htmlFor={id}>Business</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        value={query}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setQuery(selected);
            setOpen(false);
          } else if (event.key === 'Enter' && visible[0]) {
            event.preventDefault();
            choose(visible[0]);
          }
        }}
      />
      {open && (
        <div id={`${id}-options`} role="listbox" aria-label="Businesses">
          {visible.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.id === value}
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.name}
            </button>
          ))}
          {!visible.length && <small>No tenants found</small>}
        </div>
      )}
    </div>
  );
}
