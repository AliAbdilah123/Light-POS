/* eslint-disable react-refresh/only-export-components */
import {createContext,useContext,useEffect,useReducer,useRef,useState,type ReactNode} from 'react';
import {calculateTotals,cartReducer,menuForSession,roleForSession,type Capability,type CartAction,type CartLine,type Coupon,type Expense,type Experiment,type InventoryItem,type InventoryMovement,type Leave,type MenuItem,type MenuScope,type Message,type Note,type Order,type OrderType,type Role,type ServiceMode,type Shift,type ShiftSession,type Sop,type Staff,type Table,type TableStatus} from './domain';
import {Eye,EyeOff} from 'lucide-react';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import {Input} from './components/ui/input';
import {Label} from './components/ui/label';
import {Alert,AlertDescription} from './components/ui/alert';
import {useNavigate} from 'react-router-dom';
import {cacheSession,cacheSnapshot,compactOperation,createOperation,getCachedSession,getOperations,getSnapshot,persistLatest,purgeUser,removeOperation,type Operation} from './offline';


export type Data={orders:Order[];orderTypes:OrderType[];tables:Table[];menus:MenuItem[];experiments:Experiment[];coupons:Coupon[];notes:Note[];expenses:Expense[];leaves:Leave[];staff:Staff[];shifts:Shift[];shiftSessions:ShiftSession[];inventory:InventoryItem[];inventoryMovements:InventoryMovement[];sops:Sop[];sopHistory:string[];messages:Message[];messagesRead:string[];audit:string[];targets:Record<string,number>;planningNotes:Record<string,string>;schedules:Record<string,string>};
export type Session={id:string;username:string;name:string;role:Role;businessIds:string[];csrfToken:string;profileId?:string;capabilities?:Capability[];menuScope?:MenuScope};
export type Tenant={id:string;name:string;location:string;active:boolean};
interface Ctx {role:Role;user:Session;business:string;setBusiness:(s:string)=>void;tenants:Tenant[];reloadTenants:()=>Promise<Tenant[]>;theme:'light'|'dark';toggleTheme:()=>void;data:Data;sessionMenus:MenuItem[];update:(fn:(d:Data)=>Data,action?:string)=>void;whenSaved:()=>Promise<void>;cart:CartLine[];dispatch:(a:CartAction)=>void;service:ServiceMode;setService:(s:ServiceMode)=>void;tableIds:string[];setTableIds:(s:string[])=>void;coupon?:Coupon;setCoupon:(c?:Coupon)=>void;totals:ReturnType<typeof calculateTotals>;completeOrder:(payment:'Cash'|'QRIS',tendered?:number)=>Order;activeShift?:ShiftSession;setTableStatus:(ids:string[],status:TableStatus)=>void;clearCart:()=>void;logout:()=>Promise<void>;syncError:string;reload:()=>Promise<void>;writable:boolean;online:boolean;pendingCount:number;syncing:boolean;conflicts:Operation<Data>[];sync:()=>Promise<void>;keepServer:()=>Promise<void>}
const Context=createContext<Ctx|null>(null);
export const API=`${import.meta.env.BASE_URL}api`;
const api=async(path:string,options:RequestInit={})=>{const response=await fetch(`${API}${path}`,{credentials:'same-origin',...options});const body=await response.json().catch(()=>({error:'Invalid server response.'}));if(!response.ok)throw Object.assign(Error(body.error||'Request failed.'),{status:response.status,body});return body};

