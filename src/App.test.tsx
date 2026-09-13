import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {App} from './App';

afterEach(()=>{vi.useRealTimers();cleanup();localStorage.clear()});

describe('representative workflows',()=>{
  it('resumes the complete held-order context from immutable snapshots',async()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[{id:'HELD-1',businessId:'harbor',createdAt:'2026-09-02T10:00:00Z',service:'Dine In',tableIds:['T01','T07'],status:'Held',lines:[{id:'saved',menuId:'missing-now',name:'Saved special',price:41000,qty:2,modifier:'Less sweet',note:'No foam'}],subtotal:82000,discount:8200,tax:7380,total:81180,coupon:'REVIEW10'}]}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);await userEvent.click(screen.getByRole('button',{name:'1 held order'}));expect(screen.getByRole('dialog',{name:'Held orders'})).toHaveTextContent('HELD-1');await userEvent.click(screen.getByRole('button',{name:/Restore HELD-1/}));
    expect(screen.queryByRole('dialog',{name:'Held orders'})).not.toBeInTheDocument();
    expect(screen.getByText('Saved special').closest<HTMLElement>('.cart-line')).toHaveTextContent('Less sweet · No foam');expect(screen.getByText('Saved special').closest<HTMLElement>('.cart-line')).toHaveTextContent(/82\.000/);
    expect(screen.getByRole('button',{name:'Dine In'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('option',{name:/T01/})).toHaveProperty('selected',true);expect(screen.getByRole('option',{name:/T07/})).toHaveProperty('selected',true);expect(screen.getByText(/Discount · REVIEW10/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).orders).toEqual([]);
  });

  it('shows every held order behind the header count',async()=>{
    const held=(id:string,service:string,total:number)=>({id,businessId:'harbor',createdAt:'2026-09-02T10:00:00Z',service,status:'Held',lines:[{id:`${id}-line`,menuId:'cap',name:`Item ${id}`,price:total,qty:1}],subtotal:total,discount:0,tax:0,total});localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[held('HELD-A','Takeaway',20000),held('HELD-B','Delivery',30000)]}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);await userEvent.click(screen.getByRole('button',{name:'2 held orders'}));const dialog=screen.getByRole('dialog',{name:'Held orders'});expect(within(dialog).getByRole('button',{name:/Restore HELD-A/})).toHaveTextContent('Takeaway');expect(within(dialog).getByRole('button',{name:/Restore HELD-B/})).toHaveTextContent('Delivery');
  });

  it('preserves the active cart and held order when resume replacement is cancelled',async()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[{id:'HELD-2',businessId:'harbor',createdAt:'2026-09-02T10:00:00Z',service:'Takeaway',status:'Held',lines:[{id:'saved',menuId:'cross',name:'Held pastry',price:26000,qty:1}],subtotal:26000,discount:0,tax:2600,total:28600}]}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);await userEvent.click(screen.getAllByRole('button',{name:/Cappuccino/i})[0]);await userEvent.click(screen.getByRole('button',{name:/Add to order/}));await userEvent.click(screen.getByRole('button',{name:'1 held order'}));await userEvent.click(screen.getByRole('button',{name:/Restore HELD-2/}));
    const confirmation=screen.getByRole('dialog',{name:'Replace current order?'});expect(confirmation).toHaveTextContent('HELD-2');await userEvent.click(within(confirmation).getByRole('button',{name:'Cancel'}));
    expect(screen.getByRole('dialog',{name:'Held orders'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Cappuccino Standard'})).toBeInTheDocument();expect(screen.queryByText('Held pastry')).not.toBeInTheDocument();expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).orders[0].id).toBe('HELD-2');
    await userEvent.click(screen.getByRole('button',{name:/Restore HELD-2/}));await userEvent.click(screen.getByRole('button',{name:'Replace order'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByText('Held pastry')).toBeInTheDocument();expect(screen.queryByText('Cappuccino',{selector:'.cart-line strong'})).not.toBeInTheDocument();expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).orders).toEqual([]);
  });

  it('retains a held order until restoration succeeds and notices an unavailable coupon',async()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[{id:'HELD-3',businessId:'harbor',createdAt:'2026-09-02T10:00:00Z',service:'Dine In',table:'T01',status:'Held',lines:[{id:'saved',menuId:'cap',name:'Saved coffee',price:30000,qty:1}],subtotal:30000,discount:15000,tax:1500,total:16500,coupon:'HEMAT15K'}]}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);await userEvent.click(screen.getByRole('button',{name:'1 held order'}));await userEvent.click(screen.getByRole('button',{name:/Restore HELD-3/}));
    expect(screen.getByRole('alert')).toHaveTextContent('Coupon HEMAT15K is unavailable');expect(screen.queryByText(/Discount ·/)).not.toBeInTheDocument();expect(screen.getByText(/30\.000/,{selector:'.totals b'})).toBeInTheDocument();expect(screen.getByRole('option',{name:/T01/})).toHaveProperty('selected',true);expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).orders).toEqual([]);
  });

  it('renders the default current-session catalog read-only for Display',()=>{
    localStorage.setItem('pos-role','display');
    render(<MemoryRouter initialEntries={['/display/dashboard']}><App/></MemoryRouter>);
    expect(screen.getByRole('heading',{name:'Menu display'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Menu display'})).toHaveAttribute('href','/display/dashboard');
    expect(screen.getByText('Cappuccino').closest<HTMLElement>('article')).toHaveTextContent(/Rp\s*32\.000/);
    expect(screen.getByText('Banana loaf').closest<HTMLElement>('article')).toHaveTextContent('Sold out');
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:/New order|Checkout|Expenses|Menu lab/i})).not.toBeInTheDocument();
  });

  it('uses the active experiment catalog and hides archived and private details on Display',()=>{
    const item=(id:string,name:string,price:number,archived=false)=>({id,kind:'item',name,category:'Specials',price,cost:0,available:true,icon:'x',archived,currentVersion:1,availability:id==='low'?'low':'available',versions:[{version:1,name,description:`${name} description`,category:'Specials',price,createdAt:'now',ingredients:[{id:`${id}-public`,name:'Public ingredient',hidden:false},{id:`${id}-private`,name:'Secret ingredient',hidden:true}]}]});
    const activeMenus=[item('low','Experiment coffee',41000),item('side','Experiment pastry',19000),item('old','Archived special',10000,true),{...item('set','Experiment set',55000),kind:'bundle' as const,versions:[{version:1,name:'Experiment set',description:'A complete set',category:'Bundles',price:55000,createdAt:'now',ingredients:[],components:[{menuId:'low',quantity:1},{menuId:'side',quantity:2}]}]}];
    localStorage.setItem('pos-role','display');localStorage.setItem('light-pos-demo-v1',JSON.stringify({experiments:[{id:'active',name:'Active',assumptions:'',menuDrafts:activeMenus,dailyTargets:{},status:'active'}]}));
    render(<MemoryRouter initialEntries={['/display/dashboard']}><App/></MemoryRouter>);
    expect(screen.getByText('Experiment coffee').closest<HTMLElement>('article')).toHaveTextContent(/Rp\s*41\.000/);
    expect(screen.getByText('Experiment coffee').closest<HTMLElement>('article')).toHaveTextContent('Low');
    expect(screen.getByText('Experiment set').closest<HTMLElement>('article')).toHaveTextContent('1 × Experiment coffee, 2 × Experiment pastry');
    expect(screen.queryByText('Cappuccino')).not.toBeInTheDocument();expect(screen.queryByText('Archived special')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Public ingredient/).length).toBeGreaterThan(0);expect(screen.queryByText(/Secret ingredient/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows Display loading, empty, and error states',async()=>{
    localStorage.setItem('pos-role','display');const u=userEvent.setup();render(<MemoryRouter initialEntries={['/display/dashboard']}><App/></MemoryRouter>);
    await u.selectOptions(screen.getByLabelText('Demo state'),'loading');expect(screen.getByLabelText('Loading menu display')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Demo state'),'empty');expect(screen.getByText('No menu items to display')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Demo state'),'error');expect(screen.getByRole('alert')).toHaveTextContent('Menu could not be loaded');
  });

  it('shows only Preparing kitchen orders oldest first and opens complete full-screen details',async()=>{
    localStorage.setItem('pos-role','kitchen');localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[
      {id:'NEW',businessId:'harbor',createdAt:'2026-09-02T10:00:00Z',service:'Takeaway',status:'Preparing',lines:[{id:'n',menuId:'cap',name:'Cappuccino',price:32000,qty:1}],subtotal:32000,discount:0,tax:3200,total:35200},
      {id:'READY',businessId:'harbor',createdAt:'2026-09-02T08:00:00Z',service:'Delivery',status:'Ready',lines:[],subtotal:0,discount:0,tax:0,total:0},
      {id:'OLD',businessId:'harbor',createdAt:'2026-09-02T09:00:00Z',service:'Dine In',tableIds:['T01','T07'],status:'Preparing',lines:[{id:'o',menuId:'cap',name:'Cappuccino',price:32000,qty:2,modifier:'Less sweet',note:'No foam'}],subtotal:64000,discount:0,tax:6400,total:70400}
    ]}));
    render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);
    const cards=screen.getAllByRole('button',{name:/Open order/});expect(cards.map(x=>x.textContent)).toEqual([expect.stringContaining('OLD'),expect.stringContaining('NEW')]);expect(screen.queryByText('READY')).not.toBeInTheDocument();expect(cards[0]).toHaveTextContent('T01, T07');
    await userEvent.click(cards[0]);const dialog=screen.getByRole('dialog',{name:'Order OLD'});expect(dialog).toHaveClass('kitchen-detail');expect(dialog).toHaveTextContent('2 × Cappuccino');expect(dialog).toHaveTextContent('Less sweet');expect(dialog).toHaveTextContent('No foam');
  });

  it('marks only Preparing kitchen orders Ready safely',async()=>{
    localStorage.setItem('pos-role','kitchen');render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);await userEvent.click(screen.getByRole('button',{name:/Open order S-104/}));await userEvent.click(screen.getByRole('button',{name:'Mark Ready'}));
    const saved=JSON.parse(localStorage.getItem('light-pos-demo-v1')!);expect(saved.orders.find((o:{id:string})=>o.id==='S-104').status).toBe('Ready');expect(screen.queryByText('S-104')).not.toBeInTheDocument();
  });

  it('persists kitchen availability through the active session menu and restores New Order immediately',async()=>{
    localStorage.setItem('pos-role','kitchen');render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);const u=userEvent.setup();const row=screen.getByText('Cappuccino').closest<HTMLElement>('.kitchen-menu')!;
    await u.click(within(row).getByRole('button',{name:'Set low'}));expect(row).toHaveTextContent('Low');cleanup();localStorage.setItem('pos-role','cashier');render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);expect(screen.getByRole('button',{name:/Cappuccino/i})).toHaveTextContent('Low');
    cleanup();localStorage.setItem('pos-role','kitchen');render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);const restored=screen.getByText('Cappuccino').closest<HTMLElement>('.kitchen-menu')!;await u.click(within(restored).getByRole('button',{name:'Set sold out'}));cleanup();localStorage.setItem('pos-role','cashier');render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);expect(screen.getByRole('button',{name:/Cappuccino.*Unavailable/i})).toHaveAttribute('aria-disabled','true');
    cleanup();localStorage.setItem('pos-role','kitchen');render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);await u.click(within(screen.getByText('Cappuccino').closest<HTMLElement>('.kitchen-menu')!).getByRole('button',{name:'Restore available'}));expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).menus.find((m:{id:string})=>m.id==='cap').availability).toBe('available');
  });

  it('keeps checkout, admin, and expense controls out of kitchen',()=>{localStorage.setItem('pos-role','kitchen');render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);expect(screen.queryByText('Checkout')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:/Expenses|New order|Admin/i})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Record expense|Create menu/i})).not.toBeInTheDocument()});
  it('creates a bundle, shows its composition, sells at its custom price, and snapshots the sale',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/menu']}><App/></MemoryRouter>);const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:'Add menu'}));
    await u.selectOptions(screen.getByLabelText('Menu kind'),'Bundle');await u.type(screen.getByLabelText('Menu name'),'Coffee Pair');await u.type(screen.getByLabelText('Description'),'Coffee and pastry');await u.type(screen.getByLabelText('Category'),'Bundles');await u.type(screen.getByLabelText('Price'),'50000');
    await u.click(screen.getByRole('button',{name:'Add component'}));await u.selectOptions(screen.getByLabelText('Component 1 menu'),'cap');await u.clear(screen.getByLabelText('Component 1 quantity'));await u.type(screen.getByLabelText('Component 1 quantity'),'1');
    await u.click(screen.getByRole('button',{name:'Add component'}));await u.selectOptions(screen.getByLabelText('Component 2 menu'),'cross');await u.clear(screen.getByLabelText('Component 2 quantity'));await u.type(screen.getByLabelText('Component 2 quantity'),'2');await u.click(screen.getByRole('button',{name:'Create bundle'}));
    expect(screen.getByText('Coffee Pair').closest<HTMLElement>('.card')).toHaveTextContent('1 × Cappuccino, 2 × Butter croissant');
    cleanup();render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);await u.click(screen.getByRole('button',{name:/Coffee Pair/i}));await u.click(screen.getByRole('button',{name:/Add to order/}));await u.selectOptions(screen.getByLabelText('Table(s)'),'T01');expect(screen.getByText(/55\.000/,{selector:'.grand b'})).toBeInTheDocument();await u.click(screen.getAllByRole('button',{name:'Review & pay'})[0]);await u.click(screen.getByRole('button',{name:/Cash/}));
    const saved=JSON.parse(localStorage.getItem('light-pos-demo-v1')!);expect(saved.orders[0].lines[0]).toMatchObject({name:'Coffee Pair',price:50000});saved.menus.find((m:{name:string})=>m.name==='Coffee Pair').name='Changed';expect(saved.orders[0].lines[0]).toMatchObject({name:'Coffee Pair',price:50000});
  });

  it('surfaces bundles whose components were archived and prevents selling them',()=>{
    const menus=[{id:'a',kind:'item',name:'A',category:'Food',price:10000,cost:0,available:true,icon:'A',archived:true,currentVersion:1,availability:'available',versions:[{version:1,name:'A',description:'A desc',category:'Food',ingredients:[],price:10000,createdAt:'now'}]},{id:'b',kind:'item',name:'B',category:'Food',price:10000,cost:0,available:true,icon:'B',archived:false,currentVersion:1,availability:'available',versions:[{version:1,name:'B',description:'B desc',category:'Food',ingredients:[],price:10000,createdAt:'now'}]},{id:'set',kind:'bundle',name:'Set',category:'Bundles',price:15000,cost:0,available:true,icon:'◇',archived:false,currentVersion:1,availability:'available',versions:[{version:1,name:'Set',description:'Set desc',category:'Bundles',ingredients:[],components:[{menuId:'a',quantity:1},{menuId:'b',quantity:1}],price:15000,createdAt:'now'}]}];localStorage.setItem('light-pos-demo-v1',JSON.stringify({menus}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);const set=screen.getByRole('button',{name:/Set.*Unavailable/i});expect(set).toHaveAttribute('aria-disabled','true');fireEvent.click(set);expect(screen.queryByText('Set',{selector:'.cart-line strong'})).not.toBeInTheDocument();fireEvent.keyDown(set,{key:'Enter',shiftKey:true});expect(screen.getByRole('dialog')).toHaveTextContent('Composition unavailable');expect(screen.getByRole('dialog')).toHaveTextContent('1 × A');
  });
  it('creates and version-edits menu variations with free and paid options',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/menu']}><App/></MemoryRouter>);const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:'Add menu'}));await u.type(screen.getByLabelText('Menu name'),'Mocha');await u.type(screen.getByLabelText('Description'),'Chocolate coffee');await u.type(screen.getByLabelText('Category'),'Coffee');await u.type(screen.getByLabelText('Price'),'40000');
    await u.click(screen.getByRole('button',{name:'Add variation group'}));await u.type(screen.getByLabelText('Variation group 1 name'),'Sweetness');await u.click(screen.getByRole('button',{name:'Add option to Sweetness'}));await u.type(screen.getByLabelText('Sweetness option 1 name'),'Less sugar');await u.click(screen.getByRole('button',{name:'Add option to Sweetness'}));await u.type(screen.getByLabelText('Sweetness option 2 name'),'Extra shot');await u.type(screen.getByLabelText('Sweetness option 2 price'),'7000');await u.click(screen.getByRole('checkbox',{name:'Require Sweetness'}));await u.click(screen.getByRole('button',{name:'Create menu'}));
    const row=screen.getByText('Mocha').closest<HTMLElement>('.card')!;expect(row).toHaveTextContent('Sweetness: Less sugar, Extra shot +');await u.click(within(row).getByRole('button',{name:'Edit'}));expect(screen.getByLabelText('Variation group 1 name')).toHaveValue('Sweetness');await u.click(screen.getByRole('button',{name:'Save'}));const saved=JSON.parse(localStorage.getItem('light-pos-demo-v1')!);expect(saved.menus.find((m:{name:string})=>m.name==='Mocha').versions[1].variations[0]).toMatchObject({name:'Sweetness',required:true,options:[{name:'Less sugar',priceDelta:0},{name:'Extra shot',priceDelta:7000}]});
  });

  it('removes variation options and groups from the draft',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/menu']}><App/></MemoryRouter>);const u=userEvent.setup();const row=screen.getByText('Cappuccino').closest<HTMLElement>('.card')!;await u.click(within(row).getByRole('button',{name:'Edit'}));expect(screen.getAllByRole('button',{name:/Remove Sweetness option/})).toHaveLength(2);await u.click(screen.getByRole('button',{name:'Remove Sweetness option 1'}));expect(screen.getAllByRole('button',{name:/Remove Sweetness option/})).toHaveLength(1);expect(screen.getAllByRole('button',{name:/Remove (Sweetness|Coffee)$/})).toHaveLength(2);await u.click(screen.getByRole('button',{name:'Remove Sweetness'}));expect(screen.getAllByRole('button',{name:/Remove (Sweetness|Coffee)$/})).toHaveLength(1);
  });

  it('customizes every available item with notes and edits through the same fields',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));const dialog=screen.getByRole('dialog',{name:'Customize Cappuccino'});expect(screen.queryByText('Cappuccino',{selector:'.cart-line strong'})).not.toBeInTheDocument();
    await u.click(within(dialog).getByRole('radio',{name:/Less sugar.*Free/}));await u.click(within(dialog).getByRole('radio',{name:/1 extra shot.*7\.000/}));await u.click(within(dialog).getByRole('button',{name:'Increase quantity'}));await u.type(within(dialog).getByLabelText('Notes'),'No foam');expect(within(dialog).getByRole('button',{name:/Add to order/})).toHaveTextContent(/78\.000/);await u.click(within(dialog).getByRole('button',{name:/Add to order/}));
    const line=screen.getByText('Cappuccino',{selector:'.cart-line strong'}).closest<HTMLElement>('.cart-line')!;expect(line).toHaveTextContent('Less sugar · 1 extra shot · No foam');expect(line).toHaveTextContent(/78\.000/);await u.click(line.querySelector<HTMLButtonElement>('.line-name')!);
    const edit=screen.getByRole('dialog',{name:'Customize Cappuccino'});expect(within(edit).getByRole('radio',{name:/Less sugar.*Free/})).toBeChecked();expect(within(edit).getByRole('radio',{name:/1 extra shot.*7\.000/})).toBeChecked();expect(within(edit).getByText('2')).toBeInTheDocument();expect(within(edit).getByLabelText('Notes')).toHaveValue('No foam');await u.click(within(edit).getByRole('button',{name:'Decrease quantity'}));await u.clear(within(edit).getByLabelText('Notes'));await u.type(within(edit).getByLabelText('Notes'),'Oat cup');await u.click(within(edit).getByRole('button',{name:/Save changes/}));expect(line).toHaveTextContent('Less sugar · 1 extra shot · Oat cup');expect(line).toHaveTextContent(/39\.000/);
    await u.click(screen.getByRole('button',{name:/Long black/i}));expect(screen.getByRole('dialog',{name:'Customize Long black'})).toBeInTheDocument();expect(screen.queryByText('Long black',{selector:'.cart-line strong'})).not.toBeInTheDocument();await u.type(screen.getByLabelText('Notes'),'Extra hot');await u.click(screen.getByRole('button',{name:/Add to order/}));expect(screen.getByText('Long black',{selector:'.cart-line strong'}).closest<HTMLElement>('.cart-line')).toHaveTextContent('Extra hot');
  });

  it('renders snapshotted variations in kitchen and order history',async()=>{
    const lines=[{id:'custom',menuId:'cap',name:'Cappuccino',basePrice:32000,price:39000,qty:1,variations:[{groupId:'sweetness',groupName:'Sweetness',optionId:'less',optionName:'Less sugar',priceDelta:0},{groupId:'coffee',groupName:'Coffee',optionId:'extra',optionName:'1 extra shot',priceDelta:7000}],note:'No foam'}];localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[{id:'SNAP',businessId:'harbor',createdAt:new Date().toISOString(),service:'Takeaway',status:'Preparing',lines,subtotal:39000,discount:0,tax:3900,total:42900}]}));
    localStorage.setItem('pos-role','kitchen');render(<MemoryRouter initialEntries={['/kitchen/dashboard']}><App/></MemoryRouter>);expect(screen.getByRole('button',{name:'Open order SNAP'})).toHaveTextContent('Less sugar · 1 extra shot · No foam');await userEvent.click(screen.getByRole('button',{name:'Open order SNAP'}));expect(screen.getByRole('dialog')).toHaveTextContent('Less sugar · 1 extra shot');cleanup();localStorage.setItem('pos-role','cashier');
    render(<MemoryRouter initialEntries={['/orders']}><App/></MemoryRouter>);await userEvent.click(screen.getByText('SNAP'));expect(screen.getByRole('dialog')).toHaveTextContent('Less sugar · 1 extra shot');expect(screen.getByRole('dialog')).toHaveTextContent('No foam');
  });

  it('creates and version-edits persisted menus with hidden ingredients by default',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/menu']}><App/></MemoryRouter>);const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:'Add menu'}));
    await u.type(screen.getByLabelText('Menu name'),'Mocha');await u.type(screen.getByLabelText('Description'),'Chocolate coffee');await u.type(screen.getByLabelText('Category'),'Coffee');await u.type(screen.getByLabelText('Price'),'40000');
    await u.click(screen.getByRole('button',{name:'Add ingredient'}));await u.type(screen.getByLabelText('Ingredient 1 name'),'Cocoa');
    expect(screen.getByRole('checkbox',{name:'Hide ingredient 1'})).toBeChecked();await u.click(screen.getByRole('button',{name:'Create menu'}));
    const row=screen.getByText('Mocha').closest<HTMLElement>('.card')!;expect(row).toHaveTextContent('Version 1');await u.click(within(row).getByRole('button',{name:'Edit'}));
    await u.clear(screen.getByLabelText('Price'));await u.type(screen.getByLabelText('Price'),'42000');await u.click(screen.getByRole('button',{name:'Save'}));
    expect(screen.getByText('Mocha').closest<HTMLElement>('.card')).toHaveTextContent('Versions: v1, v2');
  });

  it('filters catalog history and confirms archival without changing order snapshots',async()=>{
    const version=(version:number,name:string,createdAt:string)=>({version,name,description:`${name} description`,category:'Coffee',price:32000,createdAt,ingredients:[{id:'milk',name:'Milk',quantity:150,unit:'ml',hidden:false}]});const menus=[{id:'cap',kind:'item',name:'Cappuccino',category:'Coffee',price:32000,cost:0,available:true,icon:'C',archived:false,currentVersion:2,availability:'available',versions:[version(1,'Old Cappuccino','2026-09-01T00:00:00Z'),version(2,'Cappuccino','2026-09-02T00:00:00Z')]},{id:'black',kind:'item',name:'Long black',category:'Coffee',price:28000,cost:0,available:true,icon:'B',archived:false,currentVersion:1,availability:'available',versions:[{...version(1,'Long black','2026-09-02T00:00:00Z'),price:28000}]},{id:'tea',kind:'item',name:'Archived tea',category:'Tea',price:30000,cost:0,available:true,icon:'T',archived:true,currentVersion:1,availability:'available',versions:[{...version(1,'Archived tea','2026-09-02T00:00:00Z'),category:'Tea',price:30000}]}];
    localStorage.setItem('pos-role','admin');localStorage.setItem('light-pos-demo-v1',JSON.stringify({menus}));render(<MemoryRouter initialEntries={['/admin/menu']}><App/></MemoryRouter>);const u=userEvent.setup();const row=screen.getByText('Cappuccino').closest<HTMLElement>('.card')!;
    expect(screen.getByRole('button',{name:'Active'})).toHaveAttribute('aria-pressed','true');expect(screen.queryByText('Archived tea')).not.toBeInTheDocument();expect(within(row).queryByRole('button',{name:/version/i})).not.toBeInTheDocument();
    await u.click(screen.getByText('Cappuccino',{selector:'h3'}));const history=screen.getByRole('dialog',{name:'Cappuccino history'});expect(within(history).getAllByRole('heading',{level:3}).map(x=>x.textContent)).toEqual(['Version 2','Version 1']);expect(history).toHaveTextContent('Milk');await u.click(within(history).getByRole('button',{name:'Close dialog'}));
    await u.click(within(row).getByRole('button',{name:'Archive'}));const confirm=screen.getByRole('dialog',{name:'Archive Cappuccino?'});expect(confirm).toHaveTextContent('Cappuccino');await u.click(within(confirm).getByRole('button',{name:'Cancel'}));expect(row).toHaveTextContent('Available');
    await u.click(within(row).getByRole('button',{name:'Archive'}));await u.click(screen.getByRole('button',{name:'Archive menu'}));expect(screen.queryByText('Cappuccino',{selector:'h3'})).not.toBeInTheDocument();await u.click(screen.getByRole('button',{name:'Archived'}));expect(screen.getByText('Cappuccino',{selector:'h3'}).closest<HTMLElement>('.card')).toHaveTextContent('Archived');await u.click(screen.getByRole('button',{name:'All'}));expect(screen.getByText('Long black',{selector:'h3'})).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).orders.find((o:{id:string})=>o.id==='S-104').lines[0]).toMatchObject({name:'Cappuccino',price:32000});
  });

  it('uses cards for tap-to-add, long-press details, cancellation, and keyboard details without visible Details actions',()=>{
    vi.useFakeTimers();render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);const card=screen.getAllByRole('button',{name:/Long black/i})[0];
    expect(screen.queryByText('Details',{selector:'button'})).not.toBeInTheDocument();fireEvent.click(card);expect(screen.getByRole('dialog',{name:'Customize Long black'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));
    fireEvent(card,new MouseEvent('pointerdown',{bubbles:true,clientX:1,clientY:1}));fireEvent(card,new MouseEvent('pointermove',{bubbles:true,clientX:30,clientY:1}));act(()=>vi.advanceTimersByTime(700));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.pointerUp(card);
    fireEvent.pointerDown(card,{clientX:1,clientY:1});fireEvent.pointerCancel(card);act(()=>vi.advanceTimersByTime(700));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.pointerDown(card,{clientX:1,clientY:1});act(()=>vi.advanceTimersByTime(600));expect(screen.getByRole('dialog')).toHaveTextContent('Coffee');fireEvent.pointerUp(card);fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));
    fireEvent.keyDown(screen.getAllByRole('button',{name:/Cappuccino/i})[0],{key:'Enter',shiftKey:true});expect(screen.getByRole('dialog')).toHaveTextContent('Espresso');expect(screen.getByRole('dialog')).not.toHaveTextContent('Milk');
  });
  it('gives admin reused cashier and manager routes and actions',()=>{
    localStorage.setItem('pos-role','admin');
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/expenses']}><App/></MemoryRouter>);
    expect(screen.getByRole('heading',{name:'Expenses'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Add expense'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'New order'})).toHaveAttribute('href','/admin/order');
    expect(screen.getByRole('link',{name:'Expenses'})).toHaveAttribute('href','/admin/expenses');
  });

  it('denies unauthorized routes and mutations for kitchen and display',()=>{
    for(const role of ['kitchen','display']){
      cleanup();localStorage.setItem('pos-role',role);
      render(<MemoryRouter initialEntries={['/admin/order-types']}><App/></MemoryRouter>);
      expect(screen.getByRole('heading',{name:'Access unavailable'})).toBeInTheDocument();
      expect(screen.queryByRole('button',{name:'Add order type'})).not.toBeInTheDocument();
    }
  });
  it('never escalates role from a direct unauthorized URL',()=>{localStorage.setItem('pos-role','cashier');render(<MemoryRouter initialEntries={['/admin/order-types']}><App/></MemoryRouter>);expect(screen.getByRole('heading',{name:'Access unavailable'})).toBeInTheDocument();expect(screen.getByLabelText('Role')).toHaveValue('cashier');expect(localStorage.getItem('pos-role')).toBe('cashier')});
  it('omits Shift sales while keeping the other cashier metrics',()=>{
    render(<MemoryRouter initialEntries={['/cashier/dashboard']}><App/></MemoryRouter>);
    expect(screen.queryByText('Shift sales')).not.toBeInTheDocument();
    expect(screen.getByText('Orders served')).toBeInTheDocument();
    expect(screen.getByText('Cash in drawer')).toBeInTheDocument();
  });

  it('adds a product and exposes calculated checkout total',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    await u.click(screen.getByRole('button',{name:/Add to order/}));
    await u.selectOptions(screen.getByLabelText('Table(s)'),'T01');
    expect(screen.getByText(/35\.200/, {selector:'.grand b'})).toBeInTheDocument();
    await u.click(screen.getAllByRole('button',{name:'Review & pay'})[0]);
    expect(screen.getByRole('heading',{name:'Checkout'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Dynamic QRIS/})).toBeInTheDocument();
  });

  it('shows a clear unavailable state without an add affordance',()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const unavailable=screen.getByRole('button',{name:/Banana loaf Bakery Unavailable/i});
    expect(unavailable).toHaveAttribute('aria-disabled','true');
    expect(unavailable.querySelector('.product-plus')).not.toBeInTheDocument();
  });

  it('switches role and navigates to manager overview',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/dashboard']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Role'),'manager');
    expect(await screen.findByRole('heading',{name:'Service overview'})).toBeInTheDocument();
  });

  it('seeds configurable order types and validates trimmed case-insensitive names',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/order-types']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    expect(screen.getByText('Dine In')).toBeInTheDocument();
    expect(screen.getByText('Takeaway')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.queryByLabelText('Order type name')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button',{name:'Add order type'}));
    expect(screen.getByRole('dialog',{name:'Add order type'})).toBeInTheDocument();
    await u.type(screen.getByLabelText('Order type name'),'  takeaway  ');
    await u.click(within(screen.getByRole('dialog',{name:'Add order type'})).getByRole('button',{name:'Add order type'}));
    expect(screen.getByRole('alert')).toHaveTextContent('unique');
    await u.clear(screen.getByLabelText('Order type name'));
    await u.type(screen.getByLabelText('Order type name'),'  Curbside  ');
    await u.click(within(screen.getByRole('dialog',{name:'Add order type'})).getByRole('button',{name:'Add order type'}));
    expect(screen.getByText('Curbside')).toBeInTheDocument();
  });

  it('enables, disables, and archives order types while preserving referenced history',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/order-types']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    const dineIn=screen.getByText('Dine In').closest<HTMLElement>('.status-row')!;
    await u.click(within(dineIn).getByRole('button',{name:'Disable'}));
    expect(within(dineIn).getByText('Disabled')).toBeInTheDocument();
    await u.click(within(dineIn).getByRole('button',{name:'Enable'}));
    await u.click(within(dineIn).getByRole('button',{name:'Archive'}));
    expect(within(dineIn).getByText('Archived')).toBeInTheDocument();
    expect(within(dineIn).getByText(/Referenced by 1 order/)).toBeInTheDocument();
  });

  it('shows only available order types, falls back, and uses requiresTable for table UI',async()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({orderTypes:[
      {id:'custom',name:'At Counter',enabled:true,archived:false,requiresTable:true},
      {id:'off',name:'Disabled',enabled:false,archived:false,requiresTable:false}
    ]}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    expect(screen.getByRole('button',{name:'At Counter'})).toHaveAttribute('aria-pressed','true');
    expect(screen.queryByRole('button',{name:'Disabled'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Table(s)')).toHaveAttribute('multiple');
  });

  it('shows an empty state when no order types are enabled',()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({orderTypes:[{id:'off',name:'Old',enabled:false,archived:false,requiresTable:false}]}));
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    expect(screen.getByText('No order types available')).toBeInTheDocument();
    expect(screen.getAllByRole('button',{name:'Review & pay'}).every(x=>(x as HTMLButtonElement).disabled)).toBe(true);
  });

  it('renders legacy service strings on historical orders',()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({orders:[{id:'OLD-1',businessId:'harbor',createdAt:'2026-09-01T00:00:00Z',service:'Drive Through',status:'Completed',lines:[],subtotal:0,discount:0,tax:0,total:0}]}));
    render(<MemoryRouter initialEntries={['/orders']}><App/></MemoryRouter>);
    expect(screen.getByText(/Drive Through/)).toBeInTheDocument();
  });

  it('manages persisted tables and archives referenced active tables',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/tables']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    expect(screen.getByText('T04').closest<HTMLElement>('.status-row')).toHaveTextContent('Referenced by 1 active order');
    await u.click(screen.getByRole('button',{name:'Add table'}));
    await u.type(screen.getByLabelText('Table name'),' Patio 1 ');
    await u.type(screen.getByLabelText('Capacity'),'3');
    await u.click(within(screen.getByRole('dialog',{name:'Add table'})).getByRole('button',{name:'Add table'}));
    const patio=screen.getByText('Patio 1').closest<HTMLElement>('.status-row')!;
    expect(patio).toHaveTextContent('3 seats');
    await u.click(within(patio).getByRole('button',{name:'Edit'}));
    await u.clear(screen.getByLabelText('Edit table name'));
    await u.type(screen.getByLabelText('Edit table name'),'Patio A');
    await u.selectOptions(screen.getByLabelText('Edit table status'),'Reserved');
    await u.click(screen.getByRole('button',{name:'Save table'}));
    expect(screen.getByText('Patio A').closest<HTMLElement>('.status-row')).toHaveTextContent('Reserved');
    const referenced=screen.getByText('T04').closest<HTMLElement>('.status-row')!;
    await u.click(within(referenced).getByRole('button',{name:'Archive'}));
    expect(referenced).toHaveTextContent('Archived');
    expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).tables.find((t:{id:string})=>t.id==='T04').archived).toBe(true);
  });

  it('migrates table statuses and summarizes availability by capacity',()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({seatStatuses:{T01:'Occupied'}}));
    render(<MemoryRouter initialEntries={['/seats']}><App/></MemoryRouter>);
    expect(screen.getByText('2 seats: 1/4')).toBeInTheDocument();
    expect(screen.getByText('4 seats: 1/3')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/T01.*Occupied/})).toHaveTextContent('Occupied');
  });

  it('selects multiple available tables, retains selections, and persists table IDs',async()=>{
    render(<MemoryRouter initialEntries={['/cashier/order']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    const tables=screen.getByLabelText('Table(s)');await u.selectOptions(tables,['T01','T07']);
    expect(screen.getByRole('option',{name:/T01/})).toHaveProperty('selected',true);expect(screen.getByRole('option',{name:/T07/})).toHaveProperty('selected',true);expect(screen.getByRole('option',{name:/T02/})).toBeDisabled();
    await u.click(screen.getByRole('button',{name:/Cappuccino/i}));
    await u.click(screen.getByRole('button',{name:/Add to order/}));
    await u.click(screen.getAllByRole('button',{name:'Review & pay'})[0]);
    await u.click(screen.getByRole('button',{name:/Cash/}));
    const order=JSON.parse(localStorage.getItem('light-pos-demo-v1')!).orders[0];
    expect(order.tableIds).toEqual(['T01','T07']);
    expect(order.table).toBeUndefined();
  });

  it('migrates legacy expenses and reuses distinct historical categories',()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({expenses:[
      {id:'old',label:'Legacy ice',amount:100,date:'2026-09-01'},
      {id:'new',label:'Soap',category:'Supplies',amount:200,date:'2026-09-02',lines:[]},
      {id:'newer',label:'More soap',category:' supplies ',amount:300,date:'2026-09-03',lines:[]}
    ]}));
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
    const category=screen.getByLabelText('Category');
    expect(category).toHaveAttribute('list','expense-categories');
    const options=[...document.querySelectorAll<HTMLOptionElement>('#expense-categories option')];
    expect(options.map(x=>x.value)).toEqual(['Supplies']);
    expect(screen.getByText('Legacy ice').closest<HTMLElement>('.status-row')).toHaveTextContent('Uncategorized');
    const saved=JSON.parse(localStorage.getItem('light-pos-demo-v1')!);
    expect(saved.expenses[0]).toMatchObject({category:'Uncategorized',lines:[]});
  });

  it('records, validates, removes, sums, and persists one-level expense lines',async()=>{
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button',{name:'Add expense'}));
    expect(screen.getByRole('dialog',{name:'Add expense'})).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount (IDR)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 description')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Remove line 1'})).toBeDisabled();
    await u.type(screen.getByLabelText('Description'),'Market run');
    await u.type(screen.getByLabelText('Category'),'Supplies');
    await u.type(screen.getByLabelText('Date'),'2026-09-04');
    await u.type(screen.getByLabelText('Line 1 description'),'Ice');
    await u.type(screen.getByLabelText('Line 1 quantity'),'2');
    await u.type(screen.getByLabelText('Line 1 unit'),'bags');
    await u.type(screen.getByLabelText('Line 1 amount'),'12000');
    await u.click(screen.getByRole('button',{name:'Add line'}));
    await u.type(screen.getByLabelText('Line 2 description'),'Soap');
    await u.type(screen.getByLabelText('Line 2 amount'),'8000');
    expect(screen.getByText(/Line total:.*20\.000/)).toBeInTheDocument();
    await u.click(screen.getByRole('button',{name:'Remove line 2'}));
    expect(screen.queryByLabelText('Line 2 description')).not.toBeInTheDocument();
    await u.clear(screen.getByLabelText('Line 1 amount'));
    await u.type(screen.getByLabelText('Line 1 amount'),'-1');
    screen.getByLabelText('Line 1 amount').removeAttribute('min');
    await u.click(screen.getByRole('button',{name:'Record expense'}));
    expect(screen.getByRole('alert')).toHaveTextContent('positive amount');
    await u.clear(screen.getByLabelText('Line 1 amount'));
    await u.type(screen.getByLabelText('Line 1 amount'),'12000');
    await u.click(screen.getByRole('button',{name:'Record expense'}));
    const row=screen.getByText('Market run').closest<HTMLElement>('.status-row')!;
    expect(row).toHaveTextContent('2026-09-04 · Supplies');
    expect(row).toHaveTextContent(/Rp\s*12\.000/);
    expect(row).not.toHaveTextContent('Recorded');
    expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).expenses[0]).toMatchObject({category:'Supplies',amount:12000,lines:[{description:'Ice',quantity:2,unit:'bags',amount:12000}]});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not offer amount editing for line-backed or legacy expenses',()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({expenses:[{id:'x',label:'Market',category:'Ops',amount:12000,date:'2026-09-04',lines:[{id:'l',description:'Ice',amount:12000}]},{id:'legacy',label:'Legacy',amount:100,date:'2026-09-01'}]}));
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    expect(screen.queryByRole('button',{name:'Edit'})).not.toBeInTheDocument();
  });

  it('expands expense records to show their lines',async()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({expenses:[{id:'x',label:'Market',category:'Ops',amount:12000,date:'2026-09-04',lines:[{id:'l',description:'Ice',quantity:2,unit:'bags',amount:12000}]}]}));
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    expect(screen.queryByText('2 bags')).not.toBeInTheDocument();
    const disclosure=screen.getByRole('button',{name:/Expand Market/});
    expect(disclosure).toHaveAttribute('aria-expanded','false');expect(disclosure).toHaveAttribute('aria-controls','expense-details-x');
    await userEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded','true');expect(screen.getByRole('region',{name:'Market expense details'})).toHaveAttribute('id','expense-details-x');
    expect(screen.getByText('Ice')).toBeInTheDocument();
    expect(screen.getByText('2 bags')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:/Collapse Market/}));
    expect(screen.queryByText('2 bags')).not.toBeInTheDocument();
  });

  it('moves and traps dialog focus, closes with Escape, and restores the launcher',async()=>{
    localStorage.setItem('pos-role','cashier');const u=userEvent.setup();
    render(<MemoryRouter initialEntries={['/cashier/people']}><App/></MemoryRouter>);
    const launcher=screen.getByRole('button',{name:'Submit leave request'});launcher.focus();await u.click(launcher);
    const dialog=screen.getByRole('dialog',{name:'Submit leave request'}),close=screen.getByRole('button',{name:'Close dialog'}),submit=screen.getByRole('button',{name:'Submit request'});
    expect(close).toHaveFocus();submit.focus();await u.tab();expect(close).toHaveFocus();await u.tab({shift:true});expect(submit).toHaveFocus();
    await u.keyboard('{Escape}');expect(dialog).not.toBeInTheDocument();expect(launcher).toHaveFocus();
  });

  it('opens note creation in a dialog',async()=>{
    localStorage.setItem('pos-role','cashier');render(<MemoryRouter initialEntries={['/notes']}><App/></MemoryRouter>);
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Add note'}));
    expect(screen.getByRole('dialog',{name:'Add note'})).toBeInTheDocument();
  });

  it('filters expenses by inclusive dates and handles invalid and empty ranges',async()=>{
    localStorage.setItem('light-pos-demo-v1',JSON.stringify({expenses:[
      {id:'a',label:'Before',category:'Ops',amount:100,date:'2026-09-01',lines:[]},
      {id:'b',label:'From edge',category:'Ops',amount:200,date:'2026-09-02',lines:[]},
      {id:'c',label:'To edge',category:'Ops',amount:300,date:'2026-09-03',lines:[]}
    ]}));
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.type(screen.getByLabelText('From'),'2026-09-02');
    await u.type(screen.getByLabelText('To'),'2026-09-03');
    expect(screen.queryByText('Before')).not.toBeInTheDocument();
    expect(screen.getByText('From edge')).toBeInTheDocument();
    expect(screen.getByText('To edge')).toBeInTheDocument();
    expect(screen.getByText('2 records · Filtered')).toBeInTheDocument();
    expect(screen.getByText(/500/,{selector:'.big-stat strong'})).toBeInTheDocument();
    await u.clear(screen.getByLabelText('From'));
    await u.type(screen.getByLabelText('From'),'2026-09-04');
    expect(screen.getByRole('alert')).toHaveTextContent('From date must be on or before To date');
    expect(screen.getByText('0 records · Filtered')).toBeInTheDocument();
    await u.clear(screen.getByLabelText('To'));
    await u.type(screen.getByLabelText('To'),'2026-09-05');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('0 records · Filtered')).toBeInTheDocument();
    expect(screen.getByText('No expenses in this date range.')).toBeInTheDocument();
  });

  it('rejects invalid receipt images before upload',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch');
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
    fireEvent.change(screen.getByLabelText('Receipt image'),{target:{files:[new File(['text'],'receipt.txt',{type:'text/plain'})]}});
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG, or WebP');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resets expense drafts and receipt state on cancel and successful save',async()=>{
    const revoke=vi.spyOn(URL,'revokeObjectURL');localStorage.setItem('pos-role','manager');const u=userEvent.setup();render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    await u.click(screen.getByRole('button',{name:'Add expense'}));await u.type(screen.getByLabelText('Description'),'Discard me');await u.click(screen.getByRole('button',{name:'Add line'}));await u.upload(screen.getByLabelText('Receipt image'),new File(['x'],'receipt.png',{type:'image/png'}));
    await u.click(screen.getByRole('button',{name:'Cancel'}));expect(revoke).toHaveBeenCalledWith('blob:test');await u.click(screen.getByRole('button',{name:'Add expense'}));
    expect(screen.getByLabelText('Description')).toHaveValue('');expect(screen.getByLabelText('Receipt image')).toHaveValue('');expect(screen.queryByAltText('Selected receipt preview')).not.toBeInTheDocument();expect(screen.getAllByLabelText(/Line \d+ description/)).toHaveLength(1);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await u.type(screen.getByLabelText('Description'),'Saved');await u.type(screen.getByLabelText('Category'),'Ops');await u.type(screen.getByLabelText('Date'),'2026-09-07');await u.type(screen.getByLabelText('Line 1 description'),'Fare');await u.type(screen.getByLabelText('Line 1 amount'),'100');await u.click(screen.getByRole('button',{name:'Record expense'}));
    await u.click(screen.getByRole('button',{name:'Add expense'}));expect(screen.getByLabelText('Description')).toHaveValue('');expect(screen.getAllByLabelText(/Line \d+ description/)).toHaveLength(1);
  });

  it('ignores stale receipt results after close or a newer upload',async()=>{
    let resolveFirst!:(r:Response)=>void;let resolveThird!:(r:Response)=>void;const first=new Promise<Response>(resolve=>{resolveFirst=resolve}),third=new Promise<Response>(resolve=>{resolveThird=resolve});vi.spyOn(globalThis,'fetch').mockReturnValueOnce(first).mockResolvedValueOnce(new Response(JSON.stringify({merchant:'New',date:'2026-09-08',category:'Ops',lines:[]}))).mockReturnValueOnce(third);
    localStorage.setItem('pos-role','manager');const u=userEvent.setup();render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);await u.click(screen.getByRole('button',{name:'Add expense'}));
    await u.upload(screen.getByLabelText('Receipt image'),new File(['1'],'old.png',{type:'image/png'}));await u.upload(screen.getByLabelText('Receipt image'),new File(['2'],'new.png',{type:'image/png'}));expect(await screen.findByDisplayValue('New')).toBeInTheDocument();resolveFirst(new Response(JSON.stringify({merchant:'Old',date:'2026-09-01',category:'Old',lines:[]})));await waitFor(()=>expect(screen.getByLabelText('Description')).toHaveValue('New'));
    await u.upload(screen.getByLabelText('Receipt image'),new File(['3'],'close.png',{type:'image/png'}));await u.click(screen.getByRole('button',{name:'Cancel'}));resolveThird(new Response(JSON.stringify({merchant:'Closed',date:'2026-09-01',category:'Old',lines:[]})));await u.click(screen.getByRole('button',{name:'Add expense'}));await waitFor(()=>expect(screen.getByLabelText('Description')).toHaveValue(''));
  });

  it('shows malformed receipt errors and retries the same image',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({merchant:'Shop',lines:'bad'}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({merchant:'Shop',date:'2026-09-05',category:'Supplies',lines:[]}),{status:200}));
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    await userEvent.click(screen.getByRole('button',{name:'Add expense'}));
    await userEvent.upload(screen.getByLabelText('Receipt image'),new File(['image'],'receipt.png',{type:'image/png'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid receipt data');
    await userEvent.click(screen.getByRole('button',{name:'Retry receipt'}));
    expect(await screen.findByDisplayValue('Shop')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('recovers from a receipt network error and prefills editable fields without saving',async()=>{
    vi.spyOn(globalThis,'fetch')
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({merchant:'Harbor Market',date:'2026-09-06',category:'Supplies',lines:[{description:'Ice',quantity:2,unit:'bags',amount:12000}]}),{status:200}));
    localStorage.setItem('pos-role','manager');render(<MemoryRouter initialEntries={['/manager/expenses']}><App/></MemoryRouter>);
    await userEvent.click(screen.getByRole('button',{name:'Add expense'}));
    await userEvent.upload(screen.getByLabelText('Receipt image'),new File(['image'],'receipt.jpg',{type:'image/jpeg'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be parsed');
    await userEvent.click(screen.getByRole('button',{name:'Retry receipt'}));
    expect(await screen.findByDisplayValue('Harbor Market')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-09-06');
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('Ice');
    expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')||'{}').expenses).toBeUndefined();
    await userEvent.clear(screen.getByLabelText('Description'));
    await userEvent.type(screen.getByLabelText('Description'),'Edited market run');
    await userEvent.clear(screen.getByLabelText('Line 1 amount'));
    await userEvent.type(screen.getByLabelText('Line 1 amount'),'13000');
    await userEvent.click(screen.getByRole('button',{name:'Record expense'}));
    expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).expenses[0]).toMatchObject({label:'Edited market run',amount:13000,lines:[{description:'Ice',amount:13000}]});
    expect(localStorage.getItem('light-pos-demo-v1')).not.toContain('receipt.jpg');
  });

  it('uses one native-validating form for experiment editing and saves valid submission',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/experiments']}><App/></MemoryRouter>);const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:'New experiment'}));
    const name=screen.getByLabelText('Experiment name'),save=screen.getByRole('button',{name:'Save experiment'}),form=name.closest('form');
    expect(name).toBeRequired();expect(form).not.toBeNull();expect(save).toHaveAttribute('type','submit');expect(form).toContainElement(save);
    await u.click(save);expect(screen.getByRole('dialog')).toBeInTheDocument();expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')||'{}').experiments).toBeUndefined();
    await u.type(name,'Weekend test');fireEvent.submit(form!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(JSON.parse(localStorage.getItem('light-pos-demo-v1')!).experiments.at(-1).name).toBe('Weekend test');
  });

  it('creates a coupon with governed reason',async()=>{
    localStorage.setItem('pos-role','admin');render(<MemoryRouter initialEntries={['/admin/coupons']}><App/></MemoryRouter>);
    const u=userEvent.setup();
    await u.click(screen.getByRole('button',{name:'Add coupon'}));
    await u.type(screen.getByLabelText('Code'),'welcome');
    await u.type(screen.getByLabelText('Value'),'12');
    await u.selectOptions(screen.getByLabelText('Reason'),'Review incentive');
    await u.click(screen.getByRole('button',{name:'Create coupon'}));
    expect(screen.getByText('WELCOME')).toBeInTheDocument();
  });
});
