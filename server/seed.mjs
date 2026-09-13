const BUSINESS={
  harbor:{name:'Harbor Cafe',location:'Kemang',marker:'Kopi Ombak Harbor',target:24500000},
  garden:{name:'Garden Table',location:'Senopati',marker:'Teh Kebun Senja',target:28500000},
  north:{name:'North Bakehouse',location:'Menteng',marker:'Roti Pagi Utara',target:21000000}
};

const isoDate=(date,offset=0)=>{const value=new Date(date);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10)};
const isoTime=(date,offsetDays,hour,minute=0)=>`${isoDate(date,offsetDays)}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00.000Z`;
const line=(id,menuId,name,price,qty=1)=>({id,menuId,name,price,qty});
const totals=(lines,discount=0)=>{const subtotal=lines.reduce((sum,item)=>sum+item.price*item.qty,0),tax=Math.round((subtotal-discount)*0.1);return{subtotal,discount,tax,total:subtotal-discount+tax}};
const version=(id,name,category,price,description,ingredients,variations)=>({version:1,name,description,category,price,createdAt:'2025-01-15T00:00:00.000Z',ingredients:ingredients.map(([ingredient,quantity,unit,hidden=false])=>({id:`${id}-${ingredient.toLowerCase().replaceAll(' ','-')}`,name:ingredient,quantity,unit,hidden})),...(variations?{variations}:{})});
const menu=(prefix,id,name,category,price,cost,description,ingredients,availability='available',variations)=>({id:`${prefix}-${id}`,kind:'item',currentVersion:1,versions:[version(`${prefix}-${id}`,name,category,price,description,ingredients,variations)],availability,archived:false,icon:category==='Coffee'?'C':category==='Tea'?'T':category==='Bakery'?'B':'F',name,category,price,cost,available:availability!=='sold-out'});

function menusFor(business){
  const prefix=business.slice(0,2),marker=BUSINESS[business].marker;
  const milk=[{id:'size',name:'Size',required:true,options:[{id:'regular',name:'Regular',priceDelta:0},{id:'large',name:'Large',priceDelta:7000}]},{id:'milk',name:'Milk',required:false,options:[{id:'fresh',name:'Fresh milk',priceDelta:0},{id:'oat',name:'Oat milk',priceDelta:9000}]}];
  return [
    menu(prefix,'marker',marker,business==='north'?'Bakery':business==='garden'?'Tea':'Coffee',business==='north'?33000:39000,14000,`Signature menu unique to ${BUSINESS[business].name}.`,business==='north'?[['Flour',120,'g'],['Butter',35,'g',true]]:business==='garden'?[['Jasmine tea',5,'g'],['Local honey',18,'ml',true]]:[['Arabica espresso',2,'shot'],['Palm sugar',20,'ml',true]],'available',business==='north'?undefined:milk),
    menu(prefix,'latte','Es Kopi Susu Aren','Coffee',36000,13200,'Espresso, fresh milk, and Indonesian palm sugar.',[['Arabica espresso',1,'shot'],['Fresh milk',160,'ml',true],['Palm sugar',20,'ml',true]],'available',milk),
    menu(prefix,'black','Kopi Hitam Flores','Coffee',29000,7800,'Flores coffee brewed clean and bright.',[['Flores coffee',18,'g'],['Water',240,'ml',true]]),
    menu(prefix,'tea','Es Teh Melati Jeruk','Tea',28000,8200,'Jasmine tea with fresh local citrus.',[['Jasmine tea',5,'g'],['Jeruk kasturi',1,'piece']]),
    menu(prefix,'chocolate','Cokelat Rempah','Chocolate',38000,14600,'Indonesian cocoa with cinnamon and nutmeg.',[['Cocoa',28,'g'],['Fresh milk',180,'ml',true],['Cinnamon',1,'g']]),
    menu(prefix,'toast','Roti Bakar Kaya','Kitchen',42000,16500,'Toasted milk bread with pandan kaya.',[['Milk bread',2,'slice'],['Pandan kaya',45,'g']]),
    menu(prefix,'rice','Nasi Ayam Sambal Matah','Kitchen',59000,25800,'Steamed rice, grilled chicken, and sambal matah.',[['Rice',180,'g'],['Chicken',140,'g'],['Sambal matah',35,'g']]),
    menu(prefix,'cake','Bolu Pandan Kelapa','Bakery',31000,11800,'Pandan sponge with toasted coconut.',[['Pandan sponge',1,'slice'],['Coconut',12,'g']],'low')
  ];
}

