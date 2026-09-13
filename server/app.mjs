import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {hashToken,passwordHash,passwordMatches,safeEqual} from './auth.mjs';
import {seedState} from './seed.mjs';
import {createReceiptUpload} from './receiptUpload.mjs';

const ROLES=new Set(['cashier','manager','admin','kitchen','display']);
const BUSINESSES=new Set(['harbor','garden','north']);
const MUTABLE={cashier:new Set(['orders','notes','leaves','messagesRead','tables']),manager:new Set(['orders','notes','expenses','sopHistory','tables']),admin:null,kitchen:new Set(['orders','menus','experiments']),display:new Set()};
const REQUIRED=['orders','orderTypes','tables','menus','experiments','coupons','notes','expenses','leaves','shifts','sops','sopHistory','messagesRead','audit','targets','planningNotes','schedules'];
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=300)=>typeof value==='string'&&value.length<=max;
const number=value=>typeof value==='number'&&Number.isFinite(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safeTree=(value,depth=0)=>depth<=16&&(value===null||typeof value==='boolean'||number(value)||text(value,10000)||Array.isArray(value)&&value.length<=10000&&value.every(item=>safeTree(item,depth+1))||isObject(value)&&Object.keys(value).length<=200&&Object.entries(value).every(([key,item])=>text(key,100)&&key!=='__proto__'&&key!=='constructor'&&key!=='prototype'&&safeTree(item,depth+1)));
const changedKeys=(before,after)=>REQUIRED.filter(key=>key!=='audit'&&!same(before[key],after[key]));
const scopedData=(data,business)=>business==='all'?data:{...data,orders:data.orders.filter(order=>order.businessId===business)};
const validLine=line=>isObject(line)&&text(line.id,100)&&text(line.menuId,100)&&text(line.name,200)&&number(line.price)&&line.price>=0&&Number.isInteger(line.qty)&&line.qty>0;
const validOrder=order=>isObject(order)&&text(order.id,100)&&BUSINESSES.has(order.businessId)&&text(order.createdAt,40)&&text(order.service,100)&&['Held','Preparing','Ready','Completed','Voided'].includes(order.status)&&Array.isArray(order.lines)&&order.lines.length<=100&&order.lines.every(validLine)&&['subtotal','discount','tax','total'].every(key=>number(order[key])&&order[key]>=0);
function validState(data){
  if(!safeTree(data))return false;
  if(!isObject(data)||Object.keys(data).some(key=>!REQUIRED.includes(key))||REQUIRED.some(key=>!(key in data)))return false;
  if(!Array.isArray(data.orders)||data.orders.length>10000||!data.orders.every(validOrder))return false;
  for(const key of ['orderTypes','tables','menus','experiments','coupons','notes','expenses','leaves','shifts','sops','sopHistory','messagesRead','audit'])if(!Array.isArray(data[key])||data[key].length>10000)return false;
  return isObject(data.targets)&&isObject(data.planningNotes)&&isObject(data.schedules)&&JSON.stringify(data).length<=1_000_000;
}
function scopedOrders(before,after,business){
  if(business==='all')return true;
  const outside=orders=>orders.filter(order=>order.businessId!==business).sort((a,b)=>a.id.localeCompare(b.id));
  return same(outside(before.orders),outside(after.orders))&&after.orders.every(order=>before.orders.some(old=>old.id===order.id)||order.businessId===business);
}
function validNewOrder(order,state){const subtotal=order.lines.reduce((sum,line)=>sum+line.price*line.qty,0),coupon=state.coupons.find(item=>item.active&&item.code.toLowerCase()===String(order.coupon||'').toLowerCase()),raw=coupon?(coupon.type==='percent'?Math.round(subtotal*coupon.value/100):coupon.value):0,discount=Math.min(subtotal,raw),tax=Math.round((subtotal-discount)*.1);return order.subtotal===subtotal&&order.discount===discount&&order.tax===tax&&order.total===subtotal-discount+tax&&(['Completed','Held'].includes(order.status))&&(order.status!=='Completed'||['Cash','QRIS'].includes(order.payment))}
function operationalOrdersSafe(before,after){const oldById=new Map(before.orders.map(order=>[order.id,order])),newById=new Map(after.orders.map(order=>[order.id,order]));for(const old of before.orders){const current=newById.get(old.id);if(!current){if(old.status!=='Held')return false;continue}if(same(old,current))continue;if(current.status==='Voided'&&text(current.voidReason,300)&&current.voidReason.trim()&&same({...old,status:'Voided',voidReason:current.voidReason},current))continue;if(old.status==='Completed'&&current.status==='Held'&&Date.now()-new Date(old.createdAt).getTime()<300000){const expected={...old,status:'Held'};delete expected.payment;if(same(expected,current))continue}return false}return after.orders.filter(order=>!oldById.has(order.id)).every(order=>validNewOrder(order,after))}
function statusOnlyTables(before,after){if(before.tables.length!==after.tables.length)return false;const oldById=new Map(before.tables.map(table=>[table.id,table]));return after.tables.every(table=>{const old=oldById.get(table.id);return old&&same({...old,status:table.status},table)})}
function kitchenSafe(before,after){
  const oldOrders=new Map(before.orders.map(order=>[order.id,order]));
  if(after.orders.length!==before.orders.length||after.orders.some(order=>{const old=oldOrders.get(order.id);return !old||(!same(old,order)&&!(old.status==='Preparing'&&order.status==='Ready'&&same({...old,status:'Ready'},order)))}))return false;
  const availabilityOnly=(old,item)=>old&&same({...old,availability:item.availability},item);
  const oldMenus=new Map(before.menus.map(item=>[item.id,item]));
  if(after.menus.length!==before.menus.length||after.menus.some(item=>!availabilityOnly(oldMenus.get(item.id),item)))return false;
  return after.experiments.every((experiment,index)=>{const old=before.experiments[index];if(!old||experiment.id!==old.id||experiment.menuDrafts?.length!==old.menuDrafts?.length)return same(experiment,old);const oldDrafts=new Map(old.menuDrafts.map(item=>[item.id,item]));return same({...old,menuDrafts:experiment.menuDrafts},experiment)&&experiment.menuDrafts.every(item=>availabilityOnly(oldDrafts.get(item.id),item))});
}
function authorizeMutation(user,business,before,after){
  if(business==='all'&&!user.businessIds.includes('*')||business!=='all'&&!user.businessIds.includes('*')&&!user.businessIds.includes(business))return 'Business access denied.';
  const changed=changedKeys(before,after),allowed=MUTABLE[user.role];
  if(!changed.length)return 'No changes supplied.';
  if(allowed&&changed.some(key=>!allowed.has(key)))return 'Action is not allowed for this role.';
  if(changed.includes('orders')&&!scopedOrders(before,after,business))return 'Order changes must stay within the selected business.';
  if(['cashier','manager'].includes(user.role)&&changed.includes('orders')&&!operationalOrdersSafe(before,after))return 'Order mutation is not allowed.';
  if(['cashier','manager'].includes(user.role)&&changed.includes('tables')&&!statusOnlyTables(before,after))return 'Only table status may be changed.';
  if(user.role==='kitchen'&&!kitchenSafe(before,after))return 'Kitchen may only mark preparing orders ready or change menu availability.';
  return '';
}
const parseCookies=header=>Object.fromEntries(String(header||'').split(';').map(part=>part.trim().split('=').map(decodeURIComponent)).filter(pair=>pair.length===2));
const json=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body))};
async function readJson(req){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>1_000_000)throw Object.assign(Error('Payload too large.'),{status:413});body+=chunk}if(!body)throw Object.assign(Error('JSON body required.'),{status:400});try{return JSON.parse(body)}catch{throw Object.assign(Error('Invalid JSON.'),{status:400})}}
const envAccount=(role,index)=>({id:`seed-${role}`,username:process.env[`POS_${role.toUpperCase()}_USERNAME`]||role,password:process.env[`POS_${role.toUpperCase()}_PASSWORD`]||`light-pos-${role}`,displayName:process.env[`POS_${role.toUpperCase()}_NAME`]||(['Ayu Pratama','Dinda Manager','Raka Admin','Kitchen Team','Menu Display'][index]),role,businessIds:role==='admin'||role==='display'?['*']:['harbor']});

