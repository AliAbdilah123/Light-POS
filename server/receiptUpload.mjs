const TYPES=new Set(['image/jpeg','image/png','image/webp']);
const valid=result=>result&&typeof result.merchant==='string'&&typeof result.date==='string'&&typeof result.category==='string'&&Array.isArray(result.lines)&&result.lines.every(x=>x&&typeof x.description==='string'&&typeof x.amount==='number'&&(x.quantity===undefined||typeof x.quantity==='number')&&(x.unit===undefined||typeof x.unit==='string'));

export function createReceiptUpload({authorize,parse,store,maxBytes=5_000_000}){
  return async request=>{
    let auth;
    try{auth=await authorize?.(request)}catch{return Response.json({error:'Unauthorized.'},{status:401})}
    if(auth!==true)return Response.json({error:'Unauthorized.'},{status:auth?.status===403?403:401});
    let file;
    try{file=(await request.formData()).get('receipt')}catch{return Response.json({error:'Invalid multipart upload.'},{status:400})}
    if(!(file instanceof File))return Response.json({error:'Receipt image is required.'},{status:400});
    if(!TYPES.has(file.type))return Response.json({error:'Unsupported image type.'},{status:415});
    if(file.size>maxBytes)return Response.json({error:'Receipt image is too large.'},{status:413});
    try{
      const bytes=new Uint8Array(await file.arrayBuffer()),magic=file.type==='image/jpeg'&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff||file.type==='image/png'&&bytes.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i])||file.type==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
      if(!magic)return Response.json({error:'Unsupported image content.'},{status:415});
      const result=await parse({bytes,mime:file.type});
      if(!valid(result))return Response.json({error:'Parser returned invalid receipt data.'},{status:502});
      await store({id:crypto.randomUUID(),name:file.name,mime:file.type,bytes,result,createdAt:new Date().toISOString()});
      return Response.json(result);
    }catch{return Response.json({error:'Receipt processing failed.'},{status:502})}
  };
}
