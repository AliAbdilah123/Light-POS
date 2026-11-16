/* eslint-disable react-refresh/only-export-components */
import {createContext,useContext,useEffect,useReducer,useRef,useState,type ReactNode} from 'react';
import {calculateTotals,cartReducer,menuForSession,type Capability,type CartAction,type CartLine,type Coupon,type DemoMode,type Expense,type Experiment,type InventoryItem,type InventoryMovement,type Leave,type MenuItem,type MenuScope,type Message,type Note,type Order,type OrderType,type Role,type ServiceMode,type Shift,type ShiftSession,type Sop,type Staff,type Table,type TableStatus} from './domain';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import {Input} from './components/ui/input';
import {Label} from './components/ui/label';
import {Alert,AlertDescription} from './components/ui/alert';


export type Data={orders:Order[];orderTypes:OrderType[];tables:Table[];menus:MenuItem[];experiments:Experiment[];coupons:Coupon[];notes:Note[];expenses:Expense[];leaves:Leave[];staff:Staff[];shifts:Shift[];shiftSessions:ShiftSession[];inventory:InventoryItem[];inventoryMovements:InventoryMovement[];sops:Sop[];sopHistory:string[];messages:Message[];messagesRead:string[];audit:string[];targets:Record<string,number>;planningNotes:Record<string,string>;schedules:Record<string,string>};
export type Session={id:string;username:string;name:string;role:Role;businessIds:string[];csrfToken:string;profileId?:string;capabilities?:Capability[];menuScope?:MenuScope};
export type Tenant={id:string;name:string;location:string;active:boolean};
interface Ctx {role:Role;user:Session;business:string;setBusiness:(s:string)=>void;tenants:Tenant[];reloadTenants:()=>Promise<void>;theme:'light'|'dark';toggleTheme:()=>void;demo:DemoMode;setDemo:(d:DemoMode)=>void;data:Data;sessionMenus:MenuItem[];update:(fn:(d:Data)=>Data,action?:string)=>void;whenSaved:()=>Promise<void>;cart:CartLine[];dispatch:(a:CartAction)=>void;service:ServiceMode;setService:(s:ServiceMode)=>void;tableIds:string[];setTableIds:(s:string[])=>void;coupon?:Coupon;setCoupon:(c?:Coupon)=>void;totals:ReturnType<typeof calculateTotals>;completeOrder:(payment:'Cash'|'QRIS',tendered?:number)=>Order;activeShift?:ShiftSession;setTableStatus:(ids:string[],status:TableStatus)=>void;clearCart:()=>void;logout:()=>Promise<void>;syncError:string;reload:()=>Promise<void>;writable:boolean}
const Context=createContext<Ctx|null>(null);
export const API=`${import.meta.env.BASE_URL}api`;
const api=async(path:string,options:RequestInit={})=>{const response=await fetch(`${API}${path}`,{credentials:'same-origin',...options});const body=await response.json().catch(()=>({error:'Invalid server response.'}));if(!response.ok)throw Object.assign(Error(body.error||'Request failed.'),{status:response.status,body});return body};

