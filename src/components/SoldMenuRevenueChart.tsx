import { idr, soldMenuRevenue, type MenuItem, type Order } from '../domain';
import { Card } from './ui/card';

const colors=['var(--accent)','var(--success)','var(--warning)','var(--info)','var(--danger)'];
const color=(id:string)=>colors[[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%colors.length];
const label=(day:string)=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short'}).format(new Date(`${day}T00:00:00Z`));

export function SoldMenuRevenueChart({orders,menus}:{orders:Order[];menus:MenuItem[]}){
  const rows=soldMenuRevenue(orders,menus),peak=Math.max(1,...rows.map(row=>row.total)),sold=rows.reduce((sum,row)=>sum+row.quantity,0),revenue=rows.reduce((sum,row)=>sum+row.total,0),legend=new Map<string,string>();
  rows.forEach(row=>row.segments.forEach(segment=>legend.set(segment.menuId,segment.name)));
  return <Card className="sold-menu-card">
    <div className="section-title"><div><h2>Sold menus · last 30 days</h2><p>Line revenue before discounts and tax · Asia/Jakarta</p></div><div className="sold-menu-summary"><span><small>Revenue</small><strong>{idr(revenue)}</strong></span><span><small>Sold</small><strong>{sold.toLocaleString('id-ID')}</strong></span></div></div>
    <div className="sold-menu-scroll"><div className="sold-menu-chart" role="img" aria-label="Sold menu revenue for the last 30 days">
      {rows.map(row=><div className="sold-menu-day" key={row.day}><div className="sold-menu-stack" style={{height:`${Math.max(2,row.total/peak*100)}%`}}>{row.segments.map(segment=><button key={segment.menuId} className="sold-menu-segment" style={{height:`${segment.revenue/Math.max(1,row.total)*100}%`,background:color(segment.menuId)}} aria-label={`${segment.name}, ${segment.quantity} sold, ${idr(segment.revenue)} revenue on ${label(row.day)}`}><span><b>{segment.name}</b>{segment.quantity} sold<br/>{idr(segment.revenue)}</span></button>)}</div><small>{label(row.day)}</small></div>)}
    </div></div>
    {legend.size?<div className="sold-menu-legend">{[...legend].map(([id,name])=><span key={id}><i style={{background:color(id)}}/>{name}</span>)}</div>:<p className="muted">No completed menu sales in the last 30 days.</p>}
  </Card>
}
