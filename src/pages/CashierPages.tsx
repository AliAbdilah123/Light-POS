import {useState} from 'react';import {Clock3,Mail} from 'lucide-react';import {useStore} from '../store';import {BUSINESS_TZ,idr,localDate,localDateTime,localDay,type Note} from '../domain';import {Badge} from '../components/ui/badge';
import {Button} from '../components/ui/button';
import {Card} from '../components/ui/card';
import {Input} from '../components/ui/input';
import {NativeSelect as Select} from '../components/ui/native-select';import {FormActions,Metric,Modal,PageHead,SectionTitle,StatusRow} from '../components/molecules';import {StateBoundary} from '../components/DemoState';
export function CashierDashboard(){
  const s=useStore();
  const[opening,setOpening]=useState('');
  const[counted,setCounted]=useState('');
  const[closing,setClosing]=useState(false);
  const[error,setError]=useState('');
  const today=localDay(new Date());
  const mine=s.data.orders.filter(o=>o.cashierId===s.user.id&&o.status==='Completed');
  const mineToday=mine.filter(o=>localDay(o.createdAt)===today);
  const shiftOrders=s.activeShift?s.data.orders.filter(o=>o.shiftId===s.activeShift!.id):[];
  const shiftCash=shiftOrders.filter(o=>o.status==='Completed'&&o.payment==='Cash');
  const expected=(s.activeShift?.openingCash||0)+shiftCash.reduce((sum,o)=>sum+o.total,0);
  const open=s.data.orders.filter(o=>!['Completed','Voided'].includes(o.status)).length;
  const todaysShifts=s.data.shifts.filter(sh=>sh.date===today);
  const shiftState=(sh:typeof todaysShifts[number])=>{const now=new Date().toLocaleTimeString('en-GB',{timeZone:BUSINESS_TZ,hour:'2-digit',minute:'2-digit'});return now<sh.start?'Upcoming':now>sh.end?'Completed':'Active'};
  const startShift=()=>{const amount=Number(opening);if(!Number.isFinite(amount)||amount<0){setError('Enter the counted opening cash.');return}s.update(d=>({...d,shiftSessions:[...d.shiftSessions,{id:crypto.randomUUID(),businessId:s.business,cashierId:s.user.id,cashierName:s.user.name,openedAt:new Date().toISOString(),openingCash:amount}],audit:[`Shift opened with ${idr(amount)} opening cash`,...d.audit]}),'Shift opened');setOpening('');setError('')};
  const closeShift=()=>{const amount=Number(counted);if(!Number.isFinite(amount)||amount<0){setError('Enter the counted closing cash.');return}if(!s.activeShift)return;s.update(d=>({...d,shiftSessions:d.shiftSessions.map(x=>x.id===s.activeShift!.id?{...x,closedAt:new Date().toISOString(),closingCash:amount,variance:Math.round(amount-expected)}:x),audit:[`Shift closed · counted ${idr(amount)} · variance ${idr(Math.round(amount-expected))}`,...d.audit]}),'Shift closed');setCounted('');setClosing(false);setError('')};
  return <><PageHead title={`Welcome, ${s.user.name}`} description="Your shift, service pulse, and team updates in one place."/><StateBoundary>
  <div className="metric-grid">
    <Metric label="Orders served by you" value={String(mineToday.length)} delta={`${mine.length} on record · ${open} open in business`}/>
    <Metric label="Shift cash collected" value={idr(shiftCash.reduce((sum,o)=>sum+o.total,0))} help={s.activeShift?`Expected drawer ${idr(expected)}`:'No open shift'}/>
    <Metric label="Scheduled shifts" value={String(todaysShifts.length)} delta="Today in this business"/>
  </div>
  <div className="split"><Card><SectionTitle title="Active & upcoming shifts" meta={`${todaysShifts.length} today`}/>{todaysShifts.length?todaysShifts.map(sh=><StatusRow key={sh.id} title={`${sh.start}–${sh.end}`} meta={`${sh.location} · ${sh.staff}`} status={shiftState(sh)}/>):<p className="muted">No shifts scheduled for today.</p>}</Card>
  <Card><SectionTitle title="Manager messages" meta={`${s.data.messages.filter(m=>!s.data.messagesRead.includes(m.id)).length} unread`}/>{s.data.messages.map(m=><button className={`message ${s.data.messagesRead.includes(m.id)?'read':''}`} key={m.id} onClick={()=>s.update(d=>({...d,messagesRead:[...new Set([...d.messagesRead,m.id])]}))}><Mail/><div><strong>{m.from}</strong><p>{m.text}</p><small>{m.time}</small></div></button>)}</Card></div>
  <Card><SectionTitle title="Cash drawer" meta={s.activeShift?`Opened ${localDateTime(s.activeShift.openedAt)}`:'No open shift'}/>
    {error&&<p className="alert bad" role="alert">{error}</p>}
    {s.activeShift?<>
      <div className="metric-grid shift-metrics">
        <Metric label="Opening cash" value={idr(s.activeShift.openingCash)}/>
        <Metric label="Cash sales" value={idr(shiftCash.reduce((sum,o)=>sum+o.total,0))} delta={`${shiftCash.length} cash orders in this shift`}/>
        <Metric label="Expected in drawer" value={idr(expected)}/>
      </div>
      {!closing?<div className="form-actions"><Button variant="primary" onClick={()=>setClosing(true)}>Close shift</Button></div>:<form onSubmit={e=>{e.preventDefault();closeShift()}}><Input label="Counted closing cash" type="number" min="0" inputMode="numeric" value={counted} onChange={e=>{setCounted(e.target.value);setError('')}}/><div className="formula"><span>Variance</span><strong>{idr(Math.round(Number(counted||0)-expected))}</strong></div><div className="form-actions"><Button type="button" onClick={()=>setClosing(false)}>Keep shift open</Button><Button variant="primary" type="submit">Confirm close</Button></div></form>}
    </>:<form onSubmit={e=>{e.preventDefault();startShift()}}><p className="muted">Open a shift before service so cash sales reconcile to a drawer. Your name is recorded on every order you take.</p><Input label="Opening cash counted" type="number" min="0" inputMode="numeric" value={opening} onChange={e=>{setOpening(e.target.value);setError('')}}/><Button variant="primary" type="submit">Open shift</Button></form>}
  </Card>
  </StateBoundary></>;
}

