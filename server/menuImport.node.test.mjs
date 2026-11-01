import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseMenuPhotos,parseProviderItems} from './menuImport.mjs';

const image=(name='menu.png',type='image/png',bytes=[137,80,78,71,13,10,26,10])=>{const file=new File([new Uint8Array(bytes)],name,{type});return file};

test('validates up to five bounded JPEG, PNG, or WebP menu photos by content',async()=>{
  const files=await parseMenuPhotos([image(),image('menu.jpg','image/jpeg',[255,216,255]),image('menu.webp','image/webp',[82,73,70,70,0,0,0,0,87,69,66,80])]);
  assert.deepEqual(files.map(file=>file.name),['menu.png','menu.jpg','menu.webp']);
  await assert.rejects(parseMenuPhotos([]),error=>error.status===400);
  await assert.rejects(parseMenuPhotos(Array.from({length:6},(_,index)=>image(`${index}.png`))),error=>error.status===400);
  await assert.rejects(parseMenuPhotos([image('fake.png','image/png',[1,2,3])]),error=>error.status===415);
  await assert.rejects(parseMenuPhotos([image('large.png','image/png',new Array(11).fill(0))],{maxEach:10}),error=>error.status===413);
});

test('strictly normalizes provider menu drafts without inventing data',()=>{
  assert.deepEqual(parseProviderItems({items:[{sourcePhoto:0,sourceLabel:'menu.png',name:' Kopi ',description:'',category:' Drinks ',price:36000,warnings:['Description was not visible']}]}),{items:[{sourcePhoto:0,sourceLabel:'menu.png',name:'Kopi',description:'',category:'Drinks',price:36000,warnings:['Description was not visible']}]});
  for(const invalid of [{items:[]},{items:[{sourcePhoto:0,sourceLabel:'x',name:'A',description:'',category:'B',price:1,extra:true}]},{items:[{sourcePhoto:0,sourceLabel:'x',name:'A',description:'',category:'B',price:1.5}]},{items:[{sourcePhoto:0,sourceLabel:'x',name:'A'.repeat(201),description:'',category:'B',price:1}]}])assert.throws(()=>parseProviderItems(invalid));
});

test('calls configured Hermes with OpenAI chat/vision contract and maps provider failures',async()=>{
  let request;
  const items={items:[{sourcePhoto:0,sourceLabel:'menu.png',name:'Kopi',description:'',category:'Drinks',price:36000,warnings:[]}]};
  const fetch=async(url,options)=>{request={url,options};return Response.json({choices:[{message:{content:JSON.stringify(items)}}]})};
  const {extractMenuPhotos}=await import('./menuImport.mjs');
  const result=await extractMenuPhotos([{name:'menu.png',mime:'image/png',bytes:new Uint8Array([1])}],{url:'https://hermes.test/completions',secret:'top-secret',model:'hermes-general',fetch});
  assert.equal(result.items[0].name,'Kopi');
  assert.equal(request.url,'https://hermes.test/completions');
  assert.equal(request.options.headers.authorization,'Bearer top-secret');
  const body=JSON.parse(request.options.body);
  assert.equal(body.model,'hermes-general');
  assert.equal(body.stream,false);
  assert.equal(body.messages[0].role,'user');
  assert.match(body.messages[0].content[0].text,/menu item/i);
  assert.equal(body.messages[0].content[1].type,'image_url');
  assert.match(body.messages[0].content[1].image_url.url,/^data:image\/png;base64,/);
  assert.doesNotMatch(request.options.body,/top-secret/);
  await assert.rejects(extractMenuPhotos([],{url:'',secret:'x',fetch}),error=>error.status===503);
  await assert.rejects(extractMenuPhotos([],{url:'x',secret:'',fetch}),error=>error.status===503);
  await assert.rejects(extractMenuPhotos([],{url:'x',secret:'x',fetch:async()=>new Response('bad',{status:500})}),error=>error.status===502);
});