function ordersFor(business,reference){
  const prefix=business.slice(0,2).toUpperCase(),menus=menusFor(business),marker=menus[0],latte=menus[1],tea=menus[3],rice=menus[6];
  const definitions=[
    ['001',-1,9,15,'Dine In','T02','Completed',[line(`${prefix}-l1`,marker.id,marker.name,marker.price,1),line(`${prefix}-l2`,rice.id,rice.name,rice.price,1)],'QRIS',0],
    ['002',-1,11,40,'Takeaway',undefined,'Completed',[line(`${prefix}-l3`,latte.id,latte.name,latte.price,2)],'Cash',0],
    ['003',-1,14,5,'Delivery',undefined,'Voided',[line(`${prefix}-l4`,tea.id,tea.name,tea.price,2)],'QRIS',0],
    ['004',0,8,25,'Dine In','T04','Preparing',[line(`${prefix}-l5`,latte.id,latte.name,latte.price,1),line(`${prefix}-l6`,marker.id,marker.name,marker.price,1)],undefined,0],
    ['005',0,9,10,'Takeaway',undefined,'Ready',[line(`${prefix}-l7`,tea.id,tea.name,tea.price,1)],undefined,0],
    ['006',-3,16,30,'Dine In','T01','Completed',[line(`${prefix}-l8`,rice.id,rice.name,rice.price,2)],'Cash',10000]
  ];
  return definitions.map(([id,day,hour,minute,service,table,status,lines,payment,discount])=>({id:`${prefix}-${id}`,businessId:business,createdAt:isoTime(reference,day,hour,minute),service,...(table?{tableIds:[table]}:{}),status,lines,...totals(lines,discount),...(payment?{payment}:{}),...(status==='Voided'?{voidReason:'Guest cancelled before preparation'}:{})}));
}

