import {Badge,EmptyState} from '../components/atoms';
import {PageHead} from '../components/molecules';
import {idr,type MenuItem} from '../domain';
import {useStore} from '../store';

const version=(menu:MenuItem)=>menu.versions?.find(v=>v.version===menu.currentVersion);
const availability=(menu:MenuItem)=>menu.availability==='sold-out'||menu.available===false?'Sold out':menu.availability==='low'?'Low':'Available';

export function DisplayMenuPage(){
  const{sessionMenus,demo}=useStore();const menus=(demo==='empty'?[]:sessionMenus).filter(menu=>!menu.archived);
  const composition=(menu:MenuItem)=>version(menu)?.components?.map(component=>`${component.quantity} × ${(()=>{const item=sessionMenus.find(item=>item.id===component.menuId);return item?.versions?.find(v=>v.version===item.currentVersion)?.name||'Unavailable item'})()}`).join(', ');
  if(demo==='loading')return <><PageHead title="Menu display" description="Current-session menu and availability."/><div className="skeleton" aria-label="Loading menu display"/></>;
  if(demo==='error')return <><PageHead title="Menu display" description="Current-session menu and availability."/><p role="alert" className="alert bad">Menu could not be loaded. Try again later.</p></>;
  return <><PageHead title="Menu display" description="Current-session prices and availability. This catalog is read-only."/>{menus.length?<section className="display-grid" aria-label="Current menu">{menus.map(menu=>{const current=version(menu);const state=availability(menu);return <article className="card display-item" key={menu.id}><header><span className="eyebrow">{current?.category||menu.category}</span><Badge tone={state==='Available'?'good':state==='Low'?'warn':'bad'}>{state}</Badge></header><h2>{current?.name||menu.name}</h2><strong className="display-price">{idr(current?.price??menu.price)}</strong>{current?.description&&<p>{current.description}</p>}{composition(menu)&&<p><b>Includes:</b> {composition(menu)}</p>}{current?.ingredients.some(i=>!i.hidden)&&<p><b>Ingredients:</b> {current.ingredients.filter(i=>!i.hidden).map(i=>i.name).join(', ')}</p>}</article>})}</section>:<EmptyState title="No menu items to display"><p>The current session has no visible menu entries.</p></EmptyState>}</>;
}
