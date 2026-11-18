import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {hashToken,passwordHash,passwordMatches,safeEqual} from './auth.mjs';
import {BUSINESS,seedReceipts,seedState} from './seed.mjs';
import {createReceiptUpload} from './receiptUpload.mjs';
import {extractMenuPhotos,parseMenuPhotos} from './menuImport.mjs';
import {PAPER_WIDTHS,PRINT_TYPES,renderPrintJob,sendToPrinter} from './printing.mjs';

const ROLES=new Set(['cashier','manager','admin','superadmin','kitchen','display']);
const ROLE_CAPABILITIES={cashier:['cashierDashboard','createOrder','cashierPeople','manageNotes','manageOrders','viewSeats'],manager:['managerDashboard','viewRevenue','manageExpenses','manageInventory','viewProfitability','runSop','manageOrders','viewSeats','approveLeave'],admin:['cashierDashboard','createOrder','cashierPeople','manageNotes','manageOrders','viewSeats','managerDashboard','viewRevenue','manageExpenses','manageInventory','viewProfitability','runSop','adminDashboard','adminInsights','manageCatalog','adminOperations','adminStaff','adminSop','viewAccessProfiles','editAccessProfiles','approveLeave'],kitchen:['viewKitchen'],display:['viewDisplay']};
const EDITABLE_CAPABILITIES=new Set(Object.values(ROLE_CAPABILITIES).flat());
const SYSTEM_PROFILES=Object.fromEntries(Object.entries(ROLE_CAPABILITIES).map(([role,capabilities])=>[`system:${role}`,{id:`system:${role}`,name:role[0].toUpperCase()+role.slice(1),role,protected:true,capabilities,menuScope:{mode:'all',categoryIds:[],itemIds:[]}}]));
const DEFAULT_SCOPE={mode:'all',categoryIds:[],itemIds:[]};
export const BUSINESS_IDS=['harbor','garden','north'];
const BUSINESSES=new Set(BUSINESS_IDS);
const MUTABLE={cashier:new Set(['orders','notes','leaves','messagesRead','tables','shiftSessions']),manager:new Set(['orders','notes','expenses','inventory','inventoryMovements','sopHistory','tables','leaves','shiftSessions']),admin:null,superadmin:null,kitchen:new Set(['orders','menus','experiments']),display:new Set()};
const REQUIRED=['orders','orderTypes','tables','menus','experiments','coupons','notes','expenses','leaves','staff','shifts','shiftSessions','inventory','inventoryMovements','sops','sopHistory','messages','messagesRead','audit','targets','planningNotes','schedules'];
const ARRAY_KEYS=REQUIRED.filter(key=>!['targets','planningNotes','schedules'].includes(key));
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=300)=>typeof value==='string'&&value.length<=max;
const validProfile=body=>{const scope=body.menuScope;return text(body.name,100)&&body.name.trim()&&Array.isArray(body.capabilities)&&body.capabilities.every(x=>EDITABLE_CAPABILITIES.has(x))&&isObject(scope)&&['all','limited'].includes(scope.mode)&&Array.isArray(scope.categoryIds)&&scope.categoryIds.every(x=>text(x,100))&&Array.isArray(scope.itemIds)&&scope.itemIds.every(x=>text(x,100))&&!body.capabilities.some(x=>x.startsWith('edit')&&!body.capabilities.includes(`view${x.slice(4)}`))};
const number=value=>typeof value==='number'&&Number.isFinite(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safeTree=(value,depth=0)=>depth<=16&&(value===null||typeof value==='boolean'||number(value)||text(value,10000)||Array.isArray(value)&&value.length<=10000&&value.every(item=>safeTree(item,depth+1))||isObject(value)&&Object.keys(value).length<=200&&Object.entries(value).every(([key,item])=>text(key,100)&&key!=='__proto__'&&key!=='constructor'&&key!=='prototype'&&safeTree(item,depth+1)));
const changedKeys=(before,after)=>REQUIRED.filter(key=>key!=='audit'&&!same(before[key],after[key]));
const validLine=line=>isObject(line)&&text(line.id,100)&&text(line.menuId,100)&&text(line.name,200)&&number(line.price)&&line.price>=0&&Number.isInteger(line.qty)&&line.qty>0;
const validOrder=(order,business)=>isObject(order)&&text(order.id,100)&&order.businessId===business&&text(order.createdAt,40)&&text(order.service,100)&&['Held','Preparing','Ready','Completed','Voided'].includes(order.status)&&Array.isArray(order.lines)&&order.lines.length<=100&&order.lines.every(validLine)&&['subtotal','discount','tax','total'].every(key=>number(order[key])&&order[key]>=0);
const hasForeignBusinessClaim=(value,business,depth=0)=>depth>16||Array.isArray(value)?Array.isArray(value)&&value.some(item=>hasForeignBusinessClaim(item,business,depth+1)):isObject(value)&&Object.entries(value).some(([key,item])=>key==='businessId'&&item!==business||hasForeignBusinessClaim(item,business,depth+1));
function validState(data,business){
  if(!safeTree(data)||!isObject(data)||Object.keys(data).some(key=>!REQUIRED.includes(key))||REQUIRED.some(key=>!(key in data))||hasForeignBusinessClaim(data,business))return false;
  if(!Array.isArray(data.orders)||data.orders.length>10000||!data.orders.every(order=>validOrder(order,business)))return false;
  for(const key of ARRAY_KEYS)if(!Array.isArray(data[key])||data[key].length>10000)return false;
  if(!isObject(data.targets)||Object.keys(data.targets).some(key=>key!==business)||!number(data.targets[business])||data.targets[business]<0)return false;
  return isObject(data.planningNotes)&&isObject(data.schedules)&&JSON.stringify(data).length<=1_000_000;
}
function validNewOrder(order,state){const subtotal=order.lines.reduce((sum,line)=>sum+line.price*line.qty,0),coupon=state.coupons.find(item=>item.active&&item.code.toLowerCase()===String(order.coupon||'').toLowerCase()),raw=coupon?(coupon.type==='percent'?Math.round(subtotal*coupon.value/100):coupon.value):0,discount=Math.min(subtotal,raw),tax=Math.round((subtotal-discount)*.1);return order.subtotal===subtotal&&order.discount===discount&&order.tax===tax&&order.total===subtotal-discount+tax&&(['Completed','Held'].includes(order.status))&&(order.status!=='Completed'||['Cash','QRIS'].includes(order.payment))}
const ORDER_TRANSITIONS={Held:['Preparing'],Preparing:['Ready']};
function operationalOrdersSafe(before,after){
  const oldById=new Map(before.orders.map(order=>[order.id,order])),newById=new Map(after.orders.map(order=>[order.id,order]));
  for(const old of before.orders){
    const current=newById.get(old.id);
    if(!current){if(old.status!=='Held')return false;continue}
    if(same(old,current))continue;
    if(current.status==='Voided'&&text(current.voidReason,300)&&current.voidReason.trim()&&same({...old,status:'Voided',voidReason:current.voidReason},current))continue;
    const allowed=ORDER_TRANSITIONS[old.status]||[];
    if(allowed.includes(current.status)&&same({...old,status:current.status},current))continue;
    if(current.status==='Completed'&&old.status!=='Completed'&&['Cash','QRIS'].includes(current.payment)){
      const ignore=new Set(['status','payment','tendered','change','cashierId','cashierName']),canonical=value=>JSON.stringify(Object.keys(value).filter(key=>value[key]!==undefined&&!ignore.has(key)).sort().map(key=>[key,value[key]]));
      if(canonical({...old,status:'Completed'})===canonical(current))continue
    }
    if(old.status==='Completed'&&current.status==='Held'&&Date.now()-new Date(old.createdAt).getTime()<300000){const expected={...old,status:'Held'};delete expected.payment;if(same(expected,current))continue}
    return false
  }
  return after.orders.filter(order=>!oldById.has(order.id)).every(order=>validNewOrder(order,after))}
function statusOnlyTables(before,after){if(before.tables.length!==after.tables.length)return false;const oldById=new Map(before.tables.map(table=>[table.id,table]));return after.tables.every(table=>{const old=oldById.get(table.id);return old&&same({...old,status:table.status},table)})}
function kitchenSafe(before,after){
  const oldOrders=new Map(before.orders.map(order=>[order.id,order]));
  if(after.orders.length!==before.orders.length||after.orders.some(order=>{const old=oldOrders.get(order.id);return !old||(!same(old,order)&&!(old.status==='Preparing'&&order.status==='Ready'&&same({...old,status:'Ready'},order)))}))return false;
  const availabilityOnly=(old,item)=>old&&same({...old,availability:item.availability},item),oldMenus=new Map(before.menus.map(item=>[item.id,item]));
  if(after.menus.length!==before.menus.length||after.menus.some(item=>!availabilityOnly(oldMenus.get(item.id),item)))return false;
  return after.experiments.every((experiment,index)=>{const old=before.experiments[index];if(!old||experiment.id!==old.id||experiment.menuDrafts?.length!==old.menuDrafts?.length)return same(experiment,old);const oldDrafts=new Map(old.menuDrafts.map(item=>[item.id,item]));return same({...old,menuDrafts:experiment.menuDrafts},experiment)&&experiment.menuDrafts.every(item=>availabilityOnly(oldDrafts.get(item.id),item))});
}
function shiftsSafe(before,after,user,business){
  const oldById=new Map(before.shiftSessions.map(row=>[row.id,row])),open=after.shiftSessions.filter(row=>!row.closedAt);
  if(open.length>1)return false;
  for(const row of after.shiftSessions){
    const old=oldById.get(row.id);
    if(!old){
      if(row.closedAt||row.cashierId!==user.id||row.businessId!==business||!text(row.cashierName,200)||!number(row.openingCash)||row.openingCash<0)return false;
      continue
    }
    if(!old.closedAt&&row.closedAt&&row.cashierId===user.id&&number(row.closingCash)&&row.closingCash>=0&&same({...old,closedAt:row.closedAt,closingCash:row.closingCash,variance:row.variance},row))continue;
    if(!same(old,row))return false
  }
  return after.shiftSessions.length>=before.shiftSessions.length
}
function movementsSafe(before,after){
  if(after.inventoryMovements.length<before.inventoryMovements.length)return false;
  const oldIds=new Set(before.inventoryMovements.map(row=>row.id));
  for(const row of after.inventoryMovements)if(!oldIds.has(row.id)&&(!text(row.id,100)||!text(row.itemId,100)||!['receive','consume','adjust'].includes(row.type)||!number(row.quantity)||row.quantity<=0))return false;
  return true
}
function authorizeMutation(user,business,before,after){
  if(!canAccess(user,business))return 'Business access denied.';
  const changed=changedKeys(before,after),allowed=MUTABLE[user.role];
  if(!changed.length)return 'No changes supplied.';
  if(allowed&&changed.some(key=>!allowed.has(key)))return 'Action is not allowed for this role.';
  if(['cashier','manager'].includes(user.role)&&changed.includes('orders')&&!operationalOrdersSafe(before,after))return 'Order mutation is not allowed.';
  if(['cashier','manager'].includes(user.role)&&changed.includes('tables')&&!statusOnlyTables(before,after))return 'Only table status may be changed.';
  if(changed.includes('shiftSessions')&&!shiftsSafe(before,after,user,business))return 'Shift session change is not allowed.';
  if(changed.includes('inventoryMovements')&&['manager','admin','superadmin'].includes(user.role)&&!movementsSafe(before,after))return 'Inventory movements are append-only.';
  if(changed.includes('orders')&&user.menuScope?.mode==='limited'){const catalog=new Map(before.menus.map(item=>[item.id,item])),allowedMenu=id=>{const item=catalog.get(id);if(!item||item.archived||!user.menuScope.categoryIds.includes(item.category)&&!user.menuScope.itemIds.includes(id))return false;if((item.kind||'item')!=='bundle')return true;return item.versions?.find(v=>v.version===item.currentVersion)?.components?.every(component=>allowedMenu(component.menuId))===true};for(const order of after.orders.filter(order=>!before.orders.some(old=>old.id===order.id)))if(order.lines.some(line=>!allowedMenu(line.menuId)))return 'Menu item access denied.'}
  if(user.role==='kitchen'&&!kitchenSafe(before,after))return 'Kitchen may only mark preparing orders ready or change menu availability.';
  return '';
}

const account=(role,business)=>{const label=business?`${role}.${business}`:role;return{id:`seed-${label}`,username:label,displayName:`${role[0].toUpperCase()+role.slice(1)} ${business||'Global'}`,role,businessIds:business?[business]:['*']}};
export const developmentAccounts=()=>[{...account('superadmin'),id:'seed-admin'},...BUSINESS_IDS.flatMap(business=>['admin','cashier','manager','kitchen','display'].map(role=>account(role,business))),{...account('manager','harbor'),id:'seed-manager.multi',username:'manager.multi',displayName:'Manager Harbor Garden',businessIds:['harbor','garden']}];
const canAccess=(user,business)=>BUSINESSES.has(business)&&(user.businessIds.includes(business)||user.role==='superadmin'&&user.businessIds.includes('*'));
const canAccessAll=user=>user.role==='superadmin'&&user.businessIds.includes('*');
const parseCookies=header=>Object.fromEntries(String(header||'').split(';').map(part=>part.trim().split('=').map(decodeURIComponent)).filter(pair=>pair.length===2));
const json=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body))};
async function readJson(req){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>1_000_000)throw Object.assign(Error('Payload too large.'),{status:413});body+=chunk}if(!body)throw Object.assign(Error('JSON body required.'),{status:400});try{return JSON.parse(body)}catch{throw Object.assign(Error('Invalid JSON.'),{status:400})}}
async function readPaymentQr(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw Object.assign(Error('Payment QR must be 2 MB or smaller.'),{status:413});chunks.push(chunk)}const bytes=Buffer.concat(chunks),mime=req.headers['content-type']?.split(';')[0],signatures={'image/png':value=>value.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'image/jpeg':value=>value[0]===255&&value[1]===216&&value[2]===255,'image/webp':value=>value.subarray(0,4).toString()==='RIFF'&&value.subarray(8,12).toString()==='WEBP'};if(!signatures[mime])throw Object.assign(Error('PNG, JPEG, or WebP required.'),{status:415});if(!bytes.length)throw Object.assign(Error('Payment QR image required.'),{status:400});if(!signatures[mime](bytes))throw Object.assign(Error('Image content does not match its type.'),{status:400});return{bytes,mime}}

