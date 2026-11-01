const TYPES={'image/jpeg':bytes=>bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'image/png':bytes=>[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value),'image/webp':bytes=>new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'};
const fail=(message,status)=>Object.assign(Error(message),{status});

export async function parseMenuPhotos(files,{maxEach=5_000_000,maxTotal=20_000_000}={}){
  if(!files.length||files.length>5)throw fail('Select between 1 and 5 photos.',400);
  if(files.reduce((sum,file)=>sum+file.size,0)>maxTotal)throw fail('Photos must total 20 MB or less.',413);
  return Promise.all(files.map(async file=>{if(!TYPES[file.type])throw fail('Only JPEG, PNG, or WebP photos are supported.',415);if(file.size>maxEach)throw fail('Each photo must be 5 MB or less.',413);const bytes=new Uint8Array(await file.arrayBuffer());if(!TYPES[file.type](bytes))throw fail('Image content does not match its type.',415);return{name:file.name,mime:file.type,bytes}}));
}

export function parseProviderItems(value){
  if(!value||!Array.isArray(value.items)||!value.items.length||value.items.length>100)throw fail('No menu items found.',422);
  const keys=['sourcePhoto','sourceLabel','name','description','category','price','warnings'];
  return{items:value.items.map(item=>{if(!item||Object.keys(item).some(key=>!keys.includes(key))||!Number.isInteger(item.sourcePhoto)||item.sourcePhoto<0||typeof item.sourceLabel!=='string'||typeof item.name!=='string'||typeof item.description!=='string'||typeof item.category!=='string'||!Number.isInteger(item.price)||item.price<=0||item.name.length>200||item.description.length>1000||item.category.length>100||item.sourceLabel.length>200||item.warnings!==undefined&&(!Array.isArray(item.warnings)||item.warnings.some(warning=>typeof warning!=='string'||warning.length>300)))throw fail('Hermes returned invalid menu data.',502);return{sourcePhoto:item.sourcePhoto,sourceLabel:item.sourceLabel,name:item.name.trim(),description:item.description.trim(),category:item.category.trim(),price:item.price,warnings:item.warnings||[]}})};
}

// Pull the requested {items:[...]} out of an OpenAI chat-completion body, a
// bare JSON object/array, or an SSE-framed stream (providers commonly reply
// ``text/event-stream`` even to non-streaming calls).
function extractItemsPayload(body){
  let data=body;
  if(typeof data==='string'){
    const trimmed=data.trim();
    if(!trimmed)throw fail('Hermes returned invalid menu data.',502);
    const sseLines=trimmed.split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('data:'));
    const raw=sseLines.length?sseLines.map(line=>line.slice(5).trim()).filter(line=>line&&line!=='[DONE]').pop():trimmed;
    try{data=JSON.parse(raw)}catch{throw fail('Hermes returned invalid menu data.',502)}
  }
  if(data&&typeof data==='object'&&Array.isArray(data.choices)&&data.choices[0]?.message){data=data.choices[0].message.content}
  if(typeof data==='string'){
    const fence=data.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text=fence?fence[1]:data;
    const start=text.search(/[[{]/);
    try{data=JSON.parse(start===-1?text:text.slice(start))}catch{throw fail('Hermes returned invalid menu data.',502)}
  }
  if(Array.isArray(data))data={items:data};
  if(!data||typeof data!=='object'||!Array.isArray(data.items))throw fail('No menu items found.',422);
  return data;
}

const MENU_PROMPT=(names)=>[
  'Extract every printed menu item from the photo(s).',
  'Respond with ONLY a JSON object (no markdown, no commentary) shaped exactly as:',
  '{"items":[{"sourcePhoto":0,"sourceLabel":"<file name>","name":"","description":"","category":"","price":18000,"warnings":[]}]}',
  'sourcePhoto is the 0-based index of the file the item appears on; sourceLabel must be that file\'s name.',
  'price is a positive integer in IDR rupiah.',
  'Never invent text that is not visibly printed; leave it empty and record uncertainty in warnings.',
  'Preserve the original language and spelling.',
  ...names.map((name,index)=>`File ${index} is named "${name}".`)
].join('\n');

export async function extractMenuPhotos(files,{url=process.env.HERMES_URL,secret=process.env.HERMES_SECRET,model=process.env.HERMES_MODEL||'hermes-general',fetch:request=fetch,timeoutMs=60_000}={}){
  if(!url||!secret)throw fail('Menu parsing is not configured.',503);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const messages=[{role:'user',content:[{type:'text',text:MENU_PROMPT(files.map(file=>file.name))},...files.map(file=>({type:'image_url',image_url:{url:`data:${file.mime};base64,${Buffer.from(file.bytes).toString('base64')}`}}))]}];
    const response=await request(url,{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({model,messages,stream:false})});
    if(!response.ok)throw fail('Hermes menu parsing failed.',502);
    return parseProviderItems(extractItemsPayload(await response.text()));
  }catch(error){
    if(error?.status)throw error;
    if(error?.name==='AbortError')throw fail('Menu parsing timed out.',504);
    throw fail('Hermes returned invalid menu data.',502);
  }finally{clearTimeout(timer)}
}