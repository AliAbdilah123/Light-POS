import {act,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {DataTable,type DataTableColumn} from './DataTable';

type Row={id:string;name:string;status:string};
const rows:Row[]=[{id:'1',name:'Zulu',status:'Active'},{id:'2',name:'Alpha',status:'Inactive'},{id:'3',name:'Bravo',status:'Active'}];
const columns:DataTableColumn<Row>[]=[{key:'name',label:'Name',value:x=>x.name,render:x=>x.name},{key:'status',label:'Status',value:x=>x.status,render:x=>x.status}];
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

describe('DataTable',()=>{
  it('searches, filters, sorts, selects, and runs caller bulk actions',async()=>{
    const action=vi.fn();render(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} filters={[{label:'Status',value:'Active',onChange:()=>{},options:['Active','Inactive']}]} bulkActions={[{label:'Archive',onClick:action}]}/>);const user=userEvent.setup();
    await user.type(screen.getByRole('searchbox',{name:'Quick search'}),'a');
    const table=screen.getByRole('table',{name:'People'});expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Alpha');
    await user.click(screen.getByRole('checkbox',{name:'Select Alpha'}));await user.click(screen.getByRole('button',{name:/Archive/}));expect(action).toHaveBeenCalledWith([rows[1]]);
  });

  it('reveals additional rows when the infinite-scroll sentinel intersects',async()=>{
    let observer:IntersectionObserverCallback|undefined;vi.stubGlobal('IntersectionObserver',class{constructor(callback:IntersectionObserverCallback){observer=callback}observe(){}disconnect(){}});
    render(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} pageSize={2}/>);expect(screen.queryByText('Zulu')).not.toBeInTheDocument();
    await waitFor(()=>expect(observer).toBeDefined());act(()=>observer?.([{isIntersecting:true} as IntersectionObserverEntry],{} as IntersectionObserver));expect(screen.getByText('Zulu')).toBeInTheDocument();
  });
});