export async function openDatabase(filename=process.env.POS_DB_PATH||'sqlite.db'){
  const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL, business_ids TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_username TEXT NOT NULL, actor_role TEXT NOT NULL, business_id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL);');
  db.prepare('INSERT OR IGNORE INTO app_state(id,revision,data) VALUES(1,1,?)').run(JSON.stringify(seedState()));
  for(const [index,role] of [...ROLES].entries()){if(process.env.NODE_ENV==='production'&&!process.env[`POS_${role.toUpperCase()}_PASSWORD`])throw Error(`POS_${role.toUpperCase()}_PASSWORD is required in production.`);const account=envAccount(role,index),found=db.prepare('SELECT id FROM users WHERE id=?').get(account.id);if(!found){const password=await passwordHash(account.password);db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(account.id,account.username,account.displayName,role,JSON.stringify(account.businessIds),password.salt,password.hash)}}
  return db;
}

export async function createApp({db:providedDb,dbPath,now=()=>new Date(),secureCookies=process.env.NODE_ENV==='production',loginLimit=5,loginWindowMs=15*60_000}={}){
  const db=providedDb||await openDatabase(dbPath),attempts=new Map();
  const getUser=req=>{const token=parseCookies(req.headers.cookie).light_pos_session;if(!token)return null;const row=db.prepare('SELECT u.*,s.csrf_token,s.expires_at,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hashToken(token));if(!row||new Date(row.expires_at)<=now()){if(row)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(row.token_hash);return null}return{id:row.id,username:row.username,name:row.display_name,role:row.role,businessIds:JSON.parse(row.business_ids),csrf:row.csrf_token,tokenHash:row.token_hash}};
  const publicUser=user=>({id:user.id,username:user.username,name:user.name,role:user.role,businessIds:user.businessIds,csrfToken:user.csrf});
  const csrfOk=(req,user)=>text(req.headers['x-csrf-token'],200)&&safeEqual(req.headers['x-csrf-token'],user.csrf);
  const handler=async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost'),method=req.method||'GET';
    if(method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true});
    if(method==='POST'&&url.pathname==='/api/login'){
      if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});
      const body=await readJson(req),username=typeof body.username==='string'?body.username.trim().toLowerCase():'',password=body.password,remote=req.socket.remoteAddress||'unknown',clientIp=(remote==='127.0.0.1'||remote==='::1'||remote==='::ffff:127.0.0.1')?String(req.headers['x-forwarded-for']||remote).split(',')[0].trim():remote,key=`${clientIp}:${username}`;
      for(const [attemptKey,value] of attempts)if(now().getTime()>=value.reset)attempts.delete(attemptKey);if(attempts.size>10000)attempts.delete(attempts.keys().next().value); // ponytail: process-local limiter; use a shared store when the API runs multiple instances.
      const entry=attempts.get(key)||{count:0,reset:now().getTime()+loginWindowMs};
      if(now().getTime()>=entry.reset){entry.count=0;entry.reset=now().getTime()+loginWindowMs}if(entry.count>=loginLimit)return json(res,429,{error:'Too many login attempts. Try again later.'},{'retry-after':String(Math.ceil((entry.reset-now().getTime())/1000))});
      if(!text(username,100)||username.length<1||!text(password,200)||password.length<8)return json(res,400,{error:'Valid username and password are required.'});
      const row=db.prepare('SELECT * FROM users WHERE lower(username)=?').get(username),comparison=row||db.prepare("SELECT * FROM users WHERE id='seed-cashier'").get(),matches=await passwordMatches(password,comparison.password_salt,comparison.password_hash),valid=!!row&&matches;if(!valid){entry.count++;attempts.set(key,entry);return json(res,401,{error:'Invalid username or password.'})}attempts.delete(key);
      const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url'),created=now(),expires=new Date(created.getTime()+12*60*60_000);db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hashToken(token),row.id,csrf,expires.toISOString(),created.toISOString());
      return json(res,200,{user:publicUser({id:row.id,username:row.username,name:row.display_name,role:row.role,businessIds:JSON.parse(row.business_ids),csrf})},{'set-cookie':`light_pos_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secureCookies?'; Secure':''}`});
    }
    const user=getUser(req);if(!user)return json(res,401,{error:'Authentication required.'});
    if(method==='GET'&&url.pathname==='/api/session')return json(res,200,{user:publicUser(user)});
    if(method==='DELETE'&&url.pathname==='/api/session'){if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.tokenHash);return json(res,200,{ok:true},{'set-cookie':`light_pos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies?'; Secure':''}`})}
    if(method==='POST'&&url.pathname==='/api/receipts'){
      if(!['manager','admin'].includes(user.role))return json(res,403,{error:'Action is not allowed for this role.'});if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});if(!process.env.POS_RECEIPT_PARSER_URL)return json(res,503,{error:'Receipt parser is not configured.'});
      const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);const webRequest=new Request(`http://localhost${req.url}`,{method:'POST',headers,body:Readable.toWeb(req),duplex:'half'});
      const upload=createReceiptUpload({authorize:async()=>true,parse:async({bytes,mime})=>{const response=await fetch(process.env.POS_RECEIPT_PARSER_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mime,image:Buffer.from(bytes).toString('base64')})});if(!response.ok)throw Error('Parser failed');return response.json()},store:async record=>db.prepare('INSERT INTO receipts VALUES(?,?,?,?,?,?,?)').run(record.id,user.id,record.name,record.mime,record.bytes,JSON.stringify(record.result),record.createdAt)}),response=await upload(webRequest);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if(method==='GET'&&url.pathname==='/api/state'){const business=url.searchParams.get('business')||user.businessIds.find(id=>id!=='*')||'all';if(business!=='all'&&!BUSINESSES.has(business)||business==='all'&&!user.businessIds.includes('*')||business!=='all'&&!user.businessIds.includes('*')&&!user.businessIds.includes(business))return json(res,403,{error:'Business access denied.'});const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get();return json(res,200,{revision:row.revision,data:scopedData(JSON.parse(row.data),business)})}
    if(method==='PUT'&&url.pathname==='/api/state'){
      if(!csrfOk(req,user))return json(res,403,{error:'Invalid CSRF token.'});if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});const body=await readJson(req);
      if(!Number.isInteger(body.revision)||body.business!=='all'&&!BUSINESSES.has(body.business)||!validState(body.data)||!text(body.action,200)||!body.action.trim())return json(res,400,{error:'Invalid state mutation.'});
      db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT revision,data FROM app_state WHERE id=1').get(),before=JSON.parse(row.data);if(row.revision!==body.revision){db.exec('ROLLBACK');return json(res,409,{error:'State changed on the server.',revision:row.revision,data:scopedData(before,body.business)})}const candidate=body.business==='all'?body.data:{...body.data,orders:[...body.data.orders,...before.orders.filter(order=>order.businessId!==body.business)]},denied=authorizeMutation(user,body.business,before,candidate);if(denied){db.exec('ROLLBACK');return json(res,403,{error:denied})}const created=now().toISOString(),revision=row.revision+1,action=body.action.trim(),audit=`${created.slice(11,16)} - ${user.name} (${user.role}) - ${action}`,data={...candidate,audit:[audit,...before.audit].slice(0,1000)};db.prepare('UPDATE app_state SET revision=?,data=? WHERE id=1').run(revision,JSON.stringify(data));db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username,user.role,body.business,action,revision,created);db.exec('COMMIT');return json(res,200,{revision,data:scopedData(data,body.business)})}catch(error){db.exec('ROLLBACK');throw error}
    }
    return json(res,404,{error:'Not found.'});
  }catch(error){return json(res,error.status||500,{error:error.status?error.message:'Internal server error.'})}};
  return{db,handler,close:()=>db.close()};
}