export function NotesPage(){
  const s=useStore();
  const[text,setText]=useState('');const[draft,setDraft]=useState('');const[open,setOpen]=useState(false);const[editing,setEditing]=useState<Note>();const[deleting,setDeleting]=useState<Note>();
  const add=(e:React.FormEvent)=>{e.preventDefault();if(!text.trim())return;s.update(d=>({...d,notes:[{id:crypto.randomUUID(),text:text.trim(),date:new Date().toISOString().slice(0,10)},...d.notes]}));setText('');setOpen(false)};
  const saveEdit=()=>{if(!editing||!draft.trim())return;s.update(d=>({...d,notes:d.notes.map(x=>x.id===editing.id?{...x,text:draft.trim()}:x)}));setEditing(undefined);setDraft('')};
  return <><PageHead title="Day notes" description="Shared operational handoff notes for the selected business." action={<Button variant="primary" disabled={!s.writable} onClick={()=>setOpen(true)}>Add note</Button>}/><StateBoundary>
  {!s.writable&&<p className="alert" role="status">Select one business to add or edit its notes.</p>}
  {open&&<Modal title="Add note" onClose={()=>setOpen(false)}><form onSubmit={add}><Input label="Note" value={text} onChange={e=>setText(e.target.value)} placeholder="What should the next shift know?"/><FormActions onCancel={()=>setOpen(false)} submit="Add note"/></form></Modal>}
  {editing&&<Modal title="Edit note" onClose={()=>{setEditing(undefined);setDraft('')}}><form onSubmit={e=>{e.preventDefault();saveEdit()}}><label className="field"><span>Note</span><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={4}/></label><FormActions onCancel={()=>{setEditing(undefined);setDraft('')}} submit="Save note"/></form></Modal>}
  {deleting&&<Modal title="Delete this note?" onClose={()=>setDeleting(undefined)}><p>“{deleting.text}” will be removed for everyone in this business.</p><div className="form-actions"><Button onClick={()=>setDeleting(undefined)}>Cancel</Button><Button variant="danger" onClick={()=>{s.update(d=>({...d,notes:d.notes.filter(x=>x.id!==deleting.id)}));setDeleting(undefined)}}>Delete note</Button></div></Modal>}
  <div className="note-grid">{s.data.notes.map(n=><Card key={n.id}><Badge tone="info">{localDate(n.date)}</Badge><p>{n.text}</p><div className="card-actions"><Button onClick={()=>{setEditing(n);setDraft(n.text)}}>Edit</Button><Button variant="danger" onClick={()=>setDeleting(n)}>Delete</Button></div></Card>)}</div></StateBoundary></>;
}

