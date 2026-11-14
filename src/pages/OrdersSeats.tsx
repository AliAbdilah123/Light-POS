import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Search} from 'lucide-react';
import {idr,localDateTime,nextStatus,type Order} from '../domain';
import {useStore} from '../store';
import {Badge} from '../components/ui/badge';
import {Button} from '../components/ui/button';
import {Card} from '../components/ui/card';
import {Input} from '../components/ui/input';
import {NativeSelect as Select} from '../components/ui/native-select';
import {Modal,PageHead,SectionTitle} from '../components/molecules';
import {StateBoundary} from '../components/DemoState';

export function OrdersPage(){
  const s=useStore();
  const[q,setQ]=useState('');
  const[status,setStatus]=useState('All');
  const[selected,setSelected]=useState<string>();
  const[voiding,setVoiding]=useState(false);
  const[paying,setPaying]=useState(false);
  const[method,setMethod]=useState<'Cash'|'QRIS'>('Cash');
  const[tendered,setTendered]=useState('');
  const[error,setError]=useState('');
  const order=s.data.orders.find(o=>o.id===selected);
  const rows=useMemo(()=>s.data.orders.filter(o=>(s.business==='all'||o.businessId===s.business)&&(status==='All'||o.status===status)&&(o.id.toLowerCase().includes(q.toLowerCase())||o.lines.some(l=>l.name.toLowerCase().includes(q.toLowerCase())))),[s.data.orders,s.business,status,q]);
  const close=()=>{setSelected(undefined);setVoiding(false);setPaying(false);setTendered('');setError('')};
  const release=(tables:(string[]|undefined))=>tables?.length?s.data.tables.filter(t=>tables.includes(t.id)).map(t=>t.id):[];
  const advance=(target:Order)=>{const released=target.status==='Ready'?release(target.tableIds):[];s.update(d=>({...d,orders:d.orders.map(o=>o.id===target.id?{...o,status:nextStatus(o.status)}:o),...(released.length?{tables:d.tables.map(t=>released.includes(t.id)?{...t,status:'Available' as const}:t)}:{}),audit:[`Order ${target.id} advanced to ${nextStatus(target.status)}`,...d.audit]}))};
  const completePayment=()=>{if(!order)return;const cash=Number(tendered||0);if(method==='Cash'&&cash<order.total){setError('Cash received must cover the amount due.');return}const released=release(order.tableIds);const change=method==='QRIS'?undefined:Math.round(cash-order.total);s.update(d=>({...d,orders:d.orders.map(o=>o.id===order.id?{...o,status:'Completed',payment:method,...(change===undefined?{}:{tendered:cash,change}),cashierId:o.cashierId||s.user.id,cashierName:o.cashierName||s.user.name}:o),...(released.length?{tables:d.tables.map(t=>released.includes(t.id)?{...t,status:'Available' as const}:t)}:{}),audit:[`Order ${order.id} paid ${method}`,...d.audit]}));close()};
  return <>
    <PageHead title="Orders" description="Search every order, inspect its ledger, and progress fulfilment status."/>
    <div className="toolbar"><label className="search-box"><Search/><input aria-label="Search orders" value={q} onChange={e=>setQ(e.target.value)} placeholder="Order ID or item"/></label><Select label="Status" value={status} onChange={e=>setStatus(e.target.value)}><option>All</option>{['Held','Preparing','Ready','Completed','Voided'].map(x=><option key={x}>{x}</option>)}</Select></div>
    <StateBoundary><Card><div className="table-list"><div className="table-head"><span>Order</span><span>Service</span><span>Status</span><span>Total</span><span>Action</span></div>{rows.map(o=>{const tableLabel=(o.tableIds?.map(id=>s.data.tables.find(t=>t.id===id)?.name||id).join(', '))||o.table;return <button className={`table-row ${o.status==='Voided'?'voided':''}`} key={o.id} onClick={()=>setSelected(o.id)}><span><strong>{o.id}</strong><small>{localDateTime(o.createdAt)} · {o.lines.reduce((n,l)=>n+l.qty,0)} {o.lines.reduce((n,l)=>n+l.qty,0)===1?'item':'items'}</small></span><span>{o.service}{tableLabel&&` · ${tableLabel}`}</span><Badge tone={o.status==='Completed'?'good':o.status==='Ready'?'info':o.status==='Voided'?'bad':'warn'}>{o.status}</Badge><span><b>{idr(o.total)}</b><small>{o.payment??'Unpaid'}</small></span><span>View →</span></button>})}</div></Card></StateBoundary>
    {order&&<Modal title={`Order ${order.id}`} onClose={close}>
      <div className="order-detail"><div className="detail-meta"><Badge tone="info">{order.status}</Badge><span>{order.service}{order.tableIds?.length?` · ${order.tableIds.map(id=>s.data.tables.find(t=>t.id===id)?.name||id).join(', ')}`:order.table?` · ${order.table}`:''}</span><span>{localDateTime(order.createdAt)}</span></div>
      {order.lines.map(l=><div className="receipt-line" key={l.id}><span>{l.qty} × {l.name}{l.variations?.length?<small>{l.variations.map(v=>v.optionName).join(' · ')}</small>:l.modifier&&<small>{l.modifier}</small>}{l.note&&<small>{l.note}</small>}</span><b>{idr(l.price*l.qty)}</b></div>)}
      <div className="receipt-line"><span>Tax</span><b>{idr(order.tax)}</b></div>{order.discount>0&&<div className="receipt-line"><span>Discount · {order.coupon}</span><b>−{idr(order.discount)}</b></div>}
      <div className="receipt-line grand"><span>Total</span><b>{idr(order.total)}</b></div>
      {order.payment&&<div className="receipt-line"><span>{order.payment}</span><b>{idr(order.tendered??order.total)}</b></div>}
      {order.change?<div className="receipt-line"><span>Change</span><b>{idr(order.change)}</b></div>:null}
      {order.cashierName&&<p className="muted" style={{marginTop:8}}>Taken by {order.cashierName}</p>}

      {['Held','Preparing'].includes(order.status)&&<Button variant="primary" onClick={()=>advance(order)}>Mark {nextStatus(order.status)}</Button>}
      {order.status==='Ready'&&!paying&&<Button variant="primary" onClick={()=>{setPaying(true);setMethod('Cash');setTendered(String(order.total))}}>Take payment · {idr(order.total)}</Button>}
      {order.status==='Ready'&&paying&&<form className="payment-capture" onSubmit={e=>{e.preventDefault();completePayment()}}>
        {error&&<p className="alert bad" role="alert">{error}</p>}
        <div className="segment" role="group" aria-label="Payment method">
          <button type="button" aria-pressed={method==='Cash'} onClick={()=>setMethod('Cash')}>Cash</button>
          <button type="button" aria-pressed={method==='QRIS'} onClick={()=>setMethod('QRIS')}>QRIS</button>
        </div>
        {method!=='QRIS'&&<Input label="Cash received" type="number" min="0" inputMode="numeric" value={tendered} onChange={e=>{setTendered(e.target.value);setError('')}}/>}
        {method!=='QRIS'&&<div className="formula"><span>Change due</span><strong>{idr(Math.max(0,Number(tendered||0)-order.total))}</strong></div>}
        <div className="form-actions"><Button type="button" onClick={()=>setPaying(false)}>Cancel</Button><Button variant="primary" type="submit">Record payment</Button></div>
      </form>}
      {s.role!=='cashier'&&order.status!=='Voided'&&!voiding&&<Button variant="danger" onClick={()=>setVoiding(true)}>Void transaction</Button>}
      {voiding&&<form onSubmit={e=>{e.preventDefault();const reason=String(new FormData(e.currentTarget).get('reason'));if(!reason.trim()){setError('A void reason is required.');return}const released=release(order.tableIds);s.update(d=>({...d,orders:d.orders.map(o=>o.id===order.id?{...o,status:'Voided',voidReason:reason}:o),...(released.length?{tables:d.tables.map(t=>released.includes(t.id)?{...t,status:'Available' as const}:t)}:{}),audit:[`VOID ${order.id} · ${reason} · ${s.role} · ${new Date().toISOString()}`,...d.audit]}));close()}}>
        {error&&<p className="alert bad" role="alert">{error}</p>}
        <label className="field"><span>Void reason (required)</span><textarea name="reason" required/></label>
        <div className="form-actions"><Button type="button" onClick={()=>setVoiding(false)}>Cancel</Button><Button variant="danger" type="submit">Confirm void</Button></div>
      </form>}
      </div>
    </Modal>}
  </>;
}