function migrateEnvelope(raw,reference=new Date()){
  if(raw?.schemaVersion===2&&isObject(raw.tenants)&&[...BUSINESSES].every(id=>isObject(raw.tenants[id]))){
    const envelope=structuredClone(raw);
    for(const business of BUSINESSES){const target=envelope.tenants[business];for(const key of REQUIRED)if(!(key in target))target[key]=key==='targets'?{[business]:0}:key==='planningNotes'||key==='schedules'?{}:[]}
    return envelope
  }
  const seeded=seedState(reference),legacy=isObject(raw)?raw:{};
  for(const business of BUSINESSES)if(!seeded.tenants[business])seeded.tenants[business]={...structuredClone(seeded.tenants.harbor),...Object.fromEntries(ARRAY_KEYS.map(key=>[key,[]])),targets:{[business]:0},planningNotes:{},schedules:{}};
  for(const business of BUSINESSES){const target=seeded.tenants[business];if(Array.isArray(legacy.orders)){const orders=legacy.orders.filter(order=>order.businessId===business);if(orders.length)target.orders=orders}}
  const harbor=seeded.tenants.harbor;for(const key of REQUIRED)if(key!=='orders'&&key in legacy)harbor[key]=legacy[key];harbor.targets={harbor:number(legacy.targets?.harbor)?legacy.targets.harbor:harbor.targets.harbor};
  for(const order of harbor.orders)order.businessId='harbor';
  return seeded;
}
function allData(envelope){
  const result=Object.fromEntries(REQUIRED.map(key=>[key,ARRAY_KEYS.includes(key)?[]:{}]));
  for(const business of BUSINESSES){const tenant=envelope.tenants[business];for(const key of ARRAY_KEYS){if(['sopHistory','messagesRead','audit'].includes(key))result[key].push(...tenant[key].map(value=>`[${business}] ${value}`));else result[key].push(...tenant[key].map(value=>isObject(value)?{...value,businessId:business}:value))}Object.assign(result.targets,tenant.targets);for(const [key,value] of Object.entries(tenant.planningNotes))result.planningNotes[`${business}:${key}`]=value;for(const [key,value] of Object.entries(tenant.schedules))result.schedules[`${business}:${key}`]=value}
  for(const key of ARRAY_KEYS){if(!result[key].length||!isObject(result[key][0]))continue;const seen=new Set();result[key]=result[key].filter(value=>{const id=isObject(value)?value.id:value;if(seen.has(id))return false;seen.add(id);return true})}
  return result;
}

