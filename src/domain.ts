export type Role='cashier'|'manager'|'admin'; export type DemoMode='ready'|'loading'|'empty'|'error';
export type ServiceMode='Dine in'|'Takeaway'|'Delivery'; export type OrderStatus='Open'|'Held'|'Preparing'|'Ready'|'Completed'|'Voided';
export interface MenuItem {id:string;name:string;category:string;price:number;cost:number;available:boolean;icon:string}
export interface CartLine {id:string;menuId:string;name:string;price:number;qty:number;modifier?:string;note?:string}
export interface Order {id:string;businessId:string;createdAt:string;orderName?:string;service:ServiceMode;table?:string;status:OrderStatus;lines:CartLine[];subtotal:number;discount:number;tax:number;total:number;coupon?:string;payment?:'Cash'|'QRIS';voidReason?:string}
export interface Coupon {id:string;code:string;type:'percent'|'fixed';value:number;reason:string;active:boolean}
export interface Note {id:string;text:string;date:string}
export interface Expense {id:string;label:string;amount:number;date:string}
export interface Leave {id:string;type:string;from:string;to:string;reason:string;status:'Pending'|'Approved'|'Declined'}
export interface Shift {id:string;staff:string;date:string;start:string;end:string;location:string}
export interface Sop {id:string;title:string;version:number;steps:string[];active:boolean}
export const idr=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export const localDate=(s:string)=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(s));
export function unitConvert(quantity:number,from:'kg'|'g'|'l'|'ml',to:'kg'|'g'|'l'|'ml') {const dimension={kg:'mass',g:'mass',l:'volume',ml:'volume'} as const;if(dimension[from]!==dimension[to]) throw new Error('Unit dimensions must match');const base=from==='kg'||from==='l'?quantity*1000:quantity;return to==='kg'||to==='l'?base/1000:base}
export function calculateTotals(lines:CartLine[],coupon?:Coupon){const subtotal=lines.reduce((s,l)=>s+l.price*l.qty,0);const raw=coupon?.active?(coupon.type==='percent'?Math.round(subtotal*coupon.value/100):coupon.value):0;const discount=Math.min(subtotal,raw);const tax=Math.round((subtotal-discount)*.1);return{subtotal,discount,tax,total:subtotal-discount+tax}}
export function nextStatus(status:OrderStatus):OrderStatus {return status==='Open'||status==='Held'?'Preparing':status==='Preparing'?'Ready':status==='Ready'?'Completed':status}
export type CartAction={type:'add';item:MenuItem}|{type:'qty';id:string;delta:number}|{type:'update';id:string;modifier:string;note:string}|{type:'restore';lines:CartLine[]}|{type:'clear'};
export function cartReducer(state:CartLine[],action:CartAction):CartLine[]{if(action.type==='clear')return[];if(action.type==='restore')return action.lines;if(action.type==='add'){const found=state.find(l=>l.menuId===action.item.id&&!l.modifier&&!l.note);return found?state.map(l=>l.id===found.id?{...l,qty:l.qty+1}:l):[...state,{id:`line-${action.item.id}-${state.length}`,menuId:action.item.id,name:action.item.name,price:action.item.price,qty:1}]};if(action.type==='qty')return state.map(l=>l.id===action.id?{...l,qty:l.qty+action.delta}:l).filter(l=>l.qty>0);return state.map(l=>l.id===action.id?{...l,modifier:action.modifier,note:action.note}:l)}