function Login({onLogin}:{onLogin:(user:Session)=>void}){const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[showPassword,setShowPassword]=useState(false);const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);try{const result=await api('/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:String(fd.get('username')),password:String(fd.get('password'))})});onLogin(result.user)}catch(reason){setError(reason instanceof Error?reason.message:'Login failed.')}finally{setBusy(false)}};return <main className="auth-page"><Card className="auth-card" aria-labelledby="login-title"><div className="auth-mark">L</div><p className="eyebrow">Light POS</p><h1 id="login-title">Sign in to your workspace</h1><p>Your role and business access come from your account.</p>{error&&<Alert variant="destructive" className="alert bad"><AlertDescription>{error}</AlertDescription></Alert>}<form onSubmit={submit}><Input label="Username" name="username" autoComplete="username" required/><div className="field"><Label htmlFor="password">Password</Label><div className="password-row"><input id="password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" required/><button type="button" className="link-button" aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div></div><Button variant="primary" type="submit" disabled={busy}>{busy?'Signing in...':'Sign in'}</Button></form><details className="demo-hint"><summary>Demo accounts</summary><p>Sign in with any seeded account and the development password.</p><ul><li><code>cashier.harbor</code> · cashier</li><li><code>manager.harbor</code> · manager</li><li><code>admin.harbor</code> · tenant admin</li><li><code>superadmin</code> · all businesses</li></ul><p className="muted">Password: <code>light-pos-demo</code></p></details></Card></main>}

export function StoreProvider({children}:{children:ReactNode}){
  const[session,setSession]=useState<Session|null>(null),[booting,setBooting]=useState(true),[data,setData]=useState<Data|null>(null),[syncError,setSyncError]=useState(''),[tenants,setTenants]=useState<Tenant[]>([]);
  const[business,setBusinessState]=useState('harbor'),[theme,setTheme]=useState<'light'|'dark'>(()=>(localStorage.getItem('pos-theme') as 'light'|'dark')||'light'),[demo,setDemo]=useState<DemoMode>('ready');
  const[cart,dispatch]=useReducer(cartReducer,[]),[service,setService]=useState<ServiceMode>('Dine In'),[tableIds,setTableIds]=useState<string[]>([]),[coupon,setCoupon]=useState<Coupon>();
  const revision=useRef(0),queue=useRef(Promise.resolve()),generation=useRef(0),sessionRef=useRef<Session|null>(null),businessRef=useRef(business);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('pos-theme',theme)},[theme]);
  const reloadTenants=async()=>{const result=await api('/tenants');setTenants(result.tenants)};
  const initialBusiness=(user:Session)=>{const stored=localStorage.getItem('pos-business')||'';const allowed=stored==='all'?user.role==='superadmin'&&user.businessIds.includes('*'):user.businessIds.includes(stored);if(stored&&allowed)return stored;return user.role==='superadmin'&&user.businessIds.includes('*')?'all':user.businessIds.find(id=>id!=='*')||'harbor'};
  useEffect(()=>{void api('/session').then(({user})=>{sessionRef.current=user;setSession(user);const first=initialBusiness(user);businessRef.current=first;setBusinessState(first);return Promise.all([loadState(user,first),reloadTenants()])}).catch(()=>setSession(null)).finally(()=>setBooting(false))},[]);
  const loggedIn=(user:Session)=>{sessionRef.current=user;setSession(user);const first=initialBusiness(user);businessRef.current=first;setBusinessState(first);setBooting(true);void Promise.all([loadState(user,first),reloadTenants()]).catch(e=>setSyncError(e.message)).finally(()=>setBooting(false))};
  const logout=async()=>{const user=sessionRef.current;if(user)await api('/session',{method:'DELETE',headers:{'x-csrf-token':user.csrfToken}}).catch(()=>undefined);sessionRef.current=null;setSession(null);setData(null);dispatch({type:'clear'})};
  const setBusiness=(target:string)=>{const user=sessionRef.current,global=user?.role==='superadmin'&&user.businessIds.includes('*');if(!user||target==='all'?!global:!global&&!user.businessIds.includes(target))return;businessRef.current=target;setBusinessState(target);localStorage.setItem('pos-business',target);void loadState(user,target).catch(e=>setSyncError(e.message))};
  const dataRef=useRef<Data|null>(null);
  const applyData=(next:Data)=>{dataRef.current=next;setData(next)};
  const loadState=async(user=sessionRef.current,target=businessRef.current)=>{if(!user)return;const result=await api(`/state?business=${encodeURIComponent(target)}`);revision.current=result.revision;applyData(result.data);setSyncError('')};
  const update=(fn:(d:Data)=>Data,action='Updated POS data')=>{
    const current=dataRef.current;
    if(!current)return;
    if(businessRef.current==='all'){setSyncError('Select one business before changing data.');return}
    const next=fn(structuredClone(current)),active=next.experiments.reduce((found,e,i)=>e.status==='active'?i:found,-1);
    if(active>=0)next.experiments=next.experiments.map((e,i)=>e.status==='active'&&i!==active?{...e,status:'draft'}:e);
    applyData(next);
    const snapshot=structuredClone(next),id=++generation.current;
    queue.current=queue.current.then(async()=>{
      const user=sessionRef.current;
      if(!user)return;
      try{
        const result=await api('/state',{method:'PUT',headers:{'content-type':'application/json','x-csrf-token':user.csrfToken},body:JSON.stringify({revision:revision.current,business:businessRef.current,data:snapshot,action})});
        revision.current=result.revision;
        if(id===generation.current)applyData(result.data);
        setSyncError('');
      }catch(reason){
        const error=reason as Error&{status?:number;body?:{revision?:number;data?:Data}};
        if(error.status===409&&error.body?.data){
          revision.current=error.body.revision||revision.current;
          applyData(error.body.data);
          setSyncError('Another user changed this data. The latest server version was restored.');
          return;
        }
        await loadState().catch(()=>undefined);
        setSyncError(error.message);
      }
    });
  };
  useEffect(()=>{if(!data)return;const available=data.orderTypes.filter(x=>x.enabled&&!x.archived);if(!available.some(x=>x.name===service))setService(available[0]?.name||'')},[data,service]);
  if(booting)return <main className="auth-page"><div className="skeleton-wrap" aria-label="Loading session"><div/><div/><div/></div></main>;
  if(!session)return <Login onLogin={loggedIn}/>;
  if(!data)return <main className="auth-page"><section className="auth-card"><h1>Workspace unavailable</h1><p>{syncError||'The POS data could not be loaded.'}</p><Button onClick={()=>void loadState(session,business)}>Try again</Button><Button onClick={()=>void logout()}>Sign out</Button></section></main>;
  const totals=calculateTotals(cart,coupon),clearCart=()=>{dispatch({type:'clear'});setCoupon(undefined);setTableIds([])};
  const activeShift=data.shiftSessions.find(x=>!x.closedAt&&x.cashierId===session.id)||data.shiftSessions.find(x=>!x.closedAt&&x.cashierName===session.name);
  const completeOrder=(payment:'Cash'|'QRIS',tendered?:number)=>{
    if(business==='all')throw Error('Select one business before taking payment.');
    const requiresTable=!!data.orderTypes.find(x=>x.name===service)?.requiresTable;
    if(requiresTable&&!tableIds.length)throw Error('At least one table is required.');
    if(payment==='Cash'&&tendered!==undefined){if(!Number.isFinite(tendered)||tendered<totals.total)throw Error('Cash received must cover the amount due.')}
    const tableIdsForOrder=requiresTable?tableIds:undefined;
    const order:Order={id:`S-${Date.now().toString(36).toUpperCase()}`,businessId:business,createdAt:new Date().toISOString(),service,tableIds:tableIdsForOrder,status:'Completed',lines:structuredClone(cart),...totals,coupon:coupon?.code,payment,cashierId:session.id,cashierName:session.name,...(activeShift?{shiftId:activeShift.id}:{}),...(payment==='Cash'&&tendered!==undefined?{tendered,change:Math.round(tendered-totals.total)}:{})};
    update(d=>({...d,orders:[order,...d.orders]}),`${payment} payment completed for ${order.id}`);
    return order
  };
  const setTableStatus=(ids:string[],status:TableStatus)=>{if(!ids.length)return;update(d=>({...d,tables:d.tables.map(t=>ids.includes(t.id)?{...t,status}:t)}),`Table ${ids.join(', ')} marked ${status.toLowerCase()}`)};
  const sessionMenus=menuForSession(data.menus,data.experiments);
  return <Context.Provider value={{role:session.role,user:session,business,setBusiness,tenants,reloadTenants,theme,toggleTheme:()=>setTheme(t=>t==='dark'?'light':'dark'),demo,setDemo,data,sessionMenus,update,whenSaved:()=>queue.current,cart,dispatch,service,setService,tableIds,setTableIds,coupon,setCoupon,totals,completeOrder,clearCart,activeShift,setTableStatus,logout,syncError,reload:()=>loadState(session,business),writable:business!=='all'}}>{syncError&&<div className="sync-banner" role="alert">{syncError} <button onClick={()=>void loadState(session,business)}>Reload</button></div>}{children}</Context.Provider>;
}
export const useStore=()=>{const context=useContext(Context);if(!context)throw Error('Store missing');return context};
