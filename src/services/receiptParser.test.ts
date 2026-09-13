import {describe,expect,it,vi} from 'vitest';
import {parseReceipt} from './receiptParser';

describe('receipt parser API boundary',()=>{
  it('uploads multipart to the same-origin application endpoint',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({merchant:'Shop',date:'',category:'',lines:[]})));
    await parseReceipt(new File(['x'],'receipt.png',{type:'image/png'}),fetch);
    expect(fetch).toHaveBeenCalledWith('/projects/light-pos/api/receipts?business=harbor',expect.objectContaining({method:'POST',body:expect.any(FormData)}));
    expect((fetch.mock.calls[0][1].body as FormData).get('receipt')).toBeInstanceOf(File);
  });
  it('rejects partial or malformed response fields',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({merchant:'Shop',lines:[{description:'Ice',amount:'12'}]})));
    await expect(parseReceipt(new File(['x'],'receipt.png',{type:'image/png'}),fetch)).rejects.toThrow('invalid receipt data');
  });
});