export function CashierPeople(){const s=useStore();const[error,setError]=useState('');const[open,setOpen]=useState(false);const[withdrawing,setWithdrawing]=useState<string>();const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const fd=new FormData(e.currentTarget);const from=String(fd.get('from')),to=String(fd.get('to')),reason=String(fd.get('reason'));if(!from||!to||!reason.trim()){setError('Complete all required fields.');return}if(to<from){setError('End date must be on or after start date.');return}s.update(d=>({...d,leaves:[{id:crypto.randomUUID(),type:String(fd.get('type')),from,to,reason,status:'Pending'},...d.leaves]}));e.currentTarget.reset();setError('');setOpen(false)};return <><PageHead title="Shift & requests" description="Review hours and submit time-away requests." action={<Button variant="primary" onClick={()=>setOpen(true)}>Submit leave request</Button>}/>{open&&<Modal title="Submit leave request" onClose={()=>setOpen(false)}>{error&&<div className="alert bad" role="alert">{error}</div>}<form onSubmit={submit}><Select label="Leave type" name="type"><option>Annual leave</option><option>Sick leave</option><option>Personal</option></Select><div className="form-grid"><Input label="From" name="from" type="date" required/><Input label="To" name="to" type="date" required/></div><Input label="Reason" name="reason" required/><FormActions onCancel={()=>setOpen(false)} submit="Submit request"/></form></Modal>}<div className="split"><Card><SectionTitle title="Work summary" meta="Your scheduled shifts"/>{(()=>{const mine=s.data.shifts.filter(sh=>sh.staff===s.user.name);const minutes=(v:string)=>{const[h,m]=v.split(':').map(Number);return (h||0)*60+(m||0)};const total=mine.reduce((sum,sh)=>sum+Math.max(0,minutes(sh.end)-minutes(sh.start)),0)/60;const today=new Date().toISOString().slice(0,10);return <><div className="big-stat"><Clock3/><strong>{total.toFixed(1)}h</strong><span>{mine.length} scheduled {mine.length===1?'shift':'shifts'}</span></div>{mine.length?mine.slice(0,3).map(sh=><StatusRow key={sh.id} title={sh.date===today?'Today':localDate(sh.date)} meta={`${sh.start}–${sh.end} · ${sh.location}`} status={sh.date===today?'Active':'Completed'}/>):<p className="muted">No shifts assigned to you yet.</p>}</>})()}</Card></div><Card><SectionTitle title="Request history"/>{s.data.leaves.length?s.data.leaves.map(l=><StatusRow key={l.id} title={`${l.type} · ${localDate(l.from)}`} meta={`${localDate(l.from)} – ${localDate(l.to)} · ${l.reason}`} status={l.status} action={l.status==='Pending'?<Button variant="danger" onClick={()=>setWithdrawing(l.id)}>Withdraw</Button>:undefined}/>):<p className="muted">No leave requests yet. New requests appear here with their approval status.</p>}</Card>
{withdrawing&&<Modal title="Withdraw this request?" onClose={()=>setWithdrawing(undefined)}><p>The request will be removed and will not appear in your history.</p><div className="form-actions"><Button onClick={()=>setWithdrawing(undefined)}>Keep request</Button><Button variant="danger" onClick={()=>{s.update(d=>({...d,leaves:d.leaves.filter(x=>x.id!==withdrawing)}));setWithdrawing(undefined)}}>Withdraw</Button></div></Modal>}
</>}

export function LeaveApprovals(){
  const s=useStore();
  const pending=s.data.leaves.filter(l=>l.status==='Pending');
  const decided=s.data.leaves.filter(l=>l.status!=='Pending');
  const decide=(id:string,status:'Approved'|'Declined')=>s.update(d=>({...d,leaves:d.leaves.map(l=>l.id===id?{...l,status}:l)}),`Leave request ${status.toLowerCase()}`);
  return <><PageHead title="Leave approvals" description="Review time-away requests for this business and record a decision."/>
    {!s.writable&&<p className="alert" role="status">Select one business to review its leave requests.</p>}
    <div className="split">
      <Card><SectionTitle title="Awaiting decision" meta={`${pending.length} pending`}/>
        {pending.length?pending.map(l=><StatusRow key={l.id} title={`${l.type} · ${localDate(l.from)}`} meta={`${localDate(l.from)} – ${localDate(l.to)} · ${l.reason}`} status="Pending"
          action={<div className="row-actions"><Button disabled={!s.writable} onClick={()=>decide(l.id,'Approved')}>Approve</Button><Button disabled={!s.writable} variant="danger" onClick={()=>decide(l.id,'Declined')}>Decline</Button></div>}/>):<p className="muted">Nothing waiting. Submitted requests appear here.</p>}
      </Card>
      <Card><SectionTitle title="Decided" meta={`${decided.length} recorded`}/>
        {decided.length?decided.map(l=><StatusRow key={l.id} title={`${l.type} · ${localDate(l.from)}`} meta={`${localDate(l.from)} – ${localDate(l.to)} · ${l.reason}`} status={l.status}/>):<p className="muted">No decisions recorded yet.</p>}
      </Card>
    </div></>;
}