function tenantState(business,reference){
  const info=BUSINESS[business],prefix=business.slice(0,2),today=isoDate(reference),yesterday=isoDate(reference,-1),tomorrow=isoDate(reference,1),menus=menusFor(business);
  const expense=(id,label,category,date,items)=>{const lines=items.map(([description,quantity,unit,amount],index)=>({id:`${prefix}-expense-${id}-${index+1}`,description,quantity,unit,amount}));return{id:`${prefix}-expense-${id}`,label,category,date,lines,amount:lines.reduce((sum,item)=>sum+item.amount,0)}};
  return{
    orders:ordersFor(business,reference),
    orderTypes:[{id:`${prefix}-dine-in`,name:'Dine In',enabled:true,archived:false,requiresTable:true},{id:`${prefix}-takeaway`,name:'Takeaway',enabled:true,archived:false,requiresTable:false},{id:`${prefix}-delivery`,name:'Delivery',enabled:true,archived:false,requiresTable:false}],
    tables:[['T01',2,'Available'],['T02',4,'Occupied'],['T03',2,'Needs attention'],['T04',4,'Occupied'],['T05',6,'Reserved'],['T06',2,'Unavailable'],['T07',4,'Available'],['T08',8,'Available']].map(([id,capacity,status])=>({id,name:`${id} ${info.location}`,capacity,status,enabled:true,archived:false})),
    menus,
    experiments:[{id:`${prefix}-experiment`,name:`Weekday ${info.marker} pairing`,assumptions:'Test one signature drink plus one bakery item during 14:00-17:00 without changing base recipes.',menuDrafts:structuredClone(menus),dailyTargets:Object.fromEntries(menus.slice(0,3).map((item,index)=>[item.id,18-index*4])),status:'draft'}],
    coupons:[{id:`${prefix}-coupon-welcome`,code:`${prefix.toUpperCase()}HEMAT10`,type:'percent',value:10,reason:'Launch offer',active:true},{id:`${prefix}-coupon-care`,code:`${prefix.toUpperCase()}PEDULI15`,type:'fixed',value:15000,reason:'Service recovery',active:false}],
    notes:[{id:`${prefix}-note-marker`,text:`${info.marker} prep count verified; keep one tasting portion for the afternoon briefing.`,date:today},{id:`${prefix}-note-close`,text:'Closing team: record chilled stock temperature before handover.',date:yesterday}],
    expenses:[expense('produce','Pasar produce and dairy','Ingredients',today,[['Fresh milk',12,'liter',336000],['Jeruk kasturi',4,'kg',152000],['Fresh herbs',2,'kg',98000]]),expense('operations','Weekly operating supplies','Operations',yesterday,[['Food-safe sanitizer',6,'bottle',270000],['Receipt paper',20,'roll',190000],['Waste collection',1,'service',225000]])],
    leaves:[{id:`${prefix}-leave-1`,type:'Annual leave',from:isoDate(reference,7),to:isoDate(reference,8),reason:'Fictional family event',status:'Approved'},{id:`${prefix}-leave-2`,type:'Personal',from:isoDate(reference,12),to:isoDate(reference,12),reason:'Fictional appointment',status:'Pending'}],
    staff:[{id:`${prefix}-staff-1`,name:`Sari ${info.location}`,role:'Cashier',status:'Active'},{id:`${prefix}-staff-2`,name:`Bima ${info.location}`,role:'Manager',status:'Active'},{id:`${prefix}-staff-3`,name:`Reno ${info.location}`,role:'Kitchen',status:'Upcoming'}],
    shifts:[{id:`${prefix}-shift-1`,staff:`Sari ${info.location}`,date:today,start:'07:00',end:'15:00',location:info.location},{id:`${prefix}-shift-2`,staff:`Reno ${info.location}`,date:today,start:'10:00',end:'18:00',location:info.location},{id:`${prefix}-shift-3`,staff:`Bima ${info.location}`,date:tomorrow,start:'09:00',end:'17:00',location:info.location}],
    inventory:[{id:`${prefix}-stock-coffee`,name:'Arabica coffee',quantity:8.4,unit:'kg',reorderAt:3,status:'Healthy'},{id:`${prefix}-stock-milk`,name:'Fresh milk',quantity:14,unit:'liter',reorderAt:8,status:'Healthy'},{id:`${prefix}-stock-citrus`,name:'Jeruk kasturi',quantity:2.2,unit:'kg',reorderAt:2.5,status:'Low'}],
    sops:[{id:`${prefix}-sop-open`,title:`Opening ${info.location}`,version:3,steps:['Log refrigeration temperature','Calibrate coffee grinder','Count opening cash','Sanitize service counter'],active:true},{id:`${prefix}-sop-close`,title:`Closing ${info.location}`,version:2,steps:['Record ingredient waste','Clean preparation area','Lock cold storage'],active:true}],
    sopHistory:[`${yesterday} 21:12 · Sari ${info.location} · Closing ${info.location} v2`],
    messages:[{id:`${prefix}-message-marker`,from:`Manager · ${info.location}`,text:`Today we are highlighting ${info.marker}.`,time:`${today} · 08:10`},{id:`${prefix}-message-safety`,from:'Operations',text:'Complete the refrigeration log before the lunch handover.',time:`${yesterday} · 17:45`}],
    messagesRead:[`${prefix}-message-safety`],
    audit:[`${today} 09:10 - Sari ${info.location} (cashier) - Completed opening count`,`${yesterday} 21:12 - Bima ${info.location} (manager) - Completed closing SOP`],
    targets:{[business]:info.target},
    planningNotes:{[menus[0].id]:`Feature ${info.marker} with a locally inspired bakery pairing.`,[`result-${menus[0].id}`]:'Keep'},
    schedules:{Mon:'07:00-21:00',Tue:'07:00-21:00',Wed:'07:00-21:00',Thu:'07:00-21:00',Fri:'07:00-22:00',Sat:'08:00-22:00',Sun:'08:00-20:00'}
  };
}

export const seedState=(reference=new Date())=>({schemaVersion:2,tenants:Object.fromEntries(Object.keys(BUSINESS).map(business=>[business,tenantState(business,reference)]))});
export const seedBusinesses=()=>structuredClone(BUSINESS);
export const seedReceipts=(reference=new Date())=>Object.keys(BUSINESS).map(business=>({id:`seed-receipt-${business}`,actorId:`seed-manager.${business}`,businessId:business,name:`${business}-supplies.png`,mime:'image/png',bytes:new Uint8Array([137,80,78,71,13,10,26,10]),result:{merchant:`Pasar Fiksi ${BUSINESS[business].location}`,date:isoDate(reference,-1),category:'Operations',lines:[{description:'Cleaning cloths',quantity:6,unit:'piece',amount:90000},{description:'Food-safe sanitizer',quantity:2,unit:'bottle',amount:110000}]},createdAt:isoTime(reference,-1,15,20)}));
