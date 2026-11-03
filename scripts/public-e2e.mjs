import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=(process.env.POS_E2E_URL||'https://dev.ahsanworks.com/projects/light-pos/').replace(/\/?$/,'/');
const password=process.env.POS_SEED_PASSWORD||'light-pos-demo';
const businesses={harbor:{label:'Harbor Café',marker:'Kopi Ombak Harbor'},garden:{label:'Garden Table',marker:'Teh Kebun Senja'},north:{label:'North Bakehouse',marker:'Roti Pagi Utara'}};
const accounts=[
  ['superadmin','superadmin','all'],
  ...Object.keys(businesses).flatMap(business=>['admin','cashier','manager','kitchen','display'].map(role=>[`${role}.${business}`,role,business])),
  ['manager.multi','manager','harbor']
];
const landing={cashier:/Welcome,/,manager:/Service overview/,admin:/Tenant admin dashboard/,superadmin:/Business portfolio/,kitchen:/Kitchen/,display:/Menu display/};
const markerRoute={cashier:'cashier/order',manager:'manager/profitability',admin:'admin/menu',superadmin:'admin/menu',kitchen:'kitchen/dashboard',display:'display/dashboard'};

const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||'/snap/bin/chromium',args:['--no-sandbox']});
try{
  for(const [username,role,business] of accounts){
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
    page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource:.*401/.test(message.text()))errors.push(`console: ${message.text()}`)});
    page.on('pageerror',error=>errors.push(`page: ${error.message}`));
    page.on('response',response=>{if(response.status()>=400&&!(response.status()===401&&response.url().endsWith('/api/session')))errors.push(`http ${response.status()}: ${response.url()}`)});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.getByLabel('Username').fill(username);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();
    await assertVisible(page.getByRole('heading',{name:landing[role]}),`${username} landing`);
    const selector=page.getByRole('combobox',{name:'Business'}),businessName=business==='all'?'All businesses':businesses[business].label;assert.equal(await selector.inputValue(),businessName,`${username} tenant indicator`);
    await page.goto(new URL(markerRoute[role],base).href,{waitUntil:'networkidle'});
    if(role==='superadmin'){
      for(const {marker} of Object.values(businesses))await assertVisible(page.getByText(marker,{exact:true}).first(),`${username} portfolio marker ${marker}`);
      const tenantList=await page.evaluate(async path=>(await fetch(`${path}api/tenants`).then(response=>response.json())).tenants,new URL(base).pathname);
      await selector.click();assert.deepEqual((await page.getByRole('listbox',{name:'Businesses'}).getByRole('option').allTextContents()).sort(),['All businesses',...tenantList.map(tenant=>tenant.name)].sort());
      for(const [target,{marker}] of Object.entries(businesses)){const label=tenantList.find(tenant=>tenant.id===target).name;await selector.fill(label);await page.getByRole('option',{name:label,exact:true}).click();await assertVisible(page.getByText(marker,{exact:true}).first(),`${username} switch ${target}`)}
    }else{
      await assertVisible(page.getByText(businesses[business].marker,{exact:true}).first(),`${username} own marker`);
      for(const [foreign,{marker}] of Object.entries(businesses))if(foreign!==business)assert.equal(await page.getByText(marker,{exact:true}).count(),0,`${username} leaked ${foreign} marker`);
    }
    if(role==='admin'){await selector.click();assert.deepEqual(await page.getByRole('listbox',{name:'Businesses'}).getByRole('option').allTextContents(),[businesses[business].label],`${username} tenant choices`)}
    if(role==='cashier'){const product=page.getByRole('button',{name:new RegExp(businesses[business].marker)}).first();await product.click();await assertVisible(page.getByRole('dialog'),`${username} allowed order customization`);await page.getByRole('button',{name:'Close'}).click()}
    if(role==='manager')await assertVisible(page.getByText(/Healthy|Watch|Low/).first(),`${username} allowed profitability view`);
    if(role==='kitchen')await assertVisible(page.getByText(businesses[business].marker,{exact:true}).locator('..'),`${username} allowed availability view`);
    if(role==='display')assert.equal(await page.getByRole('main').getByRole('button').count(),0,`${username} display must stay read-only`);
    if(username==='admin.harbor'&&process.env.POS_E2E_MENU_IMPORT==='1'){
      const imported=`E2E Photo Menu ${Date.now()}`,photo=await page.evaluate(async name=>{const canvas=document.createElement('canvas');canvas.width=900;canvas.height=500;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,900,500);context.fillStyle='black';context.font='bold 48px sans-serif';context.fillText('MENU',360,90);context.font='36px sans-serif';context.fillText(`${name}    Rp 37.000`,80,230);return Array.from(new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))).arrayBuffer()))},imported);
      await page.getByRole('button',{name:'Import from photos'}).click();await page.getByLabel('Menu photos').setInputFiles({name:'e2e-menu.png',mimeType:'image/png',buffer:Buffer.from(photo)});await page.getByRole('button',{name:'Read photos'}).click();try{await assertVisible(page.getByLabel('Imported item 1 name'),'photo import review')}catch(error){throw Error(`Photo import failed: ${await page.getByRole('alert').textContent().catch(()=>null)||'no UI error'}; ${errors.join('; ')}`,{cause:error})}await page.getByLabel('Imported item 1 name').fill(imported);await page.getByLabel('Imported item 1 description').fill('Public E2E import');await page.getByLabel('Imported item 1 category').fill('E2E');await page.getByLabel('Imported item 1 price').fill('37000');await page.getByRole('button',{name:/Save \d+ menu item/}).click();await assertVisible(page.getByText(imported,{exact:true}).first(),'saved photo menu');await page.reload({waitUntil:'networkidle'});await assertVisible(page.getByText(imported,{exact:true}).first(),'persisted photo menu');console.log(`PASS ${username} photo menu import`);
    }
    if(username==='manager.multi'){await selector.click();assert.deepEqual((await page.getByRole('listbox',{name:'Businesses'}).getByRole('option').allTextContents()).sort(),['Garden Table','Harbor Café']);await selector.fill('Garden Table');await page.getByRole('option',{name:'Garden Table'}).click();await assertVisible(page.getByText(businesses.garden.marker,{exact:true}).first(),'multi-business switch')}
    if(!['admin','superadmin'].includes(role)){await page.goto(new URL('admin/menu',base).href,{waitUntil:'networkidle'});await assertVisible(page.getByRole('heading',{name:'Access unavailable'}),`${username} forbidden admin route`)}
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation'}).click();const sidebar=page.locator('.mobile-sidebar');await assertVisible(sidebar.getByRole('button',{name:'Sign out'}),`${username} mobile sidebar logout`);await sidebar.getByRole('button',{name:'Sign out'}).click();await assertVisible(page.getByRole('heading',{name:'Sign in to your workspace'}),`${username} logout`);
    assert.deepEqual(errors,[],`${username} browser errors`);await context.close();console.log(`PASS ${username} (${role}, ${business})`);
  }
}finally{await browser.close()}

async function assertVisible(locator,label){await locator.waitFor({state:'visible',timeout:15000});assert.equal(await locator.isVisible(),true,label)}
