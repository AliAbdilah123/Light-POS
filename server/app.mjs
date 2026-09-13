import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {hashToken,passwordHash,passwordMatches,safeEqual} from './auth.mjs';
import {seedReceipts,seedState} from './seed.mjs';
import {createReceiptUpload} from './receiptUpload.mjs';

const ROLES=new Set(['cashier','manager','admin','superadmin','kitchen','display']);
export const BUSINESS_IDS=['harbor','garden','north'];
const BUSINESSES=new Set(BUSINESS_IDS);
const MUTABLE={cashier:new Set(['orders','notes','leaves','messagesRead','tables']),manager:new Set(['orders','notes','expenses','inventory','sopHistory','tables']),admin:null,superadmin:null,kitchen:new Set(['orders','menus','experiments']),display:new Set()};
const REQUIRED=['orders','orderTypes','tables','menus','experiments','coupons','notes','expenses','leaves','staff','shifts','inventory','sops','sopHistory','messages','messagesRead','audit','targets','planningNotes','schedules'];
const ARRAY_KEYS=REQUIRED.filter(key=>!['targets','planningNotes','schedules'].includes(key));
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=300)=>typeof value==='string'&&value.length<=max;
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
function operationalOrdersSafe(before,after){const oldById=new Map(before.orders.map(order=>[order.id,order])),newById=new Map(after.orders.map(order=>[order.id,order]));for(const old of before.orders){const current=newById.get(old.id);if(!current){if(old.status!=='Held')return false;continue}if(same(old,current))continue;if(current.status==='Voided'&&text(current.voidReason,300)&&current.voidReason.trim()&&same({...old,status:'Voided',voidReason:current.voidReason},current))continue;if(old.status==='Completed'&&current.status==='Held'&&Date.now()-new Date(old.createdAt).getTime()<300000){const expected={...old,status:'Held'};delete expected.payment;if(same(expected,current))continue}return false}return after.orders.filter(order=>!oldById.has(order.id)).every(order=>validNewOrder(order,after))}
function statusOnlyTables(before,after){if(before.tables.length!==after.tables.length)return false;const oldById=new Map(before.tables.map(table=>[table.id,table]));return after.tables.every(table=>{const old=oldById.get(table.id);return old&&same({...old,status:table.status},table)})}
function kitchenSafe(before,after){
  const oldOrders=new Map(before.orders.map(order=>[order.id,order]));
  if(after.orders.length!==before.orders.length||after.orders.some(order=>{const old=oldOrders.get(order.id);return !old||(!same(old,order)&&!(old.status==='Preparing'&&order.status==='Ready'&&same({...old,status:'Ready'},order)))}))return false;
  const availabilityOnly=(old,item)=>old&&same({...old,availability:item.availability},item),oldMenus=new Map(before.menus.map(item=>[item.id,item]));
  if(after.menus.length!==before.menus.length||after.menus.some(item=>!availabilityOnly(oldMenus.get(item.id),item)))return false;
  return after.experiments.every((experiment,index)=>{const old=before.experiments[index];if(!old||experiment.id!==old.id||experiment.menuDrafts?.length!==old.menuDrafts?.length)return same(experiment,old);const oldDrafts=new Map(old.menuDrafts.map(item=>[item.id,item]));return same({...old,menuDrafts:experiment.menuDrafts},experiment)&&experiment.menuDrafts.every(item=>availabilityOnly(oldDrafts.get(item.id),item))});
}
function authorizeMutation(user,business,before,after){
  if(!canAccess(user,business))return 'Business access denied.';
  const changed=changedKeys(before,after),allowed=MUTABLE[user.role];
  if(!changed.length)return 'No changes supplied.';
  if(allowed&&changed.some(key=>!allowed.has(key)))return 'Action is not allowed for this role.';
  if(['cashier','manager'].includes(user.role)&&changed.includes('orders')&&!operationalOrdersSafe(before,after))return 'Order mutation is not allowed.';
  if(['cashier','manager'].includes(user.role)&&changed.includes('tables')&&!statusOnlyTables(before,after))return 'Only table status may be changed.';
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

function migrateEnvelope(raw,reference=new Date()){
  if(raw?.schemaVersion===2&&isObject(raw.tenants)&&BUSINESS_IDS.every(id=>isObject(raw.tenants[id])))return raw;
  const seeded=seedState(reference),legacy=isObject(raw)?raw:{};
  for(const business of BUSINESS_IDS){const target=seeded.tenants[business];if(Array.isArray(legacy.orders)){const orders=legacy.orders.filter(order=>order.businessId===business);if(orders.length)target.orders=orders}}
  const harbor=seeded.tenants.harbor;for(const key of REQUIRED)if(key!=='orders'&&key in legacy)harbor[key]=legacy[key];harbor.targets={harbor:number(legacy.targets?.harbor)?legacy.targets.harbor:harbor.targets.harbor};
  for(const order of harbor.orders)order.businessId='harbor';
  return seeded;
}
function allData(envelope){
  const result=Object.fromEntries(REQUIRED.map(key=>[key,ARRAY_KEYS.includes(key)?[]:{}]));
  for(const business of BUSINESS_IDS){const tenant=envelope.tenants[business];for(const key of ARRAY_KEYS){if(['sopHistory','messagesRead','audit'].includes(key))result[key].push(...tenant[key].map(value=>`[${business}] ${value}`));else result[key].push(...tenant[key].map(value=>isObject(value)?{...value,businessId:business}:value))}Object.assign(result.targets,tenant.targets);for(const [key,value] of Object.entries(tenant.planningNotes))result.planningNotes[`${business}:${key}`]=value;for(const [key,value] of Object.entries(tenant.schedules))result.schedules[`${business}:${key}`]=value}
  return result;
}

export async function ensureDevelopmentAccounts(db,{resetPasswords=false}={}){
  const configured=process.env.POS_SEED_PASSWORD,password=configured||'light-pos-demo';
  for(const spec of developmentAccounts()){const found=db.prepare('SELECT id FROM users WHERE id=? OR lower(username)=lower(?)').get(spec.id,spec.username);if(process.env.NODE_ENV==='production'&&!found&&(!configured||configured.length<12))throw Error('POS_SEED_PASSWORD (at least 12 characters) is required to create production seed accounts.');if(!found){const hashed=await passwordHash(password);db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(spec.id,spec.username,spec.displayName,spec.role,JSON.stringify(spec.businessIds),hashed.salt,hashed.hash)}else{db.prepare('UPDATE users SET username=?,display_name=?,role=?,business_ids=? WHERE id=?').run(spec.username,spec.displayName,spec.role,JSON.stringify(spec.businessIds),found.id);if(resetPasswords){const hashed=await passwordHash(password);db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').run(hashed.salt,hashed.hash,found.id)}}}
}
export function ensureSeedReceipts(db,reference=new Date()){if(db.prepare('SELECT count(*) count FROM receipts').get().count)return;for(const receipt of seedReceipts(reference))db.prepare('INSERT INTO receipts(id,actor_id,business_id,name,mime,bytes,result,created_at) VALUES(?,?,?,?,?,?,?,?)').run(receipt.id,receipt.actorId,receipt.businessId,receipt.name,receipt.mime,receipt.bytes,JSON.stringify(receipt.result),receipt.createdAt)}

export function initializeSchema(db){db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL, business_ids TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_username TEXT NOT NULL, actor_role TEXT NOT NULL, business_id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, business_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL);')}

export async function openDatabase(filename=process.env.POS_DB_PATH||'sqlite.db'){
  const db=new DatabaseSync(filename);initializeSchema(db);
  const receiptColumns=db.prepare('PRAGMA table_info(receipts)').all();if(receiptColumns.length&&!receiptColumns.some(column=>column.name==='business_id'))db.exec("ALTER TABLE receipts ADD COLUMN business_id TEXT NOT NULL DEFAULT 'harbor'");
  const found=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get();if(!found)db.prepare('INSERT INTO app_state(id,revision,data) VALUES(1,1,?)').run(JSON.stringify(seedState()));else{const parsed=JSON.parse(found.data),migrated=migrateEnvelope(parsed);if(!same(parsed,migrated))db.prepare('UPDATE app_state SET revision=?,data=? WHERE id=1').run(found.revision+1,JSON.stringify(migrated))}
  await ensureDevelopmentAccounts(db);ensureSeedReceipts(db);return db;
}

export async function createApp({db:providedDb,dbPath,now=()=>new Date(),secureCookies=process.env.NODE_ENV==='production',loginLimit=5,loginWindowMs=15*60_000}={}){
  const db=providedDb||await openDatabase(dbPath),attempts=new Map();
  const getUser=req=>{const token=parseCookies(req.headers.cookie).light_pos_session;if(!token)return null;const row=db.prepare('SELECT u.*,s.csrf_token,s.expires_at,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hashToken(token));if(!row||new Date(row.expires_at)<=now()){if(row)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(row.token_hash);return null}const businessIds=JSON.parse(row.business_ids);if(!ROLES.has(row.role)||!Array.isArray(businessIds)||businessIds.some(id=>id!=='*'&&!BUSINESSES.has(id)))return null;return{id:row.id,username:row.username,name:row.display_name,role:row.role,businessIds,csrf:row.csrf_token,tokenHash:row.token_hash}};
  const publicUser=user=>({id:user.id,username:user.username,name:user.name,role:user.role,businessIds:user.businessIds,csrfToken:user.csrf});
  const csrfOk=(req,user)=>text(req.headers['x-csrf-token'],200)&&safeEqual(req.headers['x-csrf-token'],user.csrf);
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
      const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url'),created=now(),expires=new Date(created.getTime()+12*60*60_000);db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hashToken(token),row.id,csrf,expires.toISOString(),created.toISOString());return json(res,200,{user:publicUser({id:row.id,username:row.username,name:row.display_name,role:row.role,businessIds:JSON.parse(row.business_ids),csrf})},{'set-cookie':`light_pos_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secureCookies?'; Secure':''}`});
    }
    const user=getUser(req);if(!user)return json(res,401,{error:'Authentication required.'});
    if(method==='GET'&&url.pathname==='/api/session')return json(res,200,{user:publicUser(user)});
    if(method==='DELETE'&&url.pathname==='/api/session'){if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.tokenHash);return json(res,200,{ok:true},{'set-cookie':`light_pos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies?'; Secure':''}`})}
    if(method==='GET'&&url.pathname==='/api/receipts'){
      const business=url.searchParams.get('business')||user.businessIds[0];if(!['manager','admin','superadmin'].includes(user.role))return json(res,403,{error:'Action is not allowed for this role.'});if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});const receipts=db.prepare('SELECT id,business_id businessId,name,mime,result,created_at createdAt FROM receipts WHERE business_id=? ORDER BY created_at DESC').all(business).map(row=>({...row,result:JSON.parse(row.result)}));return json(res,200,{receipts});
    }
    if(method==='POST'&&url.pathname==='/api/receipts'){
      const business=url.searchParams.get('business')||user.businessIds[0];if(!['manager','admin','superadmin'].includes(user.role))return json(res,403,{error:'Action is not allowed for this role.'});if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});if(!process.env.POS_RECEIPT_PARSER_URL)return json(res,503,{error:'Receipt parser is not configured.'});
      const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);const webRequest=new Request(`http://localhost${req.url}`,{method:'POST',headers,body:Readable.toWeb(req),duplex:'half'});
      const upload=createReceiptUpload({authorize:async()=>true,parse:async({bytes,mime})=>{const response=await fetch(process.env.POS_RECEIPT_PARSER_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mime,image:Buffer.from(bytes).toString('base64')})});if(!response.ok)throw Error('Parser failed');return response.json()},store:async record=>db.prepare('INSERT INTO receipts(id,actor_id,business_id,name,mime,bytes,result,created_at) VALUES(?,?,?,?,?,?,?,?)').run(record.id,user.id,business,record.name,record.mime,record.bytes,JSON.stringify(record.result),record.createdAt)}),response=await upload(webRequest);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if(method==='GET'&&url.pathname==='/api/state'){const business=url.searchParams.get('business')||(canAccessAll(user)?'all':user.businessIds[0]);if(business==='all'){if(!canAccessAll(user))return json(res,403,{error:'Business access denied.'})}else if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),envelope=migrateEnvelope(JSON.parse(row.data),now());return json(res,200,{revision:row.revision,data:business==='all'?allData(envelope):envelope.tenants[business]})}
    if(method==='PUT'&&url.pathname==='/api/state'){
      if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});const body=await readJson(req),business=body.business;
      if(!Number.isInteger(body.revision)||!BUSINESSES.has(business)||!validState(body.data,business)||!text(body.action,200)||!body.action.trim())return json(res,400,{error:'Invalid state mutation.'});if(!canAccess(user,business))return json(res,403,{error:'Business access denied.'});
      db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),envelope=migrateEnvelope(JSON.parse(row.data),now()),before=envelope.tenants[business];if(row.revision!==body.revision){db.exec('ROLLBACK');return json(res,409,{error:'State changed on the server.',revision:row.revision,data:before})}const candidate={...body.data,audit:before.audit},denied=authorizeMutation(user,business,before,candidate);if(denied){db.exec('ROLLBACK');return json(res,403,{error:denied})}const created=now().toISOString(),revision=row.revision+1,action=body.action.trim(),audit=`${created.slice(0,16).replace('T',' ')} - ${user.name} (${user.role}) - ${action}`,data={...candidate,audit:[audit,...before.audit].slice(0,1000)};envelope.tenants[business]=data;db.prepare('UPDATE app_state SET revision=?,data=? WHERE id=1').run(revision,JSON.stringify(envelope));db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username,user.role,business,action,revision,created);db.exec('COMMIT');return json(res,200,{revision,data})}catch(error){db.exec('ROLLBACK');throw error}
    }
    return json(res,404,{error:'Not found.'});
  }catch(error){return json(res,error.status||500,{error:error.status?error.message:'Internal server error.'})}};
  return{db,handler,close:()=>db.close()};
}
