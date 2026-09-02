import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';

const base='http://127.0.0.1:5173';
const output='/tmp/capt4ce-e2e';
const widths=[320,375,414,768,1024];
const routes=['/cashier/dashboard','/cashier/order','/orders','/seats','/cashier/people','/notes','/manager/dashboard','/manager/revenue','/manager/expenses','/manager/inventory','/manager/profitability','/manager/sop','/admin/dashboard','/admin/insights','/admin/menu','/admin/coupons','/admin/operations','/admin/staff','/admin/sop'];
const failures=[];
const screenshots=[];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium-browser',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1024,height:768}});
page.on('console',message=>{if(message.type()==='error')failures.push(`console: ${message.text()}`)});
page.on('pageerror',error=>failures.push(`page: ${error.message}`));
const fail=(condition,message)=>{if(!condition)failures.push(message)};
const goto=async(route)=>{await page.goto(`${base}${route}`);await page.waitForLoadState('networkidle')};
const capture=async(name,fullPage=false)=>{const path=`${output}/${name}`;await page.screenshot({path,fullPage});screenshots.push(path)};

await mkdir(output,{recursive:true});

for(const width of widths){
  await page.setViewportSize({width,height:768});
  for(const route of routes){
    await goto(route);
    const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    fail(dimensions.scroll<=dimensions.client,`overflow ${width}px ${route}: ${dimensions.scroll}>${dimensions.client}`);
  }
}

await page.setViewportSize({width:375,height:768});
await goto('/cashier/order');
const categoryLayout=await page.locator('.category-rail').evaluate((rail)=>{
  const buttons=[...rail.querySelectorAll('button')];
  const last=buttons.at(-1).getBoundingClientRect();
  const frame=rail.getBoundingClientRect();
  return {labels:buttons.map(button=>button.textContent),lastRight:last.right,frameRight:frame.right,scrollWidth:rail.scrollWidth,clientWidth:rail.clientWidth};
});
fail(categoryLayout.labels.join('|')==='All|Coffee|Tea|Bakery|Kitchen','category labels are incomplete');
fail(categoryLayout.lastRight<=categoryLayout.frameRight+1,'last category is clipped at 375px');
const unavailable=await page.getByRole('button',{name:/Banana loaf/}).evaluate(button=>({text:button.innerText,plus:!!button.querySelector('.product-plus'),scrollWidth:button.scrollWidth,clientWidth:button.clientWidth}));
fail(unavailable.text.includes('Unavailable'),'Banana loaf status is incomplete');
fail(!unavailable.plus,'unavailable product has an ambiguous plus');
fail(unavailable.scrollWidth<=unavailable.clientWidth,'Banana loaf content is clipped');
const addSizes=await page.locator('.product:not(:disabled) .product-plus').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height}}));
fail(addSizes.every(size=>size.width>=48&&size.height>=48),'one or more add affordances are below 48px');
await page.getByRole('button',{name:/Cappuccino/}).click();
const dock=await page.locator('.mobile-cart-dock').evaluate(node=>{const r=node.getBoundingClientRect();const button=node.querySelector('button').getBoundingClientRect();return {position:getComputedStyle(node).position,bottom:innerHeight-r.bottom,buttonWidth:button.width,buttonHeight:button.height,text:node.innerText}});
fail(dock.position==='fixed'&&dock.bottom>=0&&dock.buttonWidth>=48&&dock.buttonHeight>=48&&dock.text.replaceAll('\u00a0',' ').includes('Rp 35.200'),'mobile cart dock is not visible, fixed, or touch-comfortable');
await capture('correction-order-375.png');
await page.locator('.mobile-cart-dock button').click();
fail(await page.getByRole('heading',{name:'Checkout'}).isVisible(),'sticky cart action did not open checkout');

await page.setViewportSize({width:1024,height:768});
await goto('/cashier/order');
await page.getByRole('button',{name:/Cappuccino/}).click();
await capture('correction-order-1024.png');

await goto('/manager/inventory');
const formula=await page.locator('.formula.highlight strong').evaluate(node=>({text:node.textContent,whiteSpace:getComputedStyle(node).whiteSpace,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}));
fail(formula.text.replaceAll('\u00a0',' ')==='= Rp 2.800/portion','portion result text is not cohesive');
fail(formula.whiteSpace==='nowrap'&&formula.scrollWidth<=formula.clientWidth,'portion result wraps or clips');
const note=await page.locator('.formula-note').evaluate(node=>({tag:node.tagName,fontSize:parseFloat(getComputedStyle(node).fontSize),text:node.textContent}));
fail(note.tag==='P'&&note.fontSize>=13&&note.text.includes('10 portions'),'formula explanation is not readable non-interactive text');
await capture('correction-inventory-1024.png',true);

await goto('/admin/dashboard');
const cards=await page.locator('.business-grid .card').evaluateAll(nodes=>nodes.map(node=>{
  const badge=node.querySelector('.badge');
  const subtitle=node.querySelector('p');
  const revenue=node.querySelector('.revenue');
  const progress=node.querySelector('.progress');
  const textRange=document.createRange();
  textRange.selectNodeContents(subtitle);
  const badgeFrame=badge.getBoundingClientRect();
  const cardFrame=node.getBoundingClientRect();
  return {badgeInsideCard:badgeFrame.right<=cardFrame.right,subtitleTextHeight:textRange.getBoundingClientRect().height,subtitleLineHeight:parseFloat(getComputedStyle(subtitle).lineHeight),revenueTop:revenue.getBoundingClientRect().top,progressTop:progress.getBoundingClientRect().top};
}));
fail(cards.every(card=>card.badgeInsideCard),'an On track badge clips');
fail(cards.every(card=>card.subtitleTextHeight<=card.subtitleLineHeight*1.1),'a business subtitle wraps awkwardly');
fail(Math.max(...cards.map(card=>card.revenueTop))-Math.min(...cards.map(card=>card.revenueTop))<=1,'revenue rows are not aligned');
fail(Math.max(...cards.map(card=>card.progressTop))-Math.min(...cards.map(card=>card.progressTop))<=1,'progress rows are not aligned');
const comparisonSize=await page.locator('.comparison-card .definition').evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
fail(comparisonSize>=13,'comparison note remains too small');
await capture('correction-admin-1024.png',true);

await page.setViewportSize({width:375,height:768});
for(const [route,name] of [['/manager/inventory','correction-inventory-375.png'],['/admin/dashboard','correction-admin-375.png']]){await goto(route);await capture(name)}

console.log(JSON.stringify({routesChecked:routes.length,widths,routeWidthChecks:routes.length*widths.length,assertions:{categories:categoryLayout,addControls:addSizes[0],cartDock:dock,formula,note,adminCards:cards,comparisonFontPx:comparisonSize},screenshots,failures},null,2));
await browser.close();
if(failures.length)process.exit(1);
