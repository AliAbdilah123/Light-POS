import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=(process.env.POS_E2E_URL||'https://dev.ahsanworks.com/projects/light-pos/').replace(/\/?$/,'/');
const businesses={harbor:{label:'Harbor Café',marker:'Kopi Ombak Harbor'},garden:{label:'Garden Table',marker:'Teh Kebun Senja'},north:{label:'North Bakehouse',marker:'Roti Pagi Utara'}};
const accounts=[
  ['admin','light-pos-admin','admin','harbor'],
  ...Object.keys(businesses).flatMap(business=>['cashier','manager','kitchen','display'].map(role=>[`${role}.${business}`,`light-pos-${role}.${business}`,role,business])),
  ['manager.multi','light-pos-manager.multi','manager','harbor']
];
const landing={cashier:/Welcome,/,manager:/Service overview/,admin:/Business portfolio/,kitchen:/Kitchen/,display:/Menu display/};
const markerRoute={cashier:'cashier/order',manager:'manager/profitability',admin:'admin/menu',kitchen:'kitchen/dashboard',display:'display/dashboard'};

const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||'/snap/bin/chromium',args:['--no-sandbox']});
try{
  for(const [username,password,role,business] of accounts){
    const context=await browser.newContext(),page=await context.newPage(),errors=[];
    page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource:.*401/.test(message.text()))errors.push(`console: ${message.text()}`)});
    page.on('pageerror',error=>errors.push(`page: ${error.message}`));
    page.on('response',response=>{if(response.status()>=400&&!(response.status()===401&&response.url().endsWith('/api/session')))errors.push(`http ${response.status()}: ${response.url()}`)});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.getByLabel('Username').fill(username);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();
    await assertVisible(page.getByRole('heading',{name:landing[role]}),`${username} landing`);
    const selector=page.getByLabel('Business');assert.equal(await selector.inputValue(),business,`${username} tenant indicator`);
    await page.goto(new URL(markerRoute[role],base).href,{waitUntil:'networkidle'});await assertVisible(page.getByText(businesses[business].marker,{exact:true}).first(),`${username} own marker`);
    for(const [foreign,{marker}] of Object.entries(businesses))if(foreign!==business)assert.equal(await page.getByText(marker,{exact:true}).count(),0,`${username} leaked ${foreign} marker`);
    if(role==='cashier'){const product=page.getByRole('button',{name:new RegExp(businesses[business].marker)}).first();await product.click();await assertVisible(page.getByRole('dialog'),`${username} allowed order customization`);await page.getByRole('button',{name:'Close'}).click()}
    if(role==='manager')await assertVisible(page.getByText(/Healthy|Watch|Low/).first(),`${username} allowed profitability view`);
    if(role==='kitchen'){const card=page.getByText(businesses[business].marker,{exact:true}).locator('..');await assertVisible(card,`${username} allowed availability view`)}
    if(role==='display')assert.equal(await page.getByRole('main').getByRole('button').count(),0,`${username} display must stay read-only`);
    if(username==='manager.multi'){assert.deepEqual((await selector.locator('option').allTextContents()).sort(),['Garden Table','Harbor Café']);await selector.selectOption('garden');await assertVisible(page.getByText(businesses.garden.marker,{exact:true}).first(),'multi-business switch')}
    if(role!=='admin'){await page.goto(new URL('admin/menu',base).href,{waitUntil:'networkidle'});await assertVisible(page.getByRole('heading',{name:'Access unavailable'}),`${username} forbidden admin route`)}
    if(role==='admin'){for(const target of ['garden','north','harbor']){await selector.selectOption(target);await assertVisible(page.getByText(businesses[target].marker,{exact:true}).first(),`admin switch ${target}`)}await selector.selectOption('all');await page.getByRole('button',{name:'Add menu'}).click();await page.getByLabel('Menu name').fill('Forbidden portfolio item');await page.getByLabel('Description').fill('Must not persist');await page.getByLabel('Category').fill('Test');await page.getByLabel('Price').fill('10000');await page.getByRole('button',{name:'Create menu'}).click();await assertVisible(page.getByRole('alert').filter({hasText:'Select one business'}),'admin all-mode write denied')}
    await page.getByRole('button',{name:'Sign out'}).click();await assertVisible(page.getByRole('heading',{name:'Sign in to your workspace'}),`${username} logout`);
    assert.deepEqual(errors,[],`${username} browser errors`);await context.close();console.log(`PASS ${username} (${role}, ${business})`);
  }
}finally{await browser.close()}

async function assertVisible(locator,label){await locator.waitFor({state:'visible',timeout:15000});assert.equal(await locator.isVisible(),true,label)}