export async function ensureDevelopmentAccounts(db,{resetPasswords=false}={}){
  const configured=process.env.POS_SEED_PASSWORD,password=configured||'light-pos-demo';
  for(const spec of developmentAccounts()){const found=db.prepare('SELECT id FROM users WHERE id=? OR lower(username)=lower(?)').get(spec.id,spec.username);if(process.env.NODE_ENV==='production'&&!found&&(!configured||configured.length<12))throw Error('POS_SEED_PASSWORD (at least 12 characters) is required to create production seed accounts.');if(!found){const hashed=await passwordHash(password);db.prepare('INSERT INTO users(id,username,display_name,role,business_ids,password_salt,password_hash,profile_id) VALUES(?,?,?,?,?,?,?,?)').run(spec.id,spec.username,spec.displayName,spec.role,JSON.stringify(spec.businessIds),hashed.salt,hashed.hash,spec.role==='superadmin'?null:`system:${spec.role}`)}else{db.prepare('UPDATE users SET username=?,display_name=?,role=?,business_ids=?,profile_id=coalesce(profile_id,?) WHERE id=?').run(spec.username,spec.displayName,spec.role,JSON.stringify(spec.businessIds),spec.role==='superadmin'?null:`system:${spec.role}`,found.id);if(resetPasswords){const hashed=await passwordHash(password);db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').run(hashed.salt,hashed.hash,found.id)}}}
}
export function ensureSeedReceipts(db,reference=new Date()){if(db.prepare('SELECT count(*) count FROM receipts').get().count)return;for(const receipt of seedReceipts(reference))db.prepare('INSERT INTO receipts(id,actor_id,business_id,name,mime,bytes,result,created_at) VALUES(?,?,?,?,?,?,?,?)').run(receipt.id,receipt.actorId,receipt.businessId,receipt.name,receipt.mime,receipt.bytes,JSON.stringify(receipt.result),receipt.createdAt)}
function copyTemplates(db,business){for(const template of db.prepare('SELECT * FROM access_profile_templates').all())db.prepare('INSERT OR IGNORE INTO access_profiles VALUES(?,?,?,?,?)').run(randomUUID(),business,template.name,template.capabilities,template.menu_scope)}
function mergeCapabilities(stored,current){const merged=[...new Set([...stored,...current])];return merged.length===stored.length&&merged.every((value,index)=>value===stored[index])?null:merged}
function migrateProfiles(db){
  for(const [role,capabilities] of Object.entries(ROLE_CAPABILITIES)){
    const name=role[0].toUpperCase()+role.slice(1),id=`template:${role}`,existing=db.prepare('SELECT capabilities FROM access_profile_templates WHERE id=?').get(id);
    if(!existing)db.prepare('INSERT INTO access_profile_templates VALUES(?,?,?,?,?)').run(id,role,name,JSON.stringify(capabilities),JSON.stringify(DEFAULT_SCOPE));
    else{const merged=mergeCapabilities(JSON.parse(existing.capabilities),capabilities);if(merged)db.prepare('UPDATE access_profile_templates SET capabilities=? WHERE id=?').run(JSON.stringify(merged),id)}
    for(const {id:business} of db.prepare('SELECT id FROM tenants').all()){
      const profile=db.prepare('SELECT id,capabilities FROM access_profiles WHERE business_id=? AND name=?').get(business,name);
      if(!profile)db.prepare('INSERT INTO access_profiles VALUES(?,?,?,?,?)').run(randomUUID(),business,name,JSON.stringify(capabilities),JSON.stringify(DEFAULT_SCOPE));
      else{const merged=mergeCapabilities(JSON.parse(profile.capabilities),capabilities);if(merged)db.prepare('UPDATE access_profiles SET capabilities=? WHERE id=?').run(JSON.stringify(merged),profile.id)}
    }
  }
  for(const user of db.prepare("SELECT id,role,business_ids FROM users WHERE profile_id LIKE 'system:%'").all()){const businesses=JSON.parse(user.business_ids),business=businesses.find(id=>id!=='*'),profile=business&&db.prepare('SELECT id FROM access_profiles WHERE business_id=? AND name=?').get(business,user.role[0].toUpperCase()+user.role.slice(1));if(profile)db.prepare('UPDATE users SET profile_id=? WHERE id=?').run(profile.id,user.id)}
}

export function initializeSchema(db){db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL, business_ids TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, profile_id TEXT, active INTEGER NOT NULL DEFAULT 1); CREATE TABLE IF NOT EXISTS access_profiles (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, capabilities TEXT NOT NULL, menu_scope TEXT NOT NULL, UNIQUE(business_id,name)); CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY,name TEXT NOT NULL,location TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_username TEXT NOT NULL, actor_role TEXT NOT NULL, business_id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, business_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tenant_payment_qr (business_id TEXT PRIMARY KEY REFERENCES tenants(id),mime TEXT NOT NULL,bytes BLOB NOT NULL,updated_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tenant_printers (id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,host TEXT NOT NULL,port INTEGER NOT NULL DEFAULT 9100,paper_width INTEGER NOT NULL DEFAULT 80,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,UNIQUE(business_id,name)); CREATE TABLE IF NOT EXISTS tenant_print_settings (business_id TEXT PRIMARY KEY REFERENCES tenants(id),receipt_printer_id TEXT REFERENCES tenant_printers(id) ON DELETE SET NULL,kitchen_printer_id TEXT REFERENCES tenant_printers(id) ON DELETE SET NULL,auto_print_receipt INTEGER NOT NULL DEFAULT 1,auto_print_kitchen INTEGER NOT NULL DEFAULT 0,receipt_header TEXT NOT NULL DEFAULT \'\',updated_by TEXT,updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS tenant_printers_business ON tenant_printers(business_id);');const columns=db.prepare('PRAGMA table_info(users)').all();if(!columns.some(x=>x.name==='profile_id'))db.exec('ALTER TABLE users ADD COLUMN profile_id TEXT');if(!columns.some(x=>x.name==='active'))db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');const printColumns=db.prepare('PRAGMA table_info(tenant_print_settings)').all();if(!printColumns.some(x=>x.name==='receipt_header'))db.exec("ALTER TABLE tenant_print_settings ADD COLUMN receipt_header TEXT NOT NULL DEFAULT ''");for(const id of BUSINESS_IDS)db.prepare('INSERT OR IGNORE INTO tenants VALUES(?,?,?,1)').run(id,BUSINESS[id]?.name||id[0].toUpperCase()+id.slice(1),BUSINESS[id]?.location||'Indonesia')}

export async function openDatabase(filename=process.env.POS_DB_PATH||'sqlite.db'){
  const db=new DatabaseSync(filename);initializeSchema(db);db.exec('CREATE TABLE IF NOT EXISTS access_profile_templates (id TEXT PRIMARY KEY, role TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE, capabilities TEXT NOT NULL, menu_scope TEXT NOT NULL)');
  for(const {id} of db.prepare('SELECT id FROM tenants WHERE active=1').all())BUSINESSES.add(id);
  const receiptColumns=db.prepare('PRAGMA table_info(receipts)').all();if(receiptColumns.length&&!receiptColumns.some(column=>column.name==='business_id'))db.exec("ALTER TABLE receipts ADD COLUMN business_id TEXT NOT NULL DEFAULT 'harbor'");
  const found=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get();if(!found)db.prepare('INSERT INTO app_state(id,revision,data) VALUES(1,1,?)').run(JSON.stringify(seedState()));else{const parsed=JSON.parse(found.data),migrated=migrateEnvelope(parsed);if(!same(parsed,migrated))db.prepare('UPDATE app_state SET revision=?,data=? WHERE id=1').run(found.revision+1,JSON.stringify(migrated))}
  await ensureDevelopmentAccounts(db);migrateProfiles(db);ensureSeedReceipts(db);return db;
}

export async function createApp({db:providedDb,dbPath,now=()=>new Date(),secureCookies=process.env.NODE_ENV==='production',loginLimit=5,loginWindowMs=15*60_000,printerTransport=sendToPrinter}={}){
  const db=providedDb||await openDatabase(dbPath),attempts=new Map();
  const getUser=req=>{const token=parseCookies(req.headers.cookie).light_pos_session;if(!token)return null;const row=db.prepare('SELECT u.*,s.csrf_token,s.expires_at,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hashToken(token));if(!row||!row.active||new Date(row.expires_at)<=now()){if(row)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(row.token_hash);return null}const businessIds=JSON.parse(row.business_ids);if(!ROLES.has(row.role)||!Array.isArray(businessIds)||businessIds.some(id=>id!=='*'&&!BUSINESSES.has(id)))return null;const custom=row.profile_id&&!row.profile_id.startsWith('system:')?db.prepare('SELECT * FROM access_profiles WHERE id=?').get(row.profile_id):null,system=SYSTEM_PROFILES[row.profile_id]||SYSTEM_PROFILES[`system:${row.role}`],profile=custom?{id:custom.id,capabilities:JSON.parse(custom.capabilities),menuScope:JSON.parse(custom.menu_scope)}:system;return{id:row.id,username:row.username,name:row.display_name,role:row.role,businessIds,csrf:row.csrf_token,tokenHash:row.token_hash,profileId:profile?.id,capabilities:profile?.capabilities||ROLE_CAPABILITIES.admin,menuScope:profile?.menuScope||{mode:'all',categoryIds:[],itemIds:[]}}};
  const publicUser=user=>({id:user.id,username:user.username,name:user.name,role:user.role,businessIds:user.businessIds,csrfToken:user.csrf,profileId:user.profileId,capabilities:user.capabilities,menuScope:user.menuScope});
  const csrfOk=(req,user)=>text(req.headers['x-csrf-token'],200)&&safeEqual(req.headers['x-csrf-token'],user.csrf);
  const printerRow=row=>({id:row.id,name:row.name,host:row.host,port:row.port,paperWidth:row.paper_width,enabled:!!row.enabled,createdAt:row.created_at});
  const readPrintSettings=business=>{const row=db.prepare('SELECT receipt_printer_id receiptPrinterId,kitchen_printer_id kitchenPrinterId,auto_print_receipt autoPrintReceipt,auto_print_kitchen autoPrintKitchen,receipt_header receiptHeader,updated_at updatedAt FROM tenant_print_settings WHERE business_id=?').get(business);return{receiptPrinterId:row?.receiptPrinterId??null,kitchenPrinterId:row?.kitchenPrinterId??null,autoPrintReceipt:row?!!row.autoPrintReceipt:true,autoPrintKitchen:row?!!row.autoPrintKitchen:false,receiptHeader:row?.receiptHeader??'',updatedAt:row?.updatedAt??null}};
  const validPrinter=body=>isObject(body)&&text(body.name,60)&&body.name.trim()&&text(body.host,253)&&!body.host.includes('..')&&/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(body.host.trim())&&Number.isInteger(body.port)&&body.port>=1&&body.port<=65535&&PAPER_WIDTHS.has(body.paperWidth)&&typeof body.enabled==='boolean';
  const validPrintSettings=(body,business)=>isObject(body)&&typeof body.autoPrintReceipt==='boolean'&&typeof body.autoPrintKitchen==='boolean'&&text(body.receiptHeader??'',500)&&[body.receiptPrinterId,body.kitchenPrinterId].every(id=>id===null||typeof id==='string'&&!!db.prepare('SELECT id FROM tenant_printers WHERE id=? AND business_id=?').get(id,business));
  const recordAudit=(user,business,action,created)=>db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username,user.role,business,action,0,created);
  const handler=async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost'),method=req.method||'GET';
    if(method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true});
    if(method==='POST'&&url.pathname==='/api/login'){
      if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});
      const body=await readJson(req),username=typeof body.username==='string'?body.username.trim().toLowerCase():'',password=body.password,remote=req.socket.remoteAddress||'unknown',clientIp=(remote==='127.0.0.1'||remote==='::1'||remote==='::ffff:127.0.0.1')?String(req.headers['x-forwarded-for']||remote).split(',')[0].trim():remote,key=`${clientIp}:${username}`;
      for(const [attemptKey,value] of attempts)if(now().getTime()>=value.reset)attempts.delete(attemptKey);if(attempts.size>10000)attempts.delete(attempts.keys().next().value);
      const entry=attempts.get(key)||{count:0,reset:now().getTime()+loginWindowMs};if(now().getTime()>=entry.reset){entry.count=0;entry.reset=now().getTime()+loginWindowMs}if(entry.count>=loginLimit)return json(res,429,{error:'Too many login attempts. Try again later.'},{'retry-after':String(Math.ceil((entry.reset-now().getTime())/1000))});
      if(!text(username,100)||!text(password,200)||password.length<8)return json(res,400,{error:'Valid username and password are required.'});
      const row=db.prepare('SELECT * FROM users WHERE lower(username)=?').get(username),comparison=row||db.prepare('SELECT * FROM users LIMIT 1').get(),matches=comparison?await passwordMatches(password,comparison.password_salt,comparison.password_hash):false;if(!row||!matches){entry.count++;attempts.set(key,entry);return json(res,401,{error:'Invalid username or password.'})}attempts.delete(key);
      if(!row.active)return json(res,401,{error:'Invalid username or password.'});const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url'),created=now(),expires=new Date(created.getTime()+12*60*60_000),custom=row.profile_id&&!row.profile_id.startsWith('system:')?db.prepare('SELECT * FROM access_profiles WHERE id=?').get(row.profile_id):null,profile=custom?{id:custom.id,capabilities:JSON.parse(custom.capabilities),menuScope:JSON.parse(custom.menu_scope)}:SYSTEM_PROFILES[row.profile_id]||SYSTEM_PROFILES[`system:${row.role}`]||{id:null,capabilities:ROLE_CAPABILITIES.admin,menuScope:{mode:'all',categoryIds:[],itemIds:[]}};db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hashToken(token),row.id,csrf,expires.toISOString(),created.toISOString());return json(res,200,{user:publicUser({id:row.id,username:row.username,name:row.display_name,role:row.role,businessIds:JSON.parse(row.business_ids),csrf,profileId:profile.id,capabilities:profile.capabilities,menuScope:profile.menuScope})},{'set-cookie':`light_pos_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secureCookies?'; Secure':''}`});
    }
    const user=getUser(req);if(!user)return json(res,401,{error:'Authentication required.'});
    if(method==='GET'&&url.pathname==='/api/session')return json(res,200,{user:publicUser(user)});
    const business=url.searchParams.get('business');
    if(method==='POST'&&url.pathname==='/api/ai/menu-parsing'){
      if(!business||business==='all'||!canAccess(user,business)||!user.capabilities.includes('manageCatalog')||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
      if(req.headers['content-type']?.split(';')[0]!=='multipart/form-data')return json(res,400,{error:'Multipart upload required.'});const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);const webRequest=new Request(`http://localhost${req.url}`,{method:'POST',headers,body:Readable.toWeb(req),duplex:'half'}),form=await webRequest.formData(),files=await parseMenuPhotos(form.getAll('photos'));return json(res,200,await extractMenuPhotos(files));
    }
    if(method==='POST'&&url.pathname==='/api/menu'){
      if(!business||business==='all'||!canAccess(user,business)||!user.capabilities.includes('manageCatalog')||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});const body=await readJson(req);
      const valid=Array.isArray(body)&&body.length>0&&body.length<=100&&body.every(item=>isObject(item)&&Object.keys(item).every(key=>['name','description','category','price'].includes(key))&&text(item.name,200)&&item.name.trim()&&text(item.description,1000)&&text(item.category,100)&&item.category.trim()&&Number.isInteger(item.price)&&item.price>0),names=Array.isArray(body)?body.map(item=>String(item.name).trim().toLowerCase()):[];if(!valid||new Set(names).size!==names.length)return json(res,400,{error:'Invalid menu items or duplicate names.'});
      db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),envelope=migrateEnvelope(JSON.parse(row.data),now()),data=envelope.tenants[business],existing=new Set(data.menus.filter(item=>!item.archived).map(item=>(item.versions?.find(version=>version.version===item.currentVersion)?.name||item.name).trim().toLowerCase()));if(names.some(name=>existing.has(name))){db.exec('ROLLBACK');return json(res,409,{error:'An active menu with that name already exists.'})}const created=now().toISOString(),items=body.map(item=>{const id=randomUUID(),version={version:1,name:item.name.trim(),description:item.description.trim(),category:item.category.trim(),price:item.price,ingredients:[],createdAt:created};return{id,kind:'item',currentVersion:1,versions:[version],availability:'available',archived:false,icon:'◇',name:version.name,category:version.category,price:version.price,cost:0,available:true}}),revision=row.revision+1,action=`Imported ${items.length} menu item${items.length===1?'':'s'}`,audit=`${created.slice(0,16).replace('T',' ')} - ${user.name} (${user.role}) - ${action}`;data.menus.push(...items);data.audit=[audit,...data.audit].slice(0,1000);db.prepare('UPDATE app_state SET revision=?,data=? WHERE id=1').run(revision,JSON.stringify(envelope));db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username,user.role,business,action,revision,created);db.exec('COMMIT');return json(res,201,{createdIds:items.map(item=>item.id),revision,data})}catch(error){db.exec('ROLLBACK');throw error}
    }
    if(method==='GET'&&url.pathname==='/api/tenants'){const rows=canAccessAll(user)?db.prepare('SELECT id,name,location,active FROM tenants ORDER BY id').all():db.prepare(`SELECT id,name,location,active FROM tenants WHERE id IN (${user.businessIds.map(()=>'?').join(',')||"''"}) ORDER BY id`).all(...user.businessIds);return json(res,200,{tenants:rows.map(x=>({...x,active:!!x.active}))})}
    if(method==='POST'&&url.pathname==='/api/tenants'){if(!canAccessAll(user)||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});const body=await readJson(req);if(!text(body.id,50)||!text(body.name,100)||!text(body.location,100))return json(res,400,{error:'Invalid tenant.'});try{db.prepare('INSERT INTO tenants VALUES(?,?,?,1)').run(body.id,body.name,body.location);copyTemplates(db,body.id);BUSINESSES.add(body.id)}catch{return json(res,409,{error:'Tenant exists.'})}return json(res,201,{tenant:{...body,active:true}})}
    const tenantMatch=url.pathname.match(/^\/api\/tenants\/([^/]+)$/);if(method==='PUT'&&tenantMatch){if(!canAccessAll(user)||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});const body=await readJson(req),id=decodeURIComponent(tenantMatch[1]);if(!text(body.name,100)||!text(body.location,100)||typeof body.active!=='boolean'||!db.prepare('SELECT id FROM tenants WHERE id=?').get(id))return json(res,400,{error:'Invalid tenant.'});db.prepare('UPDATE tenants SET name=?,location=?,active=? WHERE id=?').run(body.name,body.location,body.active?1:0,id);if(body.active)BUSINESSES.add(id);else BUSINESSES.delete(id);return json(res,200,{tenant:{id,...body}})}
    if(method==='GET'&&url.pathname==='/api/access-profile-templates'){if(!canAccessAll(user))return json(res,403,{error:'Access denied.'});return json(res,200,{profiles:db.prepare('SELECT * FROM access_profile_templates ORDER BY name').all().map(row=>({id:row.id,name:row.name,capabilities:JSON.parse(row.capabilities),menuScope:JSON.parse(row.menu_scope)})),capabilities:[...EDITABLE_CAPABILITIES]})}
    const templateMatch=url.pathname.match(/^\/api\/access-profile-templates\/([^/]+)$/);if(method==='PUT'&&templateMatch){if(!canAccessAll(user)||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});const body=await readJson(req),id=decodeURIComponent(templateMatch[1]);if(!validProfile(body)||!db.prepare('SELECT id FROM access_profile_templates WHERE id=?').get(id))return json(res,400,{error:'Invalid template role.'});try{db.prepare('UPDATE access_profile_templates SET name=?,capabilities=?,menu_scope=? WHERE id=?').run(body.name.trim(),JSON.stringify(body.capabilities),JSON.stringify(body.menuScope),id)}catch{return json(res,409,{error:'Template role name already exists.'})}return json(res,200,{profile:{id,name:body.name.trim(),capabilities:body.capabilities,menuScope:body.menuScope}})}
    if(method==='GET'&&url.pathname==='/api/access-profiles'){if(!user.capabilities.includes('viewAccessProfiles')||!business||!canAccess(user,business))return json(res,403,{error:'Access denied.'});const custom=db.prepare('SELECT * FROM access_profiles WHERE business_id=? ORDER BY name').all(business).map(row=>({id:row.id,name:row.name,protected:false,capabilities:JSON.parse(row.capabilities),menuScope:JSON.parse(row.menu_scope),assignedCount:db.prepare('SELECT count(*) count FROM users WHERE profile_id=?').get(row.id).count}));return json(res,200,{profiles:custom,capabilities:[...EDITABLE_CAPABILITIES]})}
    if(method==='POST'&&url.pathname==='/api/access-profiles'){if(!csrfOk(req,user)||!user.capabilities.includes('editAccessProfiles'))return json(res,403,{error:'Access denied.'});const body=await readJson(req),scope=body.menuScope;if(!canAccess(user,body.business)||!validProfile(body))return json(res,400,{error:'Invalid access profile or edit permission without its matching view permission.'});const id=randomUUID();try{db.prepare('INSERT INTO access_profiles VALUES(?,?,?,?,?)').run(id,body.business,body.name.trim(),JSON.stringify(body.capabilities),JSON.stringify(scope))}catch{return json(res,409,{error:'Profile name already exists.'})}return json(res,201,{profile:{id,name:body.name.trim(),protected:false,capabilities:body.capabilities,menuScope:scope}})}
    const profileMatch=url.pathname.match(/^\/api\/access-profiles\/([^/]+)$/);if(method==='DELETE'&&profileMatch){if(!csrfOk(req,user)||!user.capabilities.includes('editAccessProfiles'))return json(res,403,{error:'Access denied.'});const body=await readJson(req),id=decodeURIComponent(profileMatch[1]);if(id.startsWith('system:'))return json(res,403,{error:'System profiles are protected.'});if(!canAccess(user,body.business)||!db.prepare('SELECT id FROM access_profiles WHERE id=? AND business_id=?').get(id,body.business))return json(res,404,{error:'Profile not found.'});if(db.prepare('SELECT count(*) count FROM users WHERE profile_id=?').get(id).count)return json(res,409,{error:'Reassign users before deleting this profile.'});db.prepare('DELETE FROM access_profiles WHERE id=?').run(id);return json(res,200,{ok:true})}
    if(method==='PUT'&&profileMatch){if(!csrfOk(req,user)||!user.capabilities.includes('editAccessProfiles'))return json(res,403,{error:'Access denied.'});const body=await readJson(req),id=decodeURIComponent(profileMatch[1]);if(id.startsWith('system:'))return json(res,403,{error:'System profiles are protected.'});if(!canAccess(user,body.business)||!db.prepare('SELECT id FROM access_profiles WHERE id=? AND business_id=?').get(id,body.business))return json(res,404,{error:'Profile not found.'});if(!validProfile(body))return json(res,400,{error:'Invalid access profile or edit permission without its matching view permission.'});try{db.prepare('UPDATE access_profiles SET name=?,capabilities=?,menu_scope=? WHERE id=?').run(body.name.trim(),JSON.stringify(body.capabilities),JSON.stringify(body.menuScope),id)}catch{return json(res,409,{error:'Profile name already exists.'})}db.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE profile_id=?)').run(id);return json(res,200,{profile:{id,name:body.name.trim(),protected:false,capabilities:body.capabilities,menuScope:body.menuScope}})}
    if(method==='GET'&&url.pathname==='/api/users'){if(!user.capabilities.includes('viewAccessProfiles')||!business||!canAccess(user,business))return json(res,403,{error:'Access denied.'});return json(res,200,{users:db.prepare("SELECT id,username,display_name displayName,profile_id profileId,active FROM users WHERE business_ids=? ORDER BY display_name").all(JSON.stringify([business])).map(row=>({...row,active:!!row.active}))})}
    if(method==='POST'&&url.pathname==='/api/users'){if(!csrfOk(req,user)||!user.capabilities.includes('editAccessProfiles'))return json(res,403,{error:'Access denied.'});const body=await readJson(req),fallback=ROLE_CAPABILITIES[body.role]&&db.prepare('SELECT id FROM access_profiles WHERE business_id=? AND name=?').get(body.business,body.role[0].toUpperCase()+body.role.slice(1)),profileId=body.profileId||fallback?.id,profile=profileId&&db.prepare('SELECT * FROM access_profiles WHERE id=? AND business_id=?').get(profileId,body.business);if(!canAccess(user,body.business)||!profile||!text(body.username,100)||!text(body.displayName,100)||!text(body.password,200)||body.password.length<8)return json(res,400,{error:'Invalid user.'});const role=profile.role||'cashier',hashed=await passwordHash(body.password),id=randomUUID();try{db.prepare('INSERT INTO users(id,username,display_name,role,business_ids,password_salt,password_hash,profile_id) VALUES(?,?,?,?,?,?,?,?)').run(id,body.username.trim().toLowerCase(),body.displayName.trim(),role,JSON.stringify([body.business]),hashed.salt,hashed.hash,profileId)}catch{return json(res,409,{error:'Username already exists.'})}return json(res,201,{user:{id,username:body.username.trim().toLowerCase(),displayName:body.displayName.trim(),profileId:body.profileId,active:true}})}
    const userPassword=url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);if(method==='PUT'&&userPassword){if(!csrfOk(req,user)||!user.capabilities.includes('editAccessProfiles'))return json(res,403,{error:'Access denied.'});const body=await readJson(req),target=db.prepare('SELECT id FROM users WHERE id=? AND business_ids=?').get(decodeURIComponent(userPassword[1]),JSON.stringify([body.business]));if(!target||!text(body.password,200)||body.password.length<8)return json(res,400,{error:'Invalid password reset.'});const hashed=await passwordHash(body.password);db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').run(hashed.salt,hashed.hash,target.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);return json(res,200,{ok:true})}
    const userMatch=url.pathname.match(/^\/api\/users\/([^/]+)$/);if(method==='PUT'&&userMatch){if(!csrfOk(req,user)||!user.capabilities.includes('editAccessProfiles'))return json(res,403,{error:'Access denied.'});const body=await readJson(req),target=db.prepare('SELECT id FROM users WHERE id=? AND business_ids=?').get(decodeURIComponent(userMatch[1]),JSON.stringify([body.business])),profileId=body.profileId||`system:${body.role}`,profile=SYSTEM_PROFILES[profileId]||db.prepare('SELECT id FROM access_profiles WHERE id=? AND business_id=?').get(profileId,body.business);if(!target||!profile||!text(body.displayName,100)||typeof body.active!=='boolean')return json(res,400,{error:'Invalid user.'});const role=profileId.startsWith('system:')?profileId.slice(7):'cashier';db.prepare('UPDATE users SET display_name=?,role=?,profile_id=?,active=? WHERE id=?').run(body.displayName.trim(),role,profileId,body.active?1:0,target.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);return json(res,200,{user:{id:target.id,displayName:body.displayName.trim(),profileId,active:body.active}})}
    if(method==='DELETE'&&url.pathname==='/api/session'){if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.tokenHash);return json(res,200,{ok:true},{'set-cookie':`light_pos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies?'; Secure':''}`})}
    if(url.pathname==='/api/payment-qr'||url.pathname==='/api/payment-qr/image'){
      if(!business||business==='all'||!canAccess(user,business))return json(res,403,{error:'Business access denied.'});
      const row=db.prepare('SELECT mime,bytes,updated_at updatedAt FROM tenant_payment_qr WHERE business_id=?').get(business);
      if(method==='GET'&&url.pathname==='/api/payment-qr')return json(res,200,row?{configured:true,mime:row.mime,updatedAt:row.updatedAt}:{configured:false});
      if(method==='GET'&&url.pathname==='/api/payment-qr/image'){if(!row)return json(res,404,{error:'Payment QR not configured.'});res.writeHead(200,{'content-type':row.mime,'content-length':row.bytes.length,'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});return res.end(row.bytes)}
      if(!['admin','superadmin'].includes(user.role)||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
      const created=now().toISOString(),audit=action=>db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username,user.role,business,action,0,created);
      if(method==='PUT'){const image=await readPaymentQr(req),action=row?'Payment QR replaced':'Payment QR added';db.prepare('INSERT INTO tenant_payment_qr VALUES(?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET mime=excluded.mime,bytes=excluded.bytes,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(business,image.mime,image.bytes,user.id,created);audit(action);return json(res,200,{configured:true,mime:image.mime,updatedAt:created})}
      if(method==='DELETE'){db.prepare('DELETE FROM tenant_payment_qr WHERE business_id=?').run(business);if(row)audit('Payment QR removed');return json(res,200,{configured:false})}
    }
    if(url.pathname==='/api/printers'||url.pathname.startsWith('/api/printers/')||url.pathname==='/api/print-settings'||url.pathname==='/api/print'||url.pathname==='/api/receipt-header'){
      const adminOnly=()=>['admin','superadmin'].includes(user.role);
      if(method==='GET'&&url.pathname==='/api/receipt-header'){
        if(!business||business==='all'||!canAccess(user,business))return json(res,403,{error:'Business access denied.'});
        if(!['cashier','manager','admin','superadmin'].includes(user.role))return json(res,403,{error:'Access denied.'});
        return json(res,200,{header:readPrintSettings(business).receiptHeader});
      }
      if(method==='GET'&&url.pathname==='/api/printers'){
        if(!business||business==='all'||!canAccess(user,business))return json(res,403,{error:'Business access denied.'});
        if(!['admin','superadmin','manager','cashier','kitchen'].includes(user.role))return json(res,403,{error:'Access denied.'});
        return json(res,200,{printers:db.prepare('SELECT * FROM tenant_printers WHERE business_id=? ORDER BY name').all(business).map(printerRow),settings:readPrintSettings(business),paperWidths:[...PAPER_WIDTHS]});
      }
      if(method==='POST'&&url.pathname==='/api/printers'){
        if(!adminOnly()||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
        const body=await readJson(req);
        if(!business||business==='all'||!canAccess(user,business)||!validPrinter(body))return json(res,400,{error:'Invalid printer.'});
        const id=randomUUID(),created=now().toISOString();
        try{db.prepare('INSERT INTO tenant_printers VALUES(?,?,?,?,?,?,?,?)').run(id,business,body.name.trim(),body.host.trim(),body.port,body.paperWidth,body.enabled?1:0,created)}catch{return json(res,409,{error:'A printer with that name already exists.'})}
        recordAudit(user,business,`Printer ${body.name.trim()} added`,created);
        return json(res,201,{printer:printerRow(db.prepare('SELECT * FROM tenant_printers WHERE id=?').get(id))});
      }
      const printerMatch=url.pathname.match(/^\/api\/printers\/([^/]+)$/),printerTest=url.pathname.match(/^\/api\/printers\/([^/]+)\/test$/);
      if(method==='POST'&&printerTest){
        if(!adminOnly()||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
        const row=db.prepare('SELECT * FROM tenant_printers WHERE id=?').get(decodeURIComponent(printerTest[1]));
        if(!row||!canAccess(user,row.business_id))return json(res,404,{error:'Printer not found.'});
        const tenant=db.prepare('SELECT name,location FROM tenants WHERE id=?').get(row.business_id),printer=printerRow(row);
        try{await printerTransport(printer,renderPrintJob({type:'test',business:tenant,printer,paperWidth:row.paper_width}))}catch(error){return json(res,502,{error:error.message})}
        recordAudit(user,row.business_id,`Test ticket sent to ${row.name}`,now().toISOString());
        return json(res,200,{ok:true,printerName:row.name});
      }
      if(method==='PUT'&&printerMatch){
        if(!adminOnly()||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
        const row=db.prepare('SELECT * FROM tenant_printers WHERE id=?').get(decodeURIComponent(printerMatch[1]));
        if(!row||!canAccess(user,row.business_id))return json(res,404,{error:'Printer not found.'});
        const body=await readJson(req);
        if(!validPrinter(body))return json(res,400,{error:'Invalid printer.'});
        try{db.prepare('UPDATE tenant_printers SET name=?,host=?,port=?,paper_width=?,enabled=? WHERE id=?').run(body.name.trim(),body.host.trim(),body.port,body.paperWidth,body.enabled?1:0,row.id)}catch{return json(res,409,{error:'A printer with that name already exists.'})}
        recordAudit(user,row.business_id,`Printer ${body.name.trim()} updated`,now().toISOString());
        return json(res,200,{printer:printerRow(db.prepare('SELECT * FROM tenant_printers WHERE id=?').get(row.id))});
      }
      if(method==='DELETE'&&printerMatch){
        if(!adminOnly()||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
        const row=db.prepare('SELECT * FROM tenant_printers WHERE id=?').get(decodeURIComponent(printerMatch[1]));
        if(!row||!canAccess(user,row.business_id))return json(res,404,{error:'Printer not found.'});
        db.exec('BEGIN IMMEDIATE');
        try{db.prepare('UPDATE tenant_print_settings SET receipt_printer_id=NULL WHERE receipt_printer_id=?').run(row.id);db.prepare('UPDATE tenant_print_settings SET kitchen_printer_id=NULL WHERE kitchen_printer_id=?').run(row.id);db.prepare('DELETE FROM tenant_printers WHERE id=?').run(row.id);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
        recordAudit(user,row.business_id,`Printer ${row.name} removed`,now().toISOString());
        return json(res,200,{ok:true});
      }
      if(method==='PUT'&&url.pathname==='/api/print-settings'){
        if(!adminOnly()||!csrfOk(req,user))return json(res,403,{error:'Access denied.'});
        const body=await readJson(req);
        if(!business||business==='all'||!canAccess(user,business)||!validPrintSettings(body,business))return json(res,400,{error:'Invalid print settings.'});
        const created=now().toISOString();
        db.prepare('INSERT INTO tenant_print_settings (business_id,receipt_printer_id,kitchen_printer_id,auto_print_receipt,auto_print_kitchen,receipt_header,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET receipt_printer_id=excluded.receipt_printer_id,kitchen_printer_id=excluded.kitchen_printer_id,auto_print_receipt=excluded.auto_print_receipt,auto_print_kitchen=excluded.auto_print_kitchen,receipt_header=excluded.receipt_header,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(business,body.receiptPrinterId,body.kitchenPrinterId,body.autoPrintReceipt?1:0,body.autoPrintKitchen?1:0,body.receiptHeader??'',user.id,created);
        recordAudit(user,business,'Print settings updated',created);
        return json(res,200,{settings:readPrintSettings(business)});
      }
      if(method==='POST'&&url.pathname==='/api/print'){
        if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});
        const body=await readJson(req);
        if(!business||business==='all'||!canAccess(user,business))return json(res,403,{error:'Business access denied.'});
        if(!['cashier','manager','admin','superadmin','kitchen'].includes(user.role)||!PRINT_TYPES.has(body.type)||typeof body.auto!=='boolean'||!text(body.orderId,100))return json(res,400,{error:'Invalid print request.'});
        if(user.role==='kitchen'&&body.type!=='kitchen')return json(res,403,{error:'Access denied.'});
        const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),data=migrateEnvelope(JSON.parse(row.data),now()).tenants[business],order=data.orders.find(item=>item.id===body.orderId);
        if(!order)return json(res,404,{error:'Order not found.'});
        const settings=readPrintSettings(business),enabled=body.type==='receipt'?settings.autoPrintReceipt:settings.autoPrintKitchen;
        if(body.auto&&!enabled)return json(res,200,{printed:false,reason:'auto-disabled'});
        const printerId=body.type==='receipt'?settings.receiptPrinterId:settings.kitchenPrinterId;
        if(!printerId)return json(res,200,{printed:false,reason:'no-printer'});
        const printer=db.prepare('SELECT * FROM tenant_printers WHERE id=? AND business_id=?').get(printerId,business);
        if(!printer)return json(res,200,{printed:false,reason:'no-printer'});
        if(!printer.enabled)return json(res,200,{printed:false,reason:'printer-disabled'});
        const tenant=db.prepare('SELECT name,location FROM tenants WHERE id=?').get(business),tables=(order.tableIds||[]).map(id=>data.tables.find(table=>table.id===id)?.name||id).join(', ')||order.table||'';
        try{await printerTransport(printerRow(printer),renderPrintJob({type:body.type,order,business:tenant,tables,paperWidth:printer.paper_width,header:settings.receiptHeader}))}catch(error){return json(res,502,{error:error.message})}
        if(!body.auto)recordAudit(user,business,`${body.type==='receipt'?'Receipt':'Kitchen ticket'} printed for ${order.id} on ${printer.name}`,now().toISOString());
        return json(res,200,{printed:true,printerId:printer.id,printerName:printer.name});
      }
    }
    if(method==='GET'&&url.pathname==='/api/receipts'){
      const business=url.searchParams.get('business')||user.businessIds[0];if(!['manager','admin','superadmin'].includes(user.role))return json(res,403,{error:'Action is not allowed for this role.'});if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});const receipts=db.prepare('SELECT id,business_id businessId,name,mime,result,created_at createdAt FROM receipts WHERE business_id=? ORDER BY created_at DESC').all(business).map(row=>({...row,result:JSON.parse(row.result)}));return json(res,200,{receipts});
    }
    if(method==='POST'&&url.pathname==='/api/receipts'){
      const business=url.searchParams.get('business')||user.businessIds[0];if(!['manager','admin','superadmin'].includes(user.role))return json(res,403,{error:'Action is not allowed for this role.'});if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});if(!process.env.POS_RECEIPT_PARSER_URL)return json(res,503,{error:'Receipt parser is not configured.'});
      const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);const webRequest=new Request(`http://localhost${req.url}`,{method:'POST',headers,body:Readable.toWeb(req),duplex:'half'});
      const upload=createReceiptUpload({authorize:async()=>true,parse:async({bytes,mime})=>{const response=await fetch(process.env.POS_RECEIPT_PARSER_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mime,image:Buffer.from(bytes).toString('base64')})});if(!response.ok)throw Error('Parser failed');return response.json()},store:async record=>db.prepare('INSERT INTO receipts(id,actor_id,business_id,name,mime,bytes,result,created_at) VALUES(?,?,?,?,?,?,?,?)').run(record.id,user.id,business,record.name,record.mime,record.bytes,JSON.stringify(record.result),record.createdAt)}),response=await upload(webRequest);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if(method==='GET'&&url.pathname==='/api/state'){const business=url.searchParams.get('business')||(canAccessAll(user)?'all':user.businessIds[0]);if(business==='all'){if(!canAccessAll(user))return json(res,403,{error:'Business access denied.'})}else if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),envelope=migrateEnvelope(JSON.parse(row.data),now()),data=business==='all'?allData(envelope):envelope.tenants[business];if(business!=='all'&&user.menuScope.mode==='limited'){const allowed=id=>{const item=data.menus.find(x=>x.id===id);if(!item||!user.menuScope.categoryIds.includes(item.category)&&!user.menuScope.itemIds.includes(id))return false;if((item.kind||'item')!=='bundle')return true;return item.versions?.find(v=>v.version===item.currentVersion)?.components?.every(component=>allowed(component.menuId))===true};data.menus=data.menus.filter(item=>allowed(item.id));data.experiments=data.experiments.map(experiment=>({...experiment,menuDrafts:experiment.menuDrafts.filter(item=>allowed(item.id))}))}return json(res,200,{revision:row.revision,data})}
    if(method==='PUT'&&url.pathname==='/api/state'){
      if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});const body=await readJson(req),business=body.business;
      if(!Number.isInteger(body.revision)||!BUSINESSES.has(business)||!validState(body.data,business)||!text(body.action,200)||!body.action.trim())return json(res,400,{error:'Invalid state mutation.'});if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});
      db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),envelope=migrateEnvelope(JSON.parse(row.data),now()),before=envelope.tenants[business];if(row.revision!==body.revision){db.exec('ROLLBACK');return json(res,409,{error:'State changed on the server.',revision:row.revision,data:before})}const candidate={...body.data,audit:before.audit},denied=authorizeMutation(user,business,before,candidate);if(denied){db.exec('ROLLBACK');return json(res,403,{error:denied})}const created=now().toISOString(),revision=row.revision+1,action=body.action.trim(),audit=`${created.slice(0,16).replace('T',' ')} - ${user.name} (${user.role}) - ${action}`,data={...candidate,audit:[audit,...before.audit].slice(0,1000)};envelope.tenants[business]=data;db.prepare('UPDATE app_state SET revision=?,data=? WHERE id=1').run(revision,JSON.stringify(envelope));db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username,user.role,business,action,revision,created);db.exec('COMMIT');return json(res,200,{revision,data})}catch(error){db.exec('ROLLBACK');throw error}
    }
    return json(res,404,{error:'Not found.'});
  }catch(error){return json(res,error.status||500,{error:error.status?error.message:'Internal server error.'})}};
  return{db,handler,close:()=>db.close()};
}