function Login({onLogin}:{onLogin:(user:Session)=>void}){const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[showPassword,setShowPassword]=useState(false);const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);try{const result=await api('/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:String(fd.get('username')),password:String(fd.get('password'))})});onLogin(result.user)}catch(reason){setError(reason instanceof Error?reason.message:'Login failed.')}finally{setBusy(false)}};return <main className="auth-page"><Card className="auth-card" aria-labelledby="login-title"><div className="auth-mark">L</div><p className="eyebrow">Light POS</p><h1 id="login-title">Sign in to your workspace</h1><p>Your role and business access come from your account.</p>{error&&<Alert variant="destructive" className="alert bad"><AlertDescription>{error}</AlertDescription></Alert>}<form onSubmit={submit}><Input label="Username" name="username" autoComplete="username" required/><div className="field"><Label htmlFor="password">Password</Label><div className="password-field"><input id="password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" required/><button type="button" className="password-toggle" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff aria-hidden="true"/>:<Eye aria-hidden="true"/>}</button></div></div><Button variant="primary" type="submit" disabled={busy}>{busy?'Signing in...':'Sign in'}</Button></form></Card></main>}

export function StoreProvider({children}:{children:ReactNode}){
  const navigate=useNavigate();
  const[session,setSession]=useState<Session|null>(null),[booting,setBooting]=useState(true),[data,setData]=useState<Data|null>(null),[syncError,setSyncError]=useState(''),[tenants,setTenants]=useState<Tenant[]>([]),[online,setOnline]=useState(navigator.onLine),[pendingCount,setPendingCount]=useState(0),[syncing,setSyncing]=useState(false),[conflicts,setConflicts]=useState<Operation<Data>[]>([]);
  const[business,setBusinessState]=useState('harbor'),[theme,setTheme]=useState<'light'|'dark'>(()=>(localStorage.getItem('pos-theme') as 'light'|'dark')||'light');
  const[cart,dispatch]=useReducer(cartReducer,[]),[service,setService]=useState<ServiceMode>('Dine In'),[tableIds,setTableIds]=useState<string[]>([]),[coupon,setCoupon]=useState<Coupon>();
  const revision=useRef(0),queue=useRef(Promise.resolve()),generation=useRef(0),loadGeneration=useRef(0),sessionRef=useRef<Session|null>(null),businessRef=useRef(business);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('pos-theme',theme)},[theme]);
  const reloadTenants=async()=>{const result=await api('/tenants');setTenants(result.tenants);return result.tenants as Tenant[]};
  const initialBusiness=(user:Session)=>{const stored=localStorage.getItem('pos-business')||'';const allowed=stored==='all'?user.role==='superadmin'&&user.businessIds.includes('*'):user.businessIds.includes(stored);if(stored&&allowed)return stored;return user.role==='superadmin'&&user.businessIds.includes('*')?'all':user.businessIds.find(id=>id!=='*')||'harbor'};
  useEffect(()=>{void api('/session').then(async({user})=>{setOnline(true);sessionRef.current=user;setSession(user);const first=initialBusiness(user);businessRef.current=first;setBusinessState(first);const[,loadedTenants]=await Promise.all([loadState(user,first),reloadTenants()]);await cacheSession({user,tenants:loadedTenants,business:first}).catch(()=>undefined)}).catch(async(error:Error&{status?:number})=>{if(error.status)return setSession(null);setOnline(false);const cached=await getCachedSession<Session,Tenant>().catch(()=>undefined);if(!cached)return setSession(null);sessionRef.current=cached.user;businessRef.current=cached.business;setSession(cached.user);setTenants(cached.tenants);setBusinessState(cached.business);const snapshot=await getSnapshot<Data>(cached.user.id,cached.business).catch(()=>undefined);if(snapshot){revision.current=snapshot.revision;applyData(snapshot.data);setPendingCount((await getOperations<Data>(cached.user.id,cached.business)).length)}}).finally(()=>setBooting(false))},[]);
  const loggedIn=(user:Session)=>{sessionRef.current=user;setSession(user);const first=initialBusiness(user);businessRef.current=first;setBusinessState(first);setBooting(true);void Promise.all([loadState(user,first),reloadTenants()]).then(([,loadedTenants])=>cacheSession({user,tenants:loadedTenants,business:first})).catch(e=>setSyncError(e.message)).finally(()=>setBooting(false))};
  const logout=async()=>{const user=sessionRef.current;if(user){await api('/session',{method:'DELETE',headers:{'x-csrf-token':user.csrfToken}}).catch(()=>undefined);await purgeUser(user.id).catch(()=>undefined)}sessionRef.current=null;setSession(null);setData(null);dispatch({type:'clear'});navigate('/',{replace:true})};
  const setBusiness=(target:string)=>{const user=sessionRef.current,global=user?.role==='superadmin'&&user.businessIds.includes('*');if(!user||target==='all'?!global:!global&&!user.businessIds.includes(target))return;businessRef.current=target;setBusinessState(target);setConflicts([]);localStorage.setItem('pos-business',target);void loadState(user,target).catch(e=>setSyncError(e.message))};
  const dataRef=useRef<Data|null>(null);
  const applyData=(next:Data)=>{dataRef.current=next;setData(next)};
  const loadState=async(user=sessionRef.current,target=businessRef.current)=>{if(!user)return;const request=++loadGeneration.current,result=await api(`/state?business=${encodeURIComponent(target)}`),pending=await getOperations<Data>(user.id,target).catch(()=>[]);if(request!==loadGeneration.current||sessionRef.current?.id!==user.id||businessRef.current!==target)return;setOnline(true);revision.current=result.revision;setPendingCount(pending.length);applyData(pending.at(-1)?.data??result.data);if(!pending.length)await cacheSnapshot({userId:user.id,business:target,revision:result.revision,data:result.data}).catch(()=>undefined);setSyncError('')};
  const sync=async()=>{const user=sessionRef.current,target=businessRef.current;if(!user||syncing)return;setSyncing(true);try{const owner=(await api('/session')).user as Session;if(owner.id!==user.id)throw Object.assign(Error('Session owner changed.'),{status:403});for(const operation of await getOperations<Data>(user.id,target)){if(sessionRef.current?.id!==user.id||businessRef.current!==target)break;const result=(await api('/sync',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':user.csrfToken},body:JSON.stringify({operations:[operation]})})).results[0];setOnline(true);if(result.status!=='accepted'){setConflicts(rows=>rows.some(row=>row.id===operation.id)?rows:[...rows,operation]);break}if(!result.data){const state=await api(`/state?business=${encodeURIComponent(target)}`);result.data=state.data;result.revision=state.revision}applyData(result.data);revision.current=result.revision;await cacheSnapshot({userId:user.id,business:target,revision:result.revision,data:result.data});await removeOperation(operation.id)}setPendingCount((await getOperations<Data>(user.id,target)).length)}catch(reason){const error=reason as Error&{status?:number};if(error.status===401||error.status===403)setSyncError('Sign in as the owner of these offline changes to sync.');else{setOnline(false);setSyncError(error.message)}}finally{setSyncing(false)}};
  const keepServer=async()=>{if(!confirm('Discard the conflicting local change and keep the server version?'))return;for(const operation of conflicts)await removeOperation(operation.id);setConflicts([]);setPendingCount((await getOperations<Data>(sessionRef.current!.id,businessRef.current)).length);await loadState()};
  useEffect(()=>{const retry=()=>void sync();window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)});
  const update=(fn:(d:Data)=>Data,action='Updated POS data')=>{
    const current=dataRef.current;
    if(!current)return;
    if(businessRef.current==='all'){setSyncError('Select one business before changing data.');return}
    const next=fn(structuredClone(current)),active=next.experiments.reduce((found,e,i)=>e.status==='active'?i:found,-1);
    if(active>=0)next.experiments=next.experiments.map((e,i)=>e.status==='active'&&i!==active?{...e,status:'draft'}:e);
    applyData(next);
    const snapshot=structuredClone(next),id=++generation.current,user=sessionRef.current,target=businessRef.current,baseRevision=revision.current;
    if(!user)return;
    queue.current=queue.current.catch(()=>undefined).then(async()=>{
      const durable=typeof indexedDB!=='undefined';let operation=createOperation({userId:user.id,business:target,baseRevision,action,data:snapshot});
      try{
        if(durable){const existing=(await getOperations<Data>(user.id,target))[0];operation=existing?compactOperation(existing,snapshot,action,{userId:user.id,business:target}):operation;await persistLatest(operation,{userId:user.id,business:target,revision:operation.baseRevision,data:snapshot});setPendingCount(1)}else setSyncError('This change is not durable because browser storage is unavailable.');
        const result=durable?(await api('/sync',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':user.csrfToken},body:JSON.stringify({operations:[operation]})})).results[0]:await api('/state',{method:'PUT',headers:{'content-type':'application/json','x-csrf-token':user.csrfToken},body:JSON.stringify({revision:revision.current,business:businessRef.current,data:snapshot,action})});
        if(result.status==='conflict'){setConflicts(rows=>[...rows,operation]);setSyncError('Conflict detected. The local change was kept pending.');return}
        if(durable){if(!result.data){const state=await api(`/state?business=${encodeURIComponent(target)}`);result.data=state.data;result.revision=state.revision}await cacheSnapshot({userId:user.id,business:target,revision:result.revision,data:result.data});await removeOperation(operation.id);setPendingCount(0)}setOnline(true);revision.current=result.revision;
        if(id===generation.current&&sessionRef.current?.id===user.id&&businessRef.current===target&&result.data)applyData(result.data);
        setSyncError('');
      }catch(reason){
        const error=reason as Error&{status?:number;body?:{revision?:number;data?:Data}};
        if(error.status===409&&error.body?.data){
          revision.current=error.body.revision||revision.current;
          applyData(error.body.data);
          setSyncError('Another user changed this data. The latest server version was restored.');
          return;
        }
        if(durable){setOnline(false);setSyncError(error.message)}else setSyncError(`Change was sent but is not durable: ${error.message}`);
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
  return <Context.Provider value={{role:roleForSession(session.role,session.capabilities),user:session,business,setBusiness,tenants,reloadTenants,theme,toggleTheme:()=>setTheme(t=>t==='dark'?'light':'dark'),data,sessionMenus,update,whenSaved:()=>queue.current,cart,dispatch,service,setService,tableIds,setTableIds,coupon,setCoupon,totals,completeOrder,clearCart,activeShift,setTableStatus,logout,syncError,reload:()=>loadState(session,business),writable:business!=='all',online,pendingCount,syncing,conflicts,sync,keepServer}}>{syncError&&<div className="sync-banner" role="alert">{syncError} {conflicts.length?<button onClick={()=>void keepServer()}>Keep server version</button>:<button onClick={()=>void loadState(session,business)}>Reload</button>}</div>}{children}</Context.Provider>;
}
export const useStore=()=>{const context=useContext(Context);if(!context)throw Error('Store missing');return context};
