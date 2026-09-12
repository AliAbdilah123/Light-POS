import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {App} from './App';

afterEach(()=>{cleanup();localStorage.clear()});

describe('representative workflows',()=>{
  it('opens header messages, marks one read, closes, and links to all messages',async()=>{
    render(<MemoryRouter initialEntries={['/manager/dashboard']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    const trigger=screen.getByRole('button',{name:'Messages (2 unread)'});
    expect(trigger).toHaveTextContent('2');
    await u.click(trigger);
    const panel=screen.getByRole('dialog',{name:'Messages'});
    expect(panel).toHaveTextContent('Manager · Dinda');
    expect(panel).toHaveTextContent('Team briefing moved to 15:30 today.');
    expect(panel).toHaveTextContent('Today · 08:12');
    await u.click(screen.getByRole('button',{name:'Mark message from Manager · Dinda as read'}));
    expect(screen.getByRole('button',{name:'Messages (1 unread)'})).toHaveTextContent('1');
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog',{name:'Messages'})).not.toBeInTheDocument();
    await u.click(screen.getByRole('button',{name:'Messages (1 unread)'}));
    await u.click(screen.getByRole('link',{name:'Show all messages'}));
    expect(await screen.findByRole('heading',{name:'Good morning, Ayu'})).toBeInTheDocument();
  });

  it('trims and persists an order name on a paid order for list, detail, and search',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.type(screen.getByLabelText('Order name'),'  Morning pickup  ');
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    await u.click(screen.getAllByRole('button',{name:'Review & pay'})[0]);
    await u.click(screen.getByRole('button',{name:/Cash/}));
    expect(screen.getByLabelText('Order name')).toHaveValue('');
    await u.click(screen.getByRole('button',{name:'Start next order'}));
    await u.click(screen.getByRole('link',{name:'Orders'}));
    expect(await screen.findByText('Morning pickup')).toBeInTheDocument();
    await u.clear(screen.getByLabelText('Search orders'));
    await u.type(screen.getByLabelText('Search orders'),'morning pickup');
    await u.click(screen.getByRole('button',{name:/Morning pickup/}));
    expect(screen.getByRole('dialog')).toHaveTextContent('Order nameMorning pickup');
  });

  it('clears an order name when held and restores its trimmed value on resume',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.type(screen.getByLabelText('Order name'),'  Patio group  ');
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    await u.click(screen.getByRole('button',{name:'Hold'}));
    expect(screen.getByLabelText('Order name')).toHaveValue('');
    await u.click(screen.getByRole('button',{name:/Resume Patio group · Held/}));
    expect(screen.getByLabelText('Order name')).toHaveValue('Patio group');
  });

  it('saves an unpaid open order and exposes every held or open order for resume',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    expect(screen.getByRole('button',{name:'Open order'})).toBeDisabled();
    await u.type(screen.getByLabelText('Order name'),'Held patio');
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    await u.click(screen.getByRole('button',{name:'Hold'}));
    await u.type(screen.getByLabelText('Order name'),'  Open pickup  ');
    await u.click(screen.getByRole('button',{name:/Butter croissant/i}));
    await u.click(screen.getByRole('button',{name:'Open order'}));
    expect(screen.getByLabelText('Order name')).toHaveValue('');
    expect(screen.getByRole('region',{name:'Resumable orders'})).toHaveTextContent('Held patio');
    expect(screen.getByRole('region',{name:'Resumable orders'})).toHaveTextContent('Open pickup');
    const persisted=JSON.parse(localStorage.getItem('light-pos-demo-v1')||'{}');
    const opened=persisted.orders.find((order:{orderName?:string})=>order.orderName==='Open pickup');
    expect(opened).toMatchObject({status:'Open',orderName:'Open pickup'});
    expect(opened).not.toHaveProperty('payment');
    expect(persisted.audit[0]).not.toContain('payment completed');
    await u.click(screen.getByRole('button',{name:/Resume Open pickup · Open/}));
    expect(screen.getByLabelText('Order name')).toHaveValue('Open pickup');
    expect(screen.getByText('Butter croissant',{selector:'.line-name strong'})).toBeInTheDocument();
  });

  it('restores modifiers and item notes when resuming an open order',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    await u.click(screen.getByRole('button',{name:'Cappuccino Standard'}));
    await u.selectOptions(screen.getByLabelText('Modifier'),'Less sweet');
    await u.type(screen.getByLabelText('Item note'),'No cinnamon');
    await u.click(screen.getByRole('button',{name:'Save changes'}));
    await u.click(screen.getByRole('button',{name:'Open order'}));
    await u.click(screen.getByRole('button',{name:/Resume S-/}));
    expect(screen.getByText('Less sweet · No cinnamon')).toBeInTheDocument();
  });

  it('adds a product and exposes calculated checkout total',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    expect(screen.getByText(/35\.200/, {selector:'.grand b'})).toBeInTheDocument();
    await u.click(screen.getAllByRole('button',{name:'Review & pay'})[0]);
    expect(screen.getByRole('heading',{name:'Checkout'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Dynamic QRIS/})).toBeInTheDocument();
  });

  it('shows a clear unavailable state without an add affordance',()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const unavailable=screen.getByRole('button',{name:/Banana loaf Bakery Unavailable/i});
    expect(unavailable).toBeDisabled();
    expect(unavailable.querySelector('.product-plus')).not.toBeInTheDocument();
  });

  it('switches role and navigates to manager overview',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/dashboard']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Role'),'manager');
    expect(await screen.findByRole('heading',{name:'Service overview'})).toBeInTheDocument();
  });

  it('creates a coupon with governed reason',async()=>{
    render(<MemoryRouter initialEntries={['/admin/coupons']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.type(screen.getByLabelText('Code'),'welcome');
    await u.type(screen.getByLabelText('Value'),'12');
    await u.selectOptions(screen.getByLabelText('Reason'),'Review incentive');
    await u.click(screen.getByRole('button',{name:'Create coupon'}));
    expect(screen.getByText('WELCOME')).toBeInTheDocument();
  });
});
