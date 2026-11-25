export type Role='cashier'|'manager'|'admin'|'superadmin'|'kitchen'|'display';
export type Capability='cashierDashboard'|'createOrder'|'cashierPeople'|'manageNotes'|'manageOrders'|'viewSeats'|'managerDashboard'|'viewRevenue'|'manageExpenses'|'manageInventory'|'viewProfitability'|'runSop'|'adminDashboard'|'adminInsights'|'manageCatalog'|'adminOperations'|'adminStaff'|'adminSop'|'viewKitchen'|'viewDisplay'|'viewAccessProfiles'|'editAccessProfiles'|'approveLeave';
const adminCapabilities:Capability[]=['cashierDashboard','createOrder','cashierPeople','manageNotes','manageOrders','viewSeats','managerDashboard','viewRevenue','manageExpenses','manageInventory','viewProfitability','runSop','adminDashboard','adminInsights','manageCatalog','adminOperations','adminStaff','adminSop','viewAccessProfiles','editAccessProfiles','approveLeave'];
export const SYSTEM_PROFILES={cashier:{id:'system:cashier',name:'Cashier',capabilities:['cashierDashboard','createOrder','cashierPeople','manageNotes','manageOrders','viewSeats'] as Capability[]},manager:{id:'system:manager',name:'Manager',capabilities:['managerDashboard','viewRevenue','manageExpenses','manageInventory','viewProfitability','runSop','manageOrders','viewSeats','approveLeave'] as Capability[]},admin:{id:'system:admin',name:'Admin',capabilities:adminCapabilities},kitchen:{id:'system:kitchen',name:'Kitchen',capabilities:['viewKitchen'] as Capability[]},display:{id:'system:display',name:'Display',capabilities:['viewDisplay'] as Capability[]}} as const;
export type MenuScope={mode:'all'|'limited';categoryIds:string[];itemIds:string[]};
export const hasCapability=(capabilities:readonly Capability[],capability:Capability)=>capabilities.includes(capability);
export type FeaturePermission={label:string;view:Capability;edit?:Capability};
export type FeaturePermissionGroup={label:string;features:FeaturePermission[]};
export const FEATURE_GROUPS:FeaturePermissionGroup[]=[
  {label:'Today',features:[{label:'Cashier dashboard',view:'cashierDashboard'}]},
  {label:'Overview',features:[{label:'Manager dashboard',view:'managerDashboard'},{label:'Portfolio',view:'adminDashboard'},{label:'Revenue',view:'viewRevenue'},{label:'Insights',view:'adminInsights'}]},
  {label:'Service',features:[{label:'New order',view:'createOrder'},{label:'Orders',view:'manageOrders'},{label:'Seats',view:'viewSeats'},{label:'Shift & requests',view:'cashierPeople'},{label:'Leave approvals',view:'approveLeave'},{label:'Notes',view:'manageNotes'},{label:'Run SOP & notes',view:'runSop'}]},
  {label:'Operations',features:[{label:'Expenses',view:'manageExpenses'},{label:'Inventory & recipes',view:'manageInventory'},{label:'Profitability',view:'viewProfitability'},{label:'Staff & shifts',view:'adminStaff'},{label:'Targets & schedule',view:'adminOperations'}]},
  {label:'Catalogue',features:[{label:'Catalogue management',view:'manageCatalog'}]},
  {label:'Administration',features:[{label:'SOP templates',view:'adminSop'},{label:'Users & roles',view:'viewAccessProfiles',edit:'editAccessProfiles'}]},
  {label:'Kitchen',features:[{label:'Kitchen display',view:'viewKitchen'}]},
  {label:'Display',features:[{label:'Menu display',view:'viewDisplay'}]},
];
export const FEATURE_ROWS=FEATURE_GROUPS.flatMap(group=>group.features);
export function setCapability(current:readonly Capability[],capability:Capability,checked:boolean):Capability[]{const row=FEATURE_ROWS.find(r=>r.view===capability||r.edit===capability),next=new Set(current);if(checked){next.add(capability);if(row?.edit===capability&&row.view)next.add(row.view)}else{next.delete(capability);if(row?.view===capability&&row.edit)next.delete(row.edit)}return[...next]}
export function menuAllowed(scope:MenuScope,item:MenuItem,catalog:MenuItem[]):boolean{if(scope.mode==='all')return true;if(!scope.categoryIds.includes(item.category)&&!scope.itemIds.includes(item.id))return false;if((item.kind||'item')!=='bundle')return true;const version=item.versions?.find(v=>v.version===item.currentVersion);return !!version?.components?.every(component=>{const child=catalog.find(entry=>entry.id===component.menuId);return child&&!child.archived&&menuAllowed(scope,child,catalog)})}
export const capabilitiesForRole=(role:Role):readonly Capability[]=>role==='superadmin'?adminCapabilities:SYSTEM_PROFILES[role].capabilities;
export const roleForSession=(role:Role,capabilities?:readonly Capability[]):Role=>role==='superadmin'||!capabilities?role:capabilities.includes('adminDashboard')?'admin':capabilities.includes('managerDashboard')?'manager':capabilities.includes('viewKitchen')?'kitchen':capabilities.includes('viewDisplay')?'display':'cashier';
export const can=(role:Role,capability:Capability)=>hasCapability(capabilitiesForRole(role),capability);
export const dashboardPath=(role:Role)=>role==='admin'||role==='superadmin'?'/admin/dashboard':`/${role}/dashboard`;
export type ServiceMode=string; export type OrderStatus='Held'|'Preparing'|'Ready'|'Completed'|'Voided';
export interface OrderType {id:string;name:string;enabled:boolean;archived:boolean;requiresTable:boolean}
export type TableStatus='Available'|'Occupied'|'Reserved'|'Needs attention'|'Unavailable';
export interface Table {id:string;name:string;capacity:number;status:TableStatus;enabled:boolean;archived:boolean}
export interface Ingredient {id:string;name:string;quantity?:number;unit?:string;hidden:boolean}
export interface BundleComponent {menuId:string;quantity:number}
export interface VariationOption {id:string;name:string;priceDelta:number}
export interface VariationGroup {id:string;name:string;required:boolean;options:VariationOption[]}
export interface SelectedVariation {groupId:string;groupName:string;optionId:string;optionName:string;priceDelta:number}
export interface MenuVersion {version:number;name:string;description:string;category:string;ingredients:Ingredient[];components?:BundleComponent[];variations?:VariationGroup[];price:number;createdAt:string}
export interface MenuItem {id:string;kind?:'item'|'bundle';currentVersion?:number;versions?:MenuVersion[];availability?:'available'|'low'|'sold-out';archived?:boolean;reviewStatus?:'pending'|'reviewed';createdFrom?:'order-entry';icon:string;name:string;category:string;price:number;cost:number;available:boolean}
export type ExperimentStatus='draft'|'active'|'finalized'|'archived';
export interface Experiment {id:string;name:string;assumptions:string;menuDrafts:MenuItem[];dailyTargets:Record<string,number>;status:ExperimentStatus;finalizedAt?:string}
export interface ProjectedIngredient {name:string;unit?:string;quantity:number;missing?:string}
const currentVersion=(m:MenuItem)=>m.versions?.find(v=>v.version===m.currentVersion);
export function calculateExperiment(e:Experiment){let projectedRevenue=0;const totals=new Map<string,ProjectedIngredient>();const add=(m:MenuItem,count:number)=>{const v=currentVersion(m);if(!v)return;if((m.kind||'item')==='bundle')return v.components?.forEach(c=>{const component=e.menuDrafts.find(x=>x.id===c.menuId);if(component)add(component,count*c.quantity)});for(const i of v.ingredients){const invalid=i.quantity!==undefined&&(!Number.isFinite(i.quantity)||i.quantity<=0),missing=invalid?'valid quantity':[i.quantity===undefined?'quantity':'',!i.unit?'unit':''].filter(Boolean).join(' and ');const key=`${i.name.trim().toLowerCase()}|${i.unit?.trim().toLowerCase()||''}`;const old=totals.get(key);totals.set(key,{name:i.name,unit:i.unit,quantity:(old?.quantity||0)+(invalid?0:i.quantity===undefined?count:i.quantity*count),...(missing?{missing}:{})})}};for(const m of e.menuDrafts){const target=e.dailyTargets[m.id]||0;projectedRevenue+=target*(currentVersion(m)?.price||0);add(m,target)}return{projectedRevenue,projectedIngredients:[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name)||String(a.unit).localeCompare(String(b.unit)))}}
export function activateExperiment(experiments:Experiment[],id:string){return experiments.map(e=>e.id===id?{...e,status:'active' as const}:e.status==='active'?{...e,status:'draft' as const}:e)}
export function menuForSession(menus:MenuItem[],experiments:Experiment[]){return experiments.find(e=>e.status==='active')?.menuDrafts||menus}
export function finalizeExperiment(menus:MenuItem[],experiment:Experiment,at=new Date().toISOString()){if(experiment.status==='finalized')throw Error('Experiment already finalized');const drafts=new Map(experiment.menuDrafts.map(d=>[d.id,d]));const apply=(d:MenuItem)=>{const draft=currentVersion(d);if(!draft)return d;const existing=menus.find(m=>m.id===d.id);const version=(existing?.currentVersion||0)+1;return{...d,currentVersion:version,name:draft.name,category:draft.category,price:draft.price,versions:[...(existing?.versions||[]),{...draft,version,createdAt:at}]}};return{menus:[...menus.map(m=>drafts.has(m.id)?apply(drafts.get(m.id)!):m),...experiment.menuDrafts.filter(d=>!menus.some(m=>m.id===d.id)).map(apply)],experiment:{...experiment,status:'finalized' as const,finalizedAt:at}}}
export function validateBundle(id:string,components:BundleComponent[],menus:MenuItem[]){if(components.length<2)return 'Bundle requires at least two components.';if(new Set(components.map(x=>x.menuId)).size!==components.length)return 'Bundle component menus must be unique.';if(components.some(x=>!Number.isInteger(x.quantity)||x.quantity<=0))return 'Component quantities must be positive integers.';if(components.some(x=>x.menuId===id))return 'A bundle cannot contain itself.';const selected=components.map(x=>menus.find(m=>m.id===x.menuId));if(selected.some(m=>!m||m.archived))return 'Components must be current, non-archived menus.';if(selected.some(m=>(m?.kind||'item')!=='item'))return 'Bundles may contain standard menus only.';return ''}
export interface CartLine {id:string;menuId:string;name:string;price:number;basePrice?:number;qty:number;variations?:SelectedVariation[];modifier?:string;note?:string}
export interface Order {id:string;businessId:string;createdAt:string;service:ServiceMode;table?:string;tableIds?:string[];status:OrderStatus;lines:CartLine[];subtotal:number;discount:number;tax:number;total:number;coupon?:string;payment?:'Cash'|'QRIS';tendered?:number;change?:number;cashierId?:string;cashierName?:string;shiftId?:string;voidReason?:string}
export interface Coupon {id:string;code:string;type:'percent'|'fixed';value:number;reason:string;active:boolean}
export interface Note {id:string;text:string;date:string}
export interface ExpenseLine {id:string;description:string;quantity?:number;unit?:string;amount:number}
export interface Expense {id:string;label:string;category:string;amount:number;date:string;lines:ExpenseLine[]}
export interface Leave {id:string;type:string;from:string;to:string;reason:string;status:'Pending'|'Approved'|'Declined'}
export interface Shift {id:string;staff:string;date:string;start:string;end:string;location:string}
export interface ShiftSession {id:string;businessId:string;cashierId:string;cashierName:string;openedAt:string;openingCash:number;closedAt?:string;closingCash?:number;variance?:number}
export interface Staff {id:string;name:string;role:string;status:string}
export interface InventoryItem {id:string;name:string;quantity:number;unit:string;reorderAt:number;status:string;unitCost?:number}
export type InventoryMovementType='receive'|'consume'|'adjust';
export interface InventoryMovement {id:string;itemId:string;type:InventoryMovementType;quantity:number;unit:string;note:string;at:string;actor:string}
export interface Message {id:string;from:string;text:string;time:string;businessId?:string}
export interface Sop {id:string;title:string;version:number;steps:string[];active:boolean}
export const idr=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export const BUSINESS_TZ='Asia/Jakarta';
export const localDay=(value:string|Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const localHour=(value:string|Date)=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:BUSINESS_TZ,hour:'2-digit',hour12:false}).format(new Date(value)));
export const localWeekday=(value:string|Date)=>new Intl.DateTimeFormat('en-US',{timeZone:BUSINESS_TZ,weekday:'long'}).format(new Date(value));
export const localDateTime=(value:string|Date)=>new Intl.DateTimeFormat('id-ID',{timeZone:BUSINESS_TZ,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const localDate=(s:string)=>new Intl.DateTimeFormat('id-ID',{timeZone:BUSINESS_TZ,day:'numeric',month:'short',year:'numeric'}).format(new Date(s));
export type SoldMenuRevenueSegment={menuId:string;name:string;quantity:number;revenue:number};
export type SoldMenuRevenueDay={day:string;total:number;quantity:number;segments:SoldMenuRevenueSegment[]};
export function soldMenuRevenue(orders:Order[],menus:MenuItem[],days=30,now=new Date()):SoldMenuRevenueDay[]{
  const end=localDay(now),cursor=new Date(`${end}T12:00:00Z`),rows:SoldMenuRevenueDay[]=[];
  for(let i=days-1;i>=0;i--){const date=new Date(cursor);date.setUTCDate(date.getUTCDate()-i);rows.push({day:date.toISOString().slice(0,10),total:0,quantity:0,segments:[]})}
  const byDay=new Map(rows.map(row=>[row.day,row]));
  for(const order of orders){if(order.status!=='Completed')continue;const row=byDay.get(localDay(order.createdAt));if(!row)continue;const grouped=new Map(row.segments.map(segment=>[segment.menuId,segment]));for(const line of order.lines){const found=grouped.get(line.menuId),revenue=line.price*line.qty;if(found){found.quantity+=line.qty;found.revenue+=revenue}else{const segment={menuId:line.menuId,name:line.name||menus.find(menu=>menu.id===line.menuId)?.name||line.menuId,quantity:line.qty,revenue};row.segments.push(segment);grouped.set(line.menuId,segment)}row.total+=revenue;row.quantity+=line.qty}}
  for(const row of rows)row.segments.sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name));
  return rows
}
type ConvertUnit='kg'|'g'|'l'|'ml'|'liter';
export function unitConvert(quantity:number,from:ConvertUnit,to:ConvertUnit) {
  const norm=(unit:ConvertUnit):'kg'|'g'|'l'|'ml'=>unit==='liter'?'l':unit;
  const a=norm(from),b=norm(to),dimension={kg:'mass',g:'mass',l:'volume',ml:'volume'} as const;
  if(dimension[a]!==dimension[b]) throw new Error('Unit dimensions must match');
  const base=a==='kg'||a==='l'?quantity*1000:quantity;
  return b==='kg'||b==='l'?base/1000:base
}
const moneyWords=(value:string)=>new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(word=>word.length>3));
export function matchInventoryItem(name:string,inventory:InventoryItem[]){
  const target=moneyWords(name);let best:InventoryItem|undefined,bestScore=0;
  for(const item of inventory){const score=[...moneyWords(item.name)].filter(word=>target.has(word)).length;if(score>bestScore){best=item;bestScore=score}}
  return bestScore>0?best:undefined
}
export function stockFromExpenseLines(inventory:InventoryItem[],lines:ExpenseLine[],label:string,actor:string,at=new Date().toISOString()){
  const items=inventory.map(item=>({...item})),movements:InventoryMovement[]=[];
  for(const line of lines){
    if(!line.quantity||!line.unit)continue;
    const name=line.description.trim(),unit=line.unit.trim();
    let item=items.find(x=>x.name.trim().toLowerCase()===name.toLowerCase())||matchInventoryItem(name,items),quantity=line.quantity;
    if(item&&item.unit!==unit){
      try{quantity=unitConvert(line.quantity,unit as ConvertUnit,item.unit as ConvertUnit)}catch{item=undefined}
    }
    if(!item){
      item={id:`stock-${crypto.randomUUID()}`,name,quantity:0,unit,reorderAt:0,status:'Healthy',unitCost:Math.round(line.amount/line.quantity)};
      items.push(item)
    }
    const added=Math.round(quantity*1000)/1000;
    item.quantity=Math.round((item.quantity+added)*1000)/1000;
    item.status=item.quantity>=item.reorderAt?'Healthy':'Low';
    movements.push({id:crypto.randomUUID(),itemId:item.id,type:'receive',quantity:added,unit:item.unit,note:`Expense: ${label}`,at,actor})
  }
  return{inventory:items,movements}
}
export function ingredientCost(ingredient:Ingredient,inventory:InventoryItem[]){
  if(!ingredient.quantity||!ingredient.unit)return 0;
  const item=matchInventoryItem(ingredient.name,inventory);if(!item?.unitCost)return 0;
  try{return unitConvert(ingredient.quantity,ingredient.unit as ConvertUnit,item.unit as ConvertUnit)*item.unitCost}catch{return 0}
}
export function recipeCost(version:MenuVersion|undefined,inventory:InventoryItem[]){
  if(!version)return{cost:0,priced:0,total:0};
  const parts=version.ingredients.filter(ingredient=>ingredient.quantity&&ingredient.unit);
  const priced=parts.filter(ingredient=>ingredientCost(ingredient,inventory)>0).length;
  return{cost:Math.round(parts.reduce((sum,ingredient)=>sum+ingredientCost(ingredient,inventory),0)),priced,total:parts.length}
}
export function calculateTotals(lines:CartLine[],coupon?:Coupon){const subtotal=lines.reduce((s,l)=>s+l.price*l.qty,0);const raw=coupon?.active?(coupon.type==='percent'?Math.round(subtotal*coupon.value/100):coupon.value):0;const discount=Math.min(subtotal,raw);const tax=Math.round((subtotal-discount)*.1);return{subtotal,discount,tax,total:subtotal-discount+tax}}
export function nextStatus(status:OrderStatus):OrderStatus {return status==='Held'?'Preparing':status==='Preparing'?'Ready':status==='Ready'?'Completed':status}
export function validateVariations(groups:VariationGroup[]){const names=new Set<string>();for(const group of groups){const name=group.name.trim().toLowerCase();if(!name)return 'Variation group name is required.';if(names.has(name))return 'Variation group names must be unique.';names.add(name);if(!group.options.length)return 'Each variation group requires at least one option.';const options=new Set<string>();for(const option of group.options){const optionName=option.name.trim().toLowerCase();if(!optionName)return 'Variation option name is required.';if(options.has(optionName))return 'Variation option names must be unique within a group.';options.add(optionName);if(!Number.isFinite(option.priceDelta)||option.priceDelta<0)return 'Variation prices must be finite non-negative amounts.'}}return ''}
const selectionKey=(selections:SelectedVariation[]=[])=>([...selections].sort((a,b)=>a.groupId.localeCompare(b.groupId)).map(x=>`${x.groupId}:${x.groupName}:${x.optionId}:${x.optionName}:${x.priceDelta}`).join('|'));
export type CartAction={type:'add';item:MenuItem}|{type:'addConfigured';item:MenuItem;selections:SelectedVariation[];qty:number;note?:string}|{type:'restore';lines:CartLine[]}|{type:'qty';id:string;delta:number}|{type:'update';id:string;modifier?:string;note:string;selections?:SelectedVariation[];qty?:number}|{type:'clear'};
export function cartReducer(state:CartLine[],action:CartAction):CartLine[]{if(action.type==='clear')return[];if(action.type==='restore')return structuredClone(action.lines);if(action.type==='add'||action.type==='addConfigured'){const configured=action.type==='addConfigured',selections=configured?action.selections:[],qty=configured?action.qty:1,note=configured?action.note?.trim()||'':'',current=action.item.versions?.find(v=>v.version===action.item.currentVersion),basePrice=current?.price??action.item.price,key=selectionKey(selections),price=basePrice+selections.reduce((sum,x)=>sum+x.priceDelta,0),found=state.find(l=>l.menuId===action.item.id&&l.name===(current?.name??action.item.name)&&l.price===price&&!l.modifier&&(l.note||'')===note&&selectionKey(l.variations)===key);return found?state.map(l=>l.id===found.id?{...l,qty:l.qty+qty}:l):[...state,{id:`line-${action.item.id}-${crypto.randomUUID()}`,menuId:action.item.id,name:current?.name??action.item.name,price,basePrice,variations:structuredClone(selections),qty,...(note?{note}:{})}]};if(action.type==='qty')return state.map(l=>l.id===action.id?{...l,qty:l.qty+action.delta}:l).filter(l=>l.qty>0);return state.map(l=>{if(l.id!==action.id)return l;if(!action.selections)return{...l,modifier:action.modifier||'',note:action.note};const oldDelta=l.variations?.reduce((sum,x)=>sum+x.priceDelta,0)??0,basePrice=l.basePrice??l.price-oldDelta;return{...l,price:basePrice+action.selections.reduce((sum,x)=>sum+x.priceDelta,0),basePrice,variations:structuredClone(action.selections),qty:action.qty??l.qty,note:action.note.trim()||undefined}})}
