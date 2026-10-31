import {useEffect,useState} from 'react';
import {API,useStore} from '../store';
import {businesses} from '../mockData';
import {Button,Card} from '../components/atoms';
import {PageHead} from '../components/molecules';

type Metadata={configured:boolean;mime?:string;updatedAt?:string};
export function AdminPaymentQrPage(){
  const{business,user}=useStore(),[metadata,setMetadata]=useState<Metadata>({configured:false}),[file,setFile]=useState<File>(),[message,setMessage]=useState(''),[error,setError]=useState('');
  const selected=business!=='all',label=businesses.find(item=>item.id===business)?.name||business;
  const load=()=>{if(!selected){setMetadata({configured:false});return}fetch(`${API}/payment-qr?business=${encodeURIComponent(business)}`,{credentials:'same-origin'}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error);setMetadata(body);setError('')}).catch(reason=>setError(reason.message))};
  useEffect(load,[business,selected]);
  const upload=async()=>{if(!file)return;if(file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Choose a PNG, JPEG, or WebP image no larger than 2 MB.');return}if(metadata.configured&&!confirm('Replace the current payment QR?'))return;const response=await fetch(`${API}/payment-qr?business=${encodeURIComponent(business)}`,{method:'PUT',credentials:'same-origin',headers:{'content-type':file.type,'x-csrf-token':user.csrfToken},body:file}),body=await response.json();if(!response.ok){setError(body.error);return}setMetadata(body);setMessage('Payment QR saved.');setError('')};
  const remove=async()=>{if(!confirm('Remove this payment QR?'))return;const response=await fetch(`${API}/payment-qr?business=${encodeURIComponent(business)}`,{method:'DELETE',credentials:'same-origin',headers:{'x-csrf-token':user.csrfToken}}),body=await response.json();if(!response.ok){setError(body.error);return}setMetadata(body);setMessage('Payment QR removed.');setError('')};
  return <><PageHead title="Payment QR" description="Upload the static QR image shown to cashiers during QRIS checkout."/>{!selected&&<p className="alert" role="status">Select one tenant to configure its payment QR.</p>}{error&&<p className="alert bad" role="alert">{error}</p>}{message&&<p className="alert" role="status">{message}</p>}<Card><h2>Current QR</h2>{metadata.configured?<><img className="payment-qr" src={`${API}/payment-qr/image?business=${encodeURIComponent(business)}&v=${encodeURIComponent(metadata.updatedAt||'')}`} alt={`Payment QR for ${label}`}/><p>Updated {new Date(metadata.updatedAt!).toLocaleString()}</p></>:<p>No payment QR configured.</p>}<label className="field"><span>QR image</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={!selected} onChange={event=>setFile(event.target.files?.[0])}/></label><div className="form-actions"><Button variant="primary" disabled={!selected||!file} onClick={()=>void upload()}>{metadata.configured?'Replace QR':'Upload QR'}</Button>{metadata.configured&&<Button variant="danger" onClick={()=>void remove()}>Remove QR</Button>}</div></Card></>;
}
