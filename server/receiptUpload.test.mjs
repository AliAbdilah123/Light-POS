import {describe,expect,it} from 'vitest';
import {createReceiptUpload} from './receiptUpload.mjs';

describe('receipt upload backend',()=>{
  it('validates, stores image and validated parser result',async()=>{
    const stored=[];
    const handle=createReceiptUpload({authorize:async()=>true,parse:async()=>({merchant:'Shop',date:'2026-09-05',category:'Supplies',lines:[]}),store:async record=>stored.push(record),maxBytes:10});
    const body=new FormData(),file=new File(['image'],'receipt.png',{type:'image/png'});file.arrayBuffer=async()=>new Uint8Array([137,80,78,71,13,10,26,10]).buffer;body.set('receipt',file);
    const response=await handle({formData:async()=>body});
    expect(response.status).toBe(200);
    expect(stored[0]).toMatchObject({mime:'image/png',result:{merchant:'Shop'}});
    expect(stored[0].bytes).toBeInstanceOf(Uint8Array);
  });
  it('rejects invalid MIME and oversized uploads',async()=>{
    const handle=createReceiptUpload({authorize:async()=>true,parse:async()=>{},store:async()=>{},maxBytes:3});
    for(const [file,status] of [[new File(['x'],'x.txt',{type:'text/plain'}),415],[new File(['large'],'x.png',{type:'image/png'}),413]]){
      const body=new FormData();body.set('receipt',file);
      expect((await handle({formData:async()=>body})).status).toBe(status);
    }
  });
  it('authorizes before multipart parsing and fails closed',async()=>{let parsed=false,stored=false;const handle=createReceiptUpload({authorize:async()=>({status:403}),parse:async()=>{parsed=true},store:async()=>{stored=true}});const response=await handle({formData:async()=>{parsed=true;return new FormData()}});expect(response.status).toBe(403);expect(parsed).toBe(false);expect(stored).toBe(false)});
  it('rejects MIME-spoofed images by magic signature',async()=>{let parsed=false,stored=false;const body=new FormData(),file=new File(['not png'],'x.png',{type:'image/png'});file.arrayBuffer=async()=>new TextEncoder().encode('not png').buffer;body.set('receipt',file);const handle=createReceiptUpload({authorize:async()=>true,parse:async()=>{parsed=true},store:async()=>{stored=true}});expect((await handle({formData:async()=>body})).status).toBe(415);expect(parsed).toBe(false);expect(stored).toBe(false)});
});