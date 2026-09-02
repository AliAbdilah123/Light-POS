import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {App} from './App';

afterEach(()=>{cleanup();localStorage.clear()});

describe('representative workflows',()=>{
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
