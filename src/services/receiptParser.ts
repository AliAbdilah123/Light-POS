export const RECEIPT_MAX_BYTES=5_000_000;
export type ReceiptResult={merchant:string;date:string;category:string;lines:{description:string;quantity?:number;unit?:string;amount:number}[]};

export function validateReceiptResult(value:unknown):ReceiptResult{
  const x=value as Partial<ReceiptResult>;
  if(!x||typeof x.merchant!=='string'||typeof x.date!=='string'||typeof x.category!=='string'||!Array.isArray(x.lines)||x.lines.some(line=>!line||typeof line.description!=='string'||typeof line.amount!=='number'||line.quantity!==undefined&&typeof line.quantity!=='number'||line.unit!==undefined&&typeof line.unit!=='string'))throw Error('The server returned invalid receipt data.');
  return x as ReceiptResult;
}

export async function parseReceipt(file:File,request:typeof fetch=fetch,csrfToken='',business='harbor'){
  const body=new FormData();body.set('receipt',file);
  const response=await request(`${import.meta.env.BASE_URL}api/receipts?business=${encodeURIComponent(business)}`,{method:'POST',headers:{'x-csrf-token':csrfToken},body});
  if(!response.ok)throw Error(`Receipt upload failed (${response.status}).`);
  return validateReceiptResult(await response.json());
}