export function SeatsPage(){
  const s=useStore();
  const[selected,setSelected]=useState(s.data.tables.find(t=>!t.archived)?.id||'');
  const current=s.data.tables.find(t=>t.id===selected);
  const tables=s.data.tables.filter(t=>!t.archived);
  const summary=[...new Set(tables.map(t=>t.capacity))].sort((a,b)=>a-b);
  const linked=current?s.data.orders.find(o=>!['Completed','Voided'].includes(o.status)&&(o.tableIds?.includes(current.id)||o.table===current.name)):undefined;
  return <>
    <PageHead title="Table availability" description="Statuses use words and symbols as well as color; tap a table to update it." action={['admin','superadmin'].includes(s.role)?<Link className="button primary" to="/admin/tables">Manage seats</Link>:undefined}/>
    <div className="seat-layout">
      <Card className="floor"><SectionTitle title="Main room"/><div className="legend">{summary.map(cap=><span key={cap}>{cap} seats: {tables.filter(t=>t.capacity===cap&&t.enabled&&t.status==='Available').length}/{tables.filter(t=>t.capacity===cap).length} available</span>)}</div>
        <div className="floor-grid">{tables.map(t=><button key={t.id} className={`table-seat ${t.status.toLowerCase().replaceAll(' ','-')}`} aria-pressed={selected===t.id} onClick={()=>setSelected(t.id)}><strong>{t.name}</strong><span>{t.capacity} seats</span><Badge>{t.status}</Badge></button>)}</div>
        <div className="legend">{['Available','Occupied','Reserved','Needs attention','Unavailable'].map(x=><span key={x}>● {x}</span>)}</div>
      </Card>
      {current&&<Card><SectionTitle title={current.name} meta={`${current.capacity} seats`}/><Badge tone="info">{current.status}</Badge>
        {linked?<div className="linked-order"><p><strong>Order {linked.id}</strong> · {linked.lines.reduce((n,l)=>n+l.qty,0)} lines · {idr(linked.total)}</p><Link className="button" to="/orders">Open in orders</Link></div>:<p>No active order on this table.</p>}
        {current.status!=='Unavailable'&&<Link className="button primary" to={`/cashier/order?table=${encodeURIComponent(current.id)}`}>Start order for {current.name}</Link>}
        <Select label="Change status" value={current.status} disabled={!!linked} onChange={e=>s.setTableStatus([current.id],e.target.value as typeof current.status)}>{['Available','Occupied','Reserved','Needs attention','Unavailable'].map(x=><option key={x}>{x}</option>)}</Select>
        {linked&&<small className="muted">Status follows the open order. Complete or void {linked.id} to change it.</small>}
      </Card>}
    </div>
  </>;
}